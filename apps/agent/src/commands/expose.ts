import { io } from 'socket.io-client';
import chalk from 'chalk';
import * as dgram from 'dgram';
import { loadConfig, ensureConfig } from '../config';
import { enforceSecureConnection, handleTokenExpiry, handleSecurityEvent, SecurityError } from '../security';
import { E2ESession } from '../e2e';

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
  e2e?: boolean;
  json?: boolean;
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
    process.exit(1);
  }

  if (!options.json) {
    console.log(chalk.cyan(`🔗 Exposing ${target} as "${options.name}"...`));
  }

  // Load or create config
  const existingConfig = loadConfig();
  if (!existingConfig && !options.apiKey) {
    console.error(chalk.red('\n[x] API key required for first-time setup'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect login <your-api-key>')} to save it once`));
    console.log(chalk.gray(`  Or use: ${chalk.cyan('connect expose <target> --api-key <your-api-key>')}`));
    process.exit(1);
  }

  const config = ensureConfig(options.hub, options.apiKey);
  
  if (!options.json) {
    console.log(chalk.gray(`   Agent ID: ${config.agentId}`));
    console.log(chalk.gray(`   Label:    ${config.label}`));
    console.log(chalk.gray(`   Hub URL:  ${config.hubUrl}`));
  }

  // Register agent first if needed
  await registerAgent(config);

  // Block --public and --link for non-HTTP services (databases, caches, etc.)
  const nonHttpPorts = [5432, 3306, 27017, 6379, 6380, 26257, 9042, 8529, 7687, 1433, 1521, 50000];
  const isNonHttpService = nonHttpPorts.includes(port);

  if (isNonHttpService && (options.public || options.link)) {
    const flag = options.public ? '--public' : '--link';
    console.log(chalk.yellow(`\n   [!] ${flag} creates a public HTTP URL, which doesn't work for database/TCP services (port ${port}).`));
    console.log(chalk.gray(`       To access this service remotely, use: connect reach ${options.name}`));
  }

  const isPublic = (options.link || isNonHttpService) ? false : (options.public || false);
  
  // Idempotency: check if this exact service is already registered
  const existingService = await findExistingService(config.agentId, options.name, host, port, config);
  
  // Register service with hub (or reuse existing)
  const service = existingService || await registerService(config.agentId, options.name, host, port, options.protocol, isPublic, config);
  
  if (!service) {
    console.error(chalk.red('[x] Failed to register service'));
    process.exit(1);
  }

  // Store serviceId for return value
  const result = { serviceId: service.id };

  if (!options.json) {
    console.log(chalk.green(`[ok] Service registered`));
    console.log(chalk.gray(`   Service ID: ${service.id}`));
    console.log(chalk.gray(`   Tunnel Port: ${service.tunnelPort}`));
    console.log(chalk.gray(`   Protocol: ${service.protocol}`));
  }

  if (options.json) {
    const jsonOutput: Record<string, unknown> = {
      serviceId: service.id,
      name: options.name,
      target,
      tunnelPort: service.tunnelPort,
      protocol: service.protocol,
      isPublic: service.isPublic,
    };
    if (service.publicUrl) {
      jsonOutput.publicUrl = service.publicUrl;
    }
    console.log(JSON.stringify(jsonOutput));
  }

  if (service.publicUrl) {
    console.log(chalk.cyan(`\n🌐 Public URL: ${service.publicUrl}`));
    console.log(chalk.gray(`   External services (Stripe, GitHub, etc.) can send webhooks to this URL`));
  }

  // Create debug session if --debug flag is set
  if (options.debug) {
    const debugSession = await createDebugSession(
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
    } else if (reason === 'io client disconnect') {
      // Intentional disconnect, no message needed
    } else {
      console.log(chalk.gray(`[${timestamp}] Reconnecting... (${reason})`));
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
            console.log(chalk.gray(`   Public URL: ${linkUrl}`));
          } else if (service.publicUrl) {
            console.log(chalk.gray(`   Public URL: ${service.publicUrl}`));
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
          if (options.link && !linkUrl && !isNonHttpService) {
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
  const CHUNK_THRESHOLD = 5 * 1024 * 1024; // 5MB — chunk larger responses
  const CHUNK_SIZE = 4 * 1024 * 1024;       // 4MB per chunk

  function sendResponse(
    sock: typeof socket,
    requestId: string,
    status: number,
    headers: Record<string, string>,
    body: Buffer,
  ) {
    if (body.length <= CHUNK_THRESHOLD) {
      sock.emit('http_response', { requestId, status, headers, body, bodyEncoding: 'binary' });
    } else {
      const totalChunks = Math.ceil(body.length / CHUNK_SIZE);
      sock.emit('http_response_start', { requestId, status, headers, totalChunks });
      for (let i = 0; i < totalChunks; i++) {
        sock.emit('http_response_chunk', {
          requestId,
          index: i,
          data: body.subarray(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        });
      }
      sock.emit('http_response_end', { requestId });
    }
  }

  socket.on('http_request', async (data: {
    requestId: string;
    serviceId: string;
    method: string;
    path: string;
    headers: Record<string, string>;
    body: string;
  }, ack?: (resp: { received: boolean }) => void) => {
    if (ack) ack({ received: true });

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
        timeout: 55000,
      }, (proxyRes) => {
        const chunks: Buffer[] = [];
        proxyRes.on('data', (chunk: Buffer) => chunks.push(chunk));
        proxyRes.on('end', () => {
          const resHeaders: Record<string, string> = {};
          for (const [key, value] of Object.entries(proxyRes.headers)) {
            if (typeof value === 'string') resHeaders[key] = value;
            else if (Array.isArray(value)) resHeaders[key] = value.join(', ');
          }
          sendResponse(socket, data.requestId, proxyRes.statusCode || 200, resHeaders, Buffer.concat(chunks));
        });
      });

      proxyReq.on('error', (err: Error) => {
        sendResponse(socket, data.requestId, 502,
          { 'content-type': 'application/json' },
          Buffer.from(JSON.stringify({ error: 'Failed to connect to service', message: err.message })),
        );
      });

      proxyReq.on('timeout', () => {
        proxyReq.destroy();
        sendResponse(socket, data.requestId, 504,
          { 'content-type': 'application/json' },
          Buffer.from(JSON.stringify({ error: 'Gateway timeout', message: 'Service did not respond in time' })),
        );
      });

      if (data.body && data.method !== 'GET' && data.method !== 'HEAD') {
        proxyReq.write(data.body);
      }
      proxyReq.end();
    } catch (err: unknown) {
      const error = err as Error;
      sendResponse(socket, data.requestId, 502,
        { 'content-type': 'application/json' },
        Buffer.from(JSON.stringify({ error: 'Failed to connect to service', message: error.message })),
      );
    }
  });

  // Handle SQL queries forwarded through WebSocket
  const DB_PORTS: Record<number, string> = { 5432: 'postgres', 5433: 'postgres', 5434: 'postgres', 3306: 'mysql', 3307: 'mysql' };
  const detectedDbProtocol = (['postgres', 'mysql'].includes(options.protocol) ? options.protocol : null) || DB_PORTS[port] || null;

  if (detectedDbProtocol === 'postgres' || detectedDbProtocol === 'mysql') {
    const SQL_MAX_ROWS = 1000;
    const SQL_QUERY_TIMEOUT_MS = 30_000;

    socket.on('sql_query', async (data: {
      requestId: string;
      serviceId: string;
      sql: string;
      params?: any[];
      protocol?: string;
    }, ack?: (resp: { received: boolean }) => void) => {
      if (ack) ack({ received: true });

      const incomingProto = data.protocol;
      const isDbProto = incomingProto === 'postgres' || incomingProto === 'mysql';
      const dbProtocol = detectedDbProtocol || (isDbProto ? incomingProto : null);

      try {
        if (dbProtocol === 'postgres') {
          let PgClient: any;
          try {
            const pg = await import('pg');
            PgClient = pg.Client ?? (pg as any).default?.Client;
          } catch {
            socket.emit('sql_response', {
              requestId: data.requestId,
              success: false,
              error: 'pg package is not installed. Run: npm install pg',
            });
            return;
          }

          const client = new PgClient({
            host,
            port,
            statement_timeout: SQL_QUERY_TIMEOUT_MS,
          });

          try {
            await client.connect();
            const result = data.params
              ? await client.query(data.sql, data.params)
              : await client.query(data.sql);

            const rows = Array.isArray(result.rows) ? result.rows.slice(0, SQL_MAX_ROWS) : [];
            socket.emit('sql_response', {
              requestId: data.requestId,
              success: true,
              rows,
              fields: (result.fields || []).map((f: any) => ({ name: f.name, dataTypeID: f.dataTypeID })),
              rowCount: result.rowCount,
            });
          } finally {
            await client.end().catch(() => {});
          }
        } else if (dbProtocol === 'mysql') {
          let mysql2: any;
          try {
            mysql2 = await import('mysql2/promise');
          } catch {
            socket.emit('sql_response', {
              requestId: data.requestId,
              success: false,
              error: 'mysql2 package is not installed. Run: npm install mysql2',
            });
            return;
          }

          const createConn = mysql2.createConnection ?? mysql2.default?.createConnection;
          const connection = await createConn({
            host,
            port,
            connectTimeout: SQL_QUERY_TIMEOUT_MS,
          });

          try {
            const [rows, fields] = data.params
              ? await connection.execute({ sql: data.sql, timeout: SQL_QUERY_TIMEOUT_MS }, data.params)
              : await connection.execute({ sql: data.sql, timeout: SQL_QUERY_TIMEOUT_MS });

            const resultRows = Array.isArray(rows) ? rows.slice(0, SQL_MAX_ROWS) : [];
            socket.emit('sql_response', {
              requestId: data.requestId,
              success: true,
              rows: resultRows,
              fields: (fields || []).map((f: any) => ({ name: f.name, dataTypeID: f.columnType })),
              rowCount: Array.isArray(rows) ? rows.length : 0,
            });
          } finally {
            await connection.end().catch(() => {});
          }
        } else {
          socket.emit('sql_response', {
            requestId: data.requestId,
            success: false,
            error: `Unsupported database protocol: ${dbProtocol}`,
          });
        }
      } catch (err: unknown) {
        const error = err as Error;
        socket.emit('sql_response', {
          requestId: data.requestId,
          success: false,
          error: error.message,
        });
      }
    });
  }

  // Handle dial requests
  const net = await import('net');
  interface ExposeConn {
    socket: any;
    connected: boolean;
    pty?: any;
    e2e: E2ESession | null;
    e2ePending: boolean;
    e2eBuffer: Buffer[];
    e2eTimeout: ReturnType<typeof setTimeout> | null;
  }
  const connections = new Map<string, ExposeConn>();
  const e2eEnabled = options.e2e !== false;

  function emitData(connectionId: string, conn: ExposeConn, chunk: Buffer) {
    const payload = conn.e2e?.ready ? conn.e2e.encrypt(chunk) : chunk;
    socket.emit('data', {
      connectionId,
      data: payload.toString('base64'),
    });
  }

  function flushE2eBuffer(connectionId: string, conn: ExposeConn) {
    for (const chunk of conn.e2eBuffer) {
      emitData(connectionId, conn, chunk);
    }
    conn.e2eBuffer = [];
  }

  // Handle E2E handshake init from reaching agent
  socket.on('e2e_handshake', (data: { connectionId: string; payload: string }) => {
    const conn = connections.get(data.connectionId);
    if (!conn) return;

    try {
      const msg = JSON.parse(data.payload) as { type: string; pubkey: string };
      if (msg.type === 'init') {
        const session = new E2ESession(data.connectionId, 'responder');
        session.complete(Buffer.from(msg.pubkey, 'base64'));
        conn.e2e = session;
        conn.e2ePending = false;

        if (conn.e2eTimeout) {
          clearTimeout(conn.e2eTimeout);
          conn.e2eTimeout = null;
        }

        socket.emit('e2e_handshake', {
          connectionId: data.connectionId,
          payload: JSON.stringify({
            type: 'accept',
            pubkey: session.getPublicKey().toString('base64'),
          }),
        });

        console.log(chalk.green(`   [ok] E2E encrypted (${data.connectionId.substring(0, 8)})`));
        flushE2eBuffer(data.connectionId, conn);
      }
    } catch (err) {
      console.warn(chalk.yellow(`   [!] E2E handshake failed for ${data.connectionId.substring(0, 8)}: ${err instanceof Error ? err.message : err}`));
      console.warn(chalk.yellow(`       Connection will proceed WITHOUT encryption.`));
      conn.e2ePending = false;
      flushE2eBuffer(data.connectionId, conn);
    }
  });

  socket.on('dial', async (data: { connectionId: string; targetHost: string; targetPort: number; pty?: boolean }) => {
    console.log(chalk.gray(`   ← Incoming connection ${data.connectionId.substring(0, 8)}${data.pty ? ' (pty)' : ''}`));

    if (data.pty) {
      try {
        const shell = process.env.SHELL || '/bin/bash';
        let ptyHandle: any;

        try {
          const pty = await import('node-pty');
          const p = pty.spawn(shell, [], {
            name: 'xterm-256color',
            cols: 80,
            rows: 24,
            cwd: process.env.HOME || '/',
            env: { ...process.env } as Record<string, string>,
          });
          ptyHandle = {
            type: 'node-pty',
            process: p,
            write: (d: string) => p.write(d),
            resize: (c: number, r: number) => p.resize(c, r),
            kill: () => p.kill(),
          };
          p.onData((chunk: string) => {
            socket.emit('data', { connectionId: data.connectionId, data: Buffer.from(chunk, 'utf8').toString('base64') });
          });
          p.onExit(() => {
            socket.emit('close', { connectionId: data.connectionId });
            connections.delete(data.connectionId);
          });
        } catch {
          const { spawn: spawnChild } = await import('child_process');
          const pyScript = `import pty,os;pty.spawn([os.environ.get("SHELL","/bin/bash"),"-l"])`;
          const child = spawnChild('python3', ['-c', pyScript], {
            stdio: 'pipe',
            env: { ...process.env, TERM: 'xterm-256color' },
            cwd: process.env.HOME || '/',
          });
          ptyHandle = {
            type: 'script',
            process: child,
            write: (d: string) => child.stdin?.write(d),
            resize: () => {},
            kill: () => child.kill(),
          };
          child.stdout?.on('data', (chunk: Buffer) => {
            socket.emit('data', { connectionId: data.connectionId, data: chunk.toString('base64') });
          });
          child.stderr?.on('data', (chunk: Buffer) => {
            socket.emit('data', { connectionId: data.connectionId, data: chunk.toString('base64') });
          });
          child.on('exit', () => {
            socket.emit('close', { connectionId: data.connectionId });
            connections.delete(data.connectionId);
          });
        }

        connections.set(data.connectionId, {
          socket: ptyHandle, connected: true, pty: ptyHandle,
          e2e: null, e2ePending: false, e2eBuffer: [], e2eTimeout: null,
        });
        socket.emit('dial_success', { connectionId: data.connectionId });
      } catch (err: any) {
        socket.emit('dial_error', { connectionId: data.connectionId, error: err.message || 'PTY spawn failed' });
      }
      return;
    }

    const targetSocket = net.createConnection({
      host: data.targetHost,
      port: data.targetPort,
    });

    connections.set(data.connectionId, {
      socket: targetSocket, connected: false,
      e2e: null, e2ePending: e2eEnabled, e2eBuffer: [], e2eTimeout: null,
    });

    targetSocket.on('connect', () => {
      const conn = connections.get(data.connectionId);
      if (conn) conn.connected = true;
      socket.emit('dial_success', { connectionId: data.connectionId });

      const conn2 = connections.get(data.connectionId);
      if (conn2 && conn2.e2ePending) {
        conn2.e2eTimeout = setTimeout(() => {
          const c = connections.get(data.connectionId);
          if (c && c.e2ePending) {
            console.warn(chalk.yellow(`   [!] E2E handshake timed out for ${data.connectionId.substring(0, 8)} — proceeding WITHOUT encryption.`));
            c.e2ePending = false;
            c.e2eTimeout = null;
            flushE2eBuffer(data.connectionId, c);
          }
        }, 5000);
      }
    });

    targetSocket.on('data', (chunk: Buffer) => {
      const conn = connections.get(data.connectionId);
      if (!conn) return;

      if (conn.e2ePending) {
        conn.e2eBuffer.push(chunk);
      } else {
        emitData(data.connectionId, conn, chunk);
      }
    });

    targetSocket.on('error', (err: Error) => {
      socket.emit('dial_error', { connectionId: data.connectionId, error: err.message });
      const conn = connections.get(data.connectionId);
      if (conn?.e2eTimeout) clearTimeout(conn.e2eTimeout);
      connections.delete(data.connectionId);
    });

    targetSocket.on('close', () => {
      socket.emit('close', { connectionId: data.connectionId });
      const conn = connections.get(data.connectionId);
      if (conn?.e2eTimeout) clearTimeout(conn.e2eTimeout);
      connections.delete(data.connectionId);
    });
  });

  socket.on('data', (data: { connectionId: string; data: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn?.connected) {
      const raw = Buffer.from(data.data, 'base64');
      if (conn.pty) {
        const plaintext = conn.e2e?.ready ? conn.e2e.decrypt(raw).toString('utf8') : raw.toString('utf8');
        conn.pty.write(plaintext);
      } else {
        const plaintext = conn.e2e?.ready ? conn.e2e.decrypt(raw) : raw;
        conn.socket.write(plaintext);
      }
    }
  });

  socket.on('resize', (data: { connectionId: string; cols: number; rows: number }) => {
    const conn = connections.get(data.connectionId);
    if (conn?.pty?.resize) {
      conn.pty.resize(data.cols, data.rows);
    }
  });

  socket.on('close', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      if (conn.pty?.kill) {
        conn.pty.kill();
      } else if (conn.socket?.end) {
        conn.socket.end();
      }
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
    udpSocket.on('message', (msg: Buffer, _rinfo: dgram.RemoteInfo) => {
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
    }, 15000);
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
      const status = response.status;
      const errMsg = status === 401 || status === 403
        ? 'Invalid or expired API key. Run: connect login <your-api-key>'
        : `HTTP ${status}. Run: connect doctor  to check connectivity`;
      throw new Error(errMsg);
    }
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`[x] Agent registration failed: ${err.message}`));
    throw error;
  }
}

