import { io } from 'socket.io-client';
import chalk from 'chalk';
import * as dgram from 'dgram';
import { loadConfig, ensureConfig } from '../config';
import { enforceSecureConnection, handleTokenExpiry, handleSecurityEvent, SecurityError } from '../security';

interface ExposeOptions {
  name: string;
  hub: string;
  apiKey?: string;
  protocol: string;
  public?: boolean;
  link?: boolean;
  linkExpires?: string;
  config?: string;
  debug?: boolean;
  aiEnabled?: boolean;
}

interface DiagnosticResult {
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus?: string;
  httpStatus?: string;
  latencyMs?: number;
  message: string;
}

export async function exposeCommand(target: string, options: ExposeOptions): Promise<{ serviceId: string } | null> {
  // Enforce HTTPS for non-localhost connections
  try {
    enforceSecureConnection(options.hub);
  } catch (err) {
    if (err instanceof SecurityError) {
      process.exit(1);
    }
    throw err;
  }
  // Parse target
  const [host, portStr] = target.split(':');
  const port = parseInt(portStr, 10);
  
  if (!host || isNaN(port)) {
    console.error(chalk.red('[x] Invalid target format. Use host:port (e.g., 127.0.0.1:8080)'));
    return null;
  }

  // Warn if trying to expose Private Connect control plane
  // const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  // if (isLocalhost && port === 3000) {
  //   console.log(chalk.yellow('\n[!] Warning: Port 3000 is typically the Private Connect Web UI.'));
  //   console.log(chalk.gray('  You might want to expose a different service instead.'));
  //   console.log(chalk.gray('  Example: connect expose localhost:8080 --name my-api\n'));
  // } else if (isLocalhost && port === 3001) {
  //   console.log(chalk.yellow('\n[!] Warning: Port 3001 is typically the Private Connect API.'));
  //   console.log(chalk.gray('  You might want to expose a different service instead.'));
  //   console.log(chalk.gray('  Example: connect expose localhost:8080 --name my-api\n'));
  // }

  console.log(chalk.cyan(`🔗 Exposing ${target} as "${options.name}"...`));

  // Load or create config
  const existingConfig = loadConfig();
  if (!existingConfig && !options.apiKey) {
    console.error(chalk.red('\n[x] API key required for first-time setup'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect login <your-api-key>')} to save it once`));
    console.log(chalk.gray(`  Or use: ${chalk.cyan('connect expose <target> --api-key <your-api-key>')}`));
    return null;
  }

  const config = ensureConfig(options.hub, options.apiKey);
  
  console.log(chalk.gray(`   Agent ID: ${config.agentId}`));
  console.log(chalk.gray(`   Label:    ${config.label}`));
  console.log(chalk.gray(`   Hub URL:  ${config.hubUrl}`));

  // Register agent first if needed
  await registerAgent(config);

  // When --link is used, skip --public to avoid two competing public URLs
  const isPublic = options.link ? false : (options.public || false);
  
  // Register service with hub
  const service = await registerService(config.agentId, options.name, host, port, options.protocol, isPublic, config);
  
  if (!service) {
    console.error(chalk.red('[x] Failed to register service'));
    return null;
  }

  // Store serviceId for return value
  const result = { serviceId: service.id };

  console.log(chalk.green(`[ok] Service registered`));
  console.log(chalk.gray(`   Service ID: ${service.id}`));
  console.log(chalk.gray(`   Tunnel Port: ${service.tunnelPort}`));
  console.log(chalk.gray(`   Protocol: ${service.protocol}`));
  
  if (service.publicUrl) {
    console.log(chalk.cyan(`\n🌐 Public URL: ${service.publicUrl}`));
    console.log(chalk.gray(`   External services (Stripe, GitHub, etc.) can send webhooks to this URL`));
  }

  // Create debug session if --debug flag is set
  let debugSession: { id: string; token: string; url: string } | null = null;
  if (options.debug) {
    debugSession = await createDebugSession(
      service.id,
      config.agentId,
      options.name,
      options.aiEnabled || false,
      config,
    );
    
    if (debugSession) {
      console.log(chalk.magenta(`\n🔍 Debug mode enabled`));
      console.log(chalk.cyan(`   Share this link: ${debugSession.url}`));
      console.log(chalk.gray(`   Anyone with this link can see live traffic`));
      if (options.aiEnabled) {
        console.log(chalk.gray(`   AI Copilot: enabled`));
      }
    }
  }

  // Track state to avoid duplicate work on reconnect
  let tunnelReady = false;
  let linkUrl: string | null = null;
  let connectGeneration = 0; // Incremented on each connect to cancel stale handlers

  // Connect via WebSocket and set up tunnel
  const socket = io(`${config.hubUrl}/agent`, {
    auth: {
      agentId: config.agentId,
      token: config.token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    timeout: 30000,
  });

  socket.on('connect', () => {
    const timestamp = new Date().toLocaleTimeString();
    if (!tunnelReady) {
      console.log(chalk.green(`[${timestamp}] Connected to hub`));
    } else {
      console.log(chalk.green(`[${timestamp}] Reconnected to hub`));
    }
  });

  socket.on('disconnect', (reason: string) => {
    const timestamp = new Date().toLocaleTimeString();
    if (reason === 'io server disconnect') {
      console.log(chalk.yellow(`[${timestamp}] Server restarting, reconnecting...`));
    } else {
      console.log(chalk.yellow(`[${timestamp}] Connection interrupted, reconnecting...`));
    }
  });

  socket.on('reconnect_attempt', (attempt: number) => {
    if (attempt === 1 || attempt % 10 === 0) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(chalk.gray(`[${timestamp}] Reconnecting... (attempt ${attempt})`));
    }
  });

  socket.on('connect_error', (err: Error) => {
    const timestamp = new Date().toLocaleTimeString();
    if (!tunnelReady) {
      console.log(chalk.red(`[${timestamp}] Connection error: ${err.message}`));
    }
  });

  // Handle token expiry warnings
  socket.on('token_warning', (data: { message: string; expiresAt: string }) => {
    handleTokenExpiry({ expiresAt: data.expiresAt });
  });

  // Handle security notices (only show on first connect)
  socket.on('security_notice', (data: { type: string; message: string }) => {
    if (!tunnelReady) {
      handleSecurityEvent(data);
    }
  });

  // Handle auth errors
  socket.on('error', (data: { code: string; message: string }) => {
    if (data.code === 'TOKEN_EXPIRED') {
      console.error(chalk.red(`\n[x] ${data.message}`));
      console.log(chalk.gray('  Your token has expired. Run: connect up --api-key <key> to get a new token.\n'));
      process.exit(1);
    } else if (data.code === 'INVALID_TOKEN') {
      console.error(chalk.red(`\n[x] ${data.message}`));
      process.exit(1);
    }
  });

  // Wait for server to confirm connection before setting up tunnel.
  // Uses a generation counter so rapid reconnects don't race.
  socket.on('connected', (data: { message: string; tokenExpiresAt?: string }) => {
    const isReconnect = tunnelReady;
    const myGeneration = ++connectGeneration;
    
    if (isReconnect) {
      console.log(chalk.gray('   Re-establishing tunnel...'));
    } else {
      console.log(chalk.gray('   Connection confirmed, setting up tunnel...'));
    }
    
    if (data.tokenExpiresAt) {
      handleTokenExpiry({ expiresAt: data.tokenExpiresAt });
    }
    
    // Always re-send expose to ensure the tunnel is set up on the current socket
    socket.emit('expose', {
      serviceId: service.id,
      serviceName: options.name,
      tunnelPort: service.tunnelPort,
      targetHost: host,
      targetPort: port,
      protocol: options.protocol,
    }, async (response: { success: boolean; error?: string }) => {
      // If another connect happened since we started, abandon this callback
      if (myGeneration !== connectGeneration) return;
      
      if (response.success) {
        console.log(chalk.green('[ok] Tunnel established'));
        
        if (isReconnect) {
          console.log(chalk.cyan(`\n📡 Service "${options.name}" is accessible through the hub`));
          if (linkUrl) {
            console.log(chalk.magenta(`\n🔗 Public URL: ${chalk.bold(linkUrl)}`));
          } else if (service.publicUrl) {
            console.log(chalk.green.bold(`\n   Public URL: ${service.publicUrl}`));
          }
          console.log(chalk.gray('\n   Press Ctrl+C to stop exposing\n'));
        } else {
          console.log(chalk.cyan(`\n📡 Service "${options.name}" is now accessible through the hub`));
          console.log();
          if (service.publicUrl) {
            console.log(chalk.green.bold(`   Public URL: ${service.publicUrl}`));
            console.log(chalk.gray(`   Anyone can reach this service at the URL above`));
            console.log();
          }
          console.log(chalk.white.bold(`   From another machine:`));
          console.log(chalk.cyan(`   $ connect reach ${options.name}`));
          console.log(chalk.gray(`   This creates a local tunnel so the service appears on localhost`));
          if (!service.publicUrl && !options.link) {
            console.log();
            console.log(chalk.white.bold(`   Want a public URL anyone can open?`));
            console.log(chalk.cyan(`   $ connect link ${options.name}`));
          }
          
          console.log(chalk.gray('\n   Running initial diagnostics...'));
          if (myGeneration !== connectGeneration) return;
          await runInitialDiagnostics(service.id, options.name, config.hubUrl, config.apiKey);
          
          if (myGeneration !== connectGeneration) return;
          if (options.link && !linkUrl) {
            linkUrl = await createAutoLink(service.id, options.name, options.linkExpires || '24h', config);
          }

          console.log(chalk.gray('\n   Press Ctrl+C to stop exposing\n'));
          tunnelReady = true;
        }
      } else {
        console.error(chalk.red(`[x] Tunnel setup failed: ${response.error}`));
      }
    });
  });

  // Handle HTTP requests forwarded through WebSocket (used by public links)
  const http = await import('http');
  socket.on('http_request', async (data: {
    requestId: string;
    serviceId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
  }) => {
    try {
      const proxyReq = http.request({
        hostname: host,
        port: port,
        path: data.path || '/',
        method: data.method,
        headers: {
          ...data.headers,
          host: `${host}:${port}`,
        },
        timeout: 30000,
      }, (proxyRes) => {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const resHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (typeof value === 'string') resHeaders[key] = value;
            else if (Array.isArray(value)) resHeaders[key] = value.join(', ');
          }
          socket.emit('http_response', {
            requestId: data.requestId,
            status: proxyRes.statusCode || 200,
            headers: resHeaders,
            body: Buffer.concat(chunks).toString('utf-8'),
          });
        });
      });

      proxyReq.on('error', (err: Error) => {
        socket.emit('http_response', {
          requestId: data.requestId,
          status: 502,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Failed to connect to service', message: err.message }),
        });
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        socket.emit('http_response', {
          requestId: data.requestId,
          status: 504,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Gateway timeout', message: 'Service did not respond in time' }),
        });
      });

      if (data.body && data.method !== 'GET' && data.method !== 'HEAD') {
        proxyReq.write(data.body);
      }
      proxyReq.end();
    } catch (err: unknown) {
      const error = err as Error;
      socket.emit('http_response', {
        requestId: data.requestId,
        status: 502,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to connect to service', message: error.message }),
      });
    }
  });

  // Handle dial requests
  const net = await import('net');
  const connections = new Map<string, { socket: any; connected: boolean }>();

  socket.on('dial', async (data: { connectionId: string; targetHost: string; targetPort: number }) => {
    console.log(chalk.gray(`   ← Incoming connection ${data.connectionId.substring(0, 8)}`));
    
    const targetSocket = net.createConnection({
      host: data.targetHost,
      port: data.targetPort,
    });

    connections.set(data.connectionId, { socket: targetSocket, connected: false });

    targetSocket.on('connect', () => {
      const conn = connections.get(data.connectionId);
      if (conn) conn.connected = true;
      socket.emit('dial_success', { connectionId: data.connectionId });
    });

    targetSocket.on('data', (chunk: Buffer) => {
      socket.emit('data', {
        connectionId: data.connectionId,
        data: chunk.toString('base64'),
      });
    });

    targetSocket.on('error', (err: Error) => {
      socket.emit('dial_error', { connectionId: data.connectionId, error: err.message });
      connections.delete(data.connectionId);
    });

    targetSocket.on('close', () => {
      socket.emit('close', { connectionId: data.connectionId });
      connections.delete(data.connectionId);
    });
  });

  socket.on('data', (data: { connectionId: string; data: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn?.connected) {
      conn.socket.write(Buffer.from(data.data, 'base64'));
    }
  });

  socket.on('close', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      conn.socket.end();
      connections.delete(data.connectionId);
    }
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // UDP handling
  // ─────────────────────────────────────────────────────────────────────────────
  
  // Create a local UDP socket for forwarding to the local service
  let udpSocket: dgram.Socket | null = null;
  const udpSessions = new Map<string, { remoteAddress: string; remotePort: number }>();
  
  // Only create UDP socket if protocol is UDP
  if (options.protocol === 'udp') {
    udpSocket = dgram.createSocket('udp4');
    
    udpSocket.on('error', (err) => {
      console.log(chalk.red(`   UDP socket error: ${err.message}`));
    });
    
    // Handle responses from local UDP service
    udpSocket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      // Find the most recent session to route response
      const lastSession = Array.from(udpSessions.entries()).pop();
      if (lastSession) {
        socket.emit('udp_response', {
          sessionId: lastSession[0],
          data: msg.toString('base64'),
        });
        console.log(chalk.gray(`   → UDP response (${msg.length} bytes)`));
      }
    });
    
    udpSocket.bind(); // Bind to random port for sending
  }
  
  // Handle incoming UDP datagrams from hub
  socket.on('udp_datagram', (data: { 
    sessionId: string; 
    data: string; 
    remoteAddress: string; 
    remotePort: number;
  }) => {
    if (!udpSocket) {
      console.log(chalk.yellow('   [!] Received UDP datagram but no UDP socket initialized'));
      return;
    }
    
    const buffer = Buffer.from(data.data, 'base64');
    console.log(chalk.gray(`   ← UDP datagram from ${data.remoteAddress}:${data.remotePort} (${buffer.length} bytes)`));
    
    // Store session for response routing
    udpSessions.set(data.sessionId, { remoteAddress: data.remoteAddress, remotePort: data.remotePort });
    
    // Forward to local UDP service
    udpSocket.send(buffer, port, host, (err) => {
      if (err) {
        console.log(chalk.red(`   UDP send error: ${err.message}`));
      }
    });
  });

  socket.on('disconnect', () => {
    console.log(chalk.yellow('[!] Disconnected from hub'));
    if (udpSocket) {
      udpSocket.close();
    }
  });

  // Application-level keepalive to prevent Railway/proxy idle timeouts.
  // Engine.IO ping/pong may not be recognized as activity by all reverse proxies.
  let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  
  socket.on('connect', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    heartbeatInterval = setInterval(() => {
      if (socket.connected) {
        socket.emit('heartbeat');
      }
    }, 8000);
  });

  socket.on('disconnect', () => {
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
      heartbeatInterval = null;
    }
  });

  // Handle process signals
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Stopping exposure...'));
    if (heartbeatInterval) clearInterval(heartbeatInterval);
    socket.disconnect();
    process.exit(0);
  });

  return result;
}