async function findExistingService(
  agentId: string,
  name: string,
  targetHost: string,
  targetPort: number,
  config: { hubUrl: string; apiKey: string },
): Promise<{ id: string; tunnelPort: number; protocol: string; isPublic: boolean; publicUrl: string | null } | null> {
  try {
    const response = await fetch(`${config.hubUrl}/v1/services`, {
      headers: { 'x-api-key': config.apiKey },
    });
    if (!response.ok) return null;

    const data = await response.json() as { services?: Array<{ id: string; name: string; agentId: string; targetHost: string; targetPort: number; tunnelPort: number; protocol: string; isPublic: boolean; publicUrl: string | null }> };
    const services = data.services || (Array.isArray(data) ? data : []);

    const match = services.find(
      (s: any) => s.agentId === agentId && s.name === name && s.targetPort === targetPort
    );
    if (match) {
      console.log(chalk.gray(`   [ok] "${name}" already exposed on port ${targetPort}, reusing`));
      return match;
    }
    return null;
  } catch {
    return null;
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
      const status = response.status;
      console.error(chalk.red(`[x] Service registration failed (HTTP ${status})`));
      if (status === 401 || status === 403) {
        console.log(chalk.gray(`  Check your API key: connect login <your-api-key>`));
      } else if (status === 409) {
        console.log(chalk.gray(`  A service with this name may already exist. Try a different --name.`));
      } else {
        console.log(chalk.gray(`  Run: connect doctor  to check connectivity`));
      }
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