async function createAutoLink(
  serviceId: string,
  serviceName: string,
  expiresIn: string,
  config: { hubUrl: string; apiKey: string },
): Promise<string | null> {
  try {
    const response = await fetch(`${config.hubUrl}/v1/services/${serviceId}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        name: `${serviceName}-link`,
        expiresIn,
      }),
    });

    if (!response.ok) {
      console.log(chalk.yellow(`\n   [!] Could not create public link: ${response.statusText}`));
      return null;
    }

    const data = await response.json() as {
      success: boolean;
      share?: { token: string; expiresAt: string };
    };

    if (data.success && data.share) {
      const publicUrl = `https://${data.share.token}.privateconnect.co`;
      const expiresAt = new Date(data.share.expiresAt);
      console.log(chalk.magenta(`\n   🔗 Public URL: ${chalk.bold(publicUrl)}`));
      console.log(chalk.gray(`      Expires: ${expiresAt.toLocaleString()}`));
      return publicUrl;
    }
    return null;
  } catch (err: unknown) {
    const error = err as Error;
    console.log(chalk.yellow(`\n   [!] Auto-link failed: ${error.message}`));
    return null;
  }
}

async function registerAgent(config: { agentId: string; token: string; hubUrl: string; apiKey: string; label: string; name?: string }) {
  try {
    const response = await fetch(`${config.hubUrl}/v1/agents/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        agentId: config.agentId,
        token: config.token,
        label: config.label,
        name: config.name,
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Registration failed: ${response.status} - ${text}`);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`[x] Agent registration failed: ${err.message}`));
    throw error;
  }
}

async function registerService(
  agentId: string,
  name: string,
  targetHost: string,
  targetPort: number,
  protocol: string,
  isPublic: boolean,
  config: { hubUrl: string; apiKey: string },
): Promise<{ id: string; tunnelPort: number; protocol: string; isPublic: boolean; publicUrl: string | null } | null> {
  try {
    const response = await fetch(`${config.hubUrl}/v1/services/register`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        agentId,
        name,
        targetHost,
        targetPort,
        protocol,
        isPublic,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(chalk.red(`Service registration failed: ${text}`));
      return null;
    }

    const data = await response.json() as { service: { id: string; tunnelPort: number; protocol: string; isPublic: boolean; publicUrl: string | null } };
    return data.service;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`[x] Service registration failed: ${err.message}`));
    return null;
  }
}

async function runInitialDiagnostics(serviceId: string, serviceName: string, hubUrl: string, apiKey: string) {
  try {
    // Small delay to ensure tunnel is fully ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = await fetch(`${hubUrl}/v1/services/${serviceId}/check`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
      },
    });
    
    if (!response.ok) {
      console.log(chalk.yellow('   [!] Could not run diagnostics'));
      return;
    }
    
    const data = await response.json() as { diagnostic: DiagnosticResult };
    const result = data.diagnostic;
    
    // Display compact diagnostic result
    const isSuccess = result.tcpStatus === 'OK';
    
    if (isSuccess) {
      console.log(chalk.green(`\n   [ok] ${serviceName} is REACHABLE`));
      const parts = [];
      if (result.dnsStatus.includes('OK')) parts.push(chalk.green('DNS [ok]'));
      if (result.tcpStatus === 'OK') parts.push(chalk.green('TCP [ok]'));
      if (result.tlsStatus === 'OK') parts.push(chalk.green('TLS [ok]'));
      if (result.httpStatus === 'OK') parts.push(chalk.green('HTTP [ok]'));
      if (result.latencyMs) parts.push(chalk.gray(`${result.latencyMs}ms`));
      console.log(chalk.gray(`     ${parts.join('  ')}`));
    } else {
      console.log(chalk.red(`\n   [x] ${serviceName} is UNREACHABLE`));
      console.log(chalk.yellow(`     ${result.message}`));
      
      // Provide hints
      if (result.tcpStatus === 'FAIL') {
        console.log(chalk.gray(`     Check that your service is running on the target port`));
      }
      if (result.tlsStatus === 'FAIL') {
        console.log(chalk.gray(`     TLS handshake failed - certificate may be invalid`));
      }
      if (result.httpStatus === 'FAIL') {
        console.log(chalk.gray(`     HTTP health check failed - service may not be healthy`));
      }
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.log(chalk.yellow(`   [!] Diagnostics error: ${err.message}`));
  }
}

async function createDebugSession(
  serviceId: string,
  agentId: string,
  serviceName: string,
  aiEnabled: boolean,
  config: { hubUrl: string; apiKey: string },
): Promise<{ id: string; token: string; url: string } | null> {
  try {
    const response = await fetch(`${config.hubUrl}/v1/debug/sessions/cli`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        serviceId,
        agentId,
        name: `Debug: ${serviceName}`,
        aiEnabled,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.log(chalk.yellow(`   [!] Could not create debug session: ${text}`));
      return null;
    }

    const data = await response.json() as { id: string; token: string; url: string };
    return data;
  } catch (error: unknown) {
    const err = error as Error;
    console.log(chalk.yellow(`   [!] Debug session error: ${err.message}`));
    return null;
  }
}
