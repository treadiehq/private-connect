import chalk from 'chalk';
import { io, Socket } from 'socket.io-client';
import * as net from 'net';
import { v4 as uuidv4 } from 'uuid';
import { loadConfig } from '../config';

interface ReachOptions {
  hub: string;
  timeout: string;
  port?: string;
  check: boolean;
  json: boolean;
  config?: string;
}

interface Service {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort: number | null;
  status: string;
  agentId: string | null;
  protocol: string;
  isExternal?: boolean;
}

interface TlsDetails {
  valid: boolean;
  issuer?: string;
  subject?: string;
  daysUntilExpiry?: number;
  selfSigned?: boolean;
  error?: string;
}

interface HttpDetails {
  statusCode?: number;
  statusMessage?: string;
  responseTime?: number;
  error?: string;
}

interface DiagnosticResult {
  id: string;
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus?: string;
  tlsDetails?: string;
  httpStatus?: string;
  httpDetails?: string;
  latencyMs?: number;
  message: string;
  perspective: string;
  sourceLabel?: string;
  shareToken?: string;
}

export async function reachCommand(target: string, options: ReachOptions) {
  const config = loadConfig();
  const hubUrl = config?.hubUrl || options.hub;
  const timeoutMs = parseInt(options.timeout, 10);

  // Check if target is a URL (direct reach) or a service name
  const isUrl = target.startsWith('http://') || target.startsWith('https://');

  if (!options.json) {
    console.log(chalk.cyan(`\n🔍 Reaching "${target}"...\n`));
  }

  // Direct URL reach - just run diagnostics
  if (isUrl) {
    await reachDirectUrl(target, options, timeoutMs);
    return;
  }

  // Service name reach - requires agent config
  if (!config) {
    const error = { error: 'Agent not configured', configured: false };
    if (options.json) {
      console.log(JSON.stringify(error));
    } else {
      console.error(chalk.red('  ✗ Agent not configured'));
      console.log(chalk.gray(`    Run ${chalk.cyan('connect up --api-key <key>')} first.\n`));
    }
    process.exit(1);
  }

  // Find the service by name
  const service = await findService(target, hubUrl, config.apiKey);
  
  if (!service) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'Service not found', service: target }));
    } else {
      console.error(chalk.red(`  ✗ Service "${target}" not found`));
      console.log(chalk.gray('\n  Available services:'));
      await listServices(hubUrl, config.apiKey);
      console.log();
    }
    process.exit(1);
  }

  // Check if this is an external service (no tunnel)
  if (service.isExternal || !service.tunnelPort) {
    if (!options.json) {
      console.log(chalk.gray(`  Service ID: ${service.id}`));
      console.log(chalk.gray(`  Target: ${service.targetHost}:${service.targetPort}`));
      console.log(chalk.magenta(`  Type: External (direct connection)`));
      console.log();
      console.log(chalk.cyan('  Running diagnostics...'));
      console.log();
    }

    const protocol = service.protocol === 'https' || service.targetPort === 443 ? 'https' : 'http';
    const url = `${protocol}://${service.targetHost}:${service.targetPort}`;
    await reachDirectUrl(url, options, timeoutMs);
    return;
  }

  if (!options.json) {
    console.log(chalk.gray(`  Service ID: ${service.id}`));
    console.log(chalk.gray(`  Target: ${service.targetHost}:${service.targetPort}`));
    console.log(chalk.gray(`  From: ${config.label} (this agent)`));
    console.log();
    console.log(chalk.cyan('  Running diagnostics...'));
    console.log();
  }

  // Run reach check
  const result = await runReachCheck(service.id, config.agentId, timeoutMs, hubUrl, config.apiKey);

  if (!result) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'Failed to run diagnostics' }));
    } else {
      console.error(chalk.red('  ✗ Failed to run diagnostics'));
    }
    process.exit(1);
  }

  const isReachable = result.tcpStatus === 'OK' && 
                      result.tlsStatus !== 'FAIL' && 
                      result.httpStatus !== 'FAIL';

  if (options.json) {
    console.log(JSON.stringify({
      success: isReachable,
      service: {
        id: service.id,
        name: service.name,
        target: `${service.targetHost}:${service.targetPort}`,
      },
      diagnostic: result,
      shareUrl: result.shareToken ? `${hubUrl}/diagnostics/share/${result.shareToken}` : null,
    }, null, 2));
    return;
  }

  // Display diagnostics
  displayDiagnostics(result, service, config.label);

  // If --check flag is set or not reachable, stop here
  if (options.check || !isReachable) {
    if (!isReachable) {
      console.log(chalk.red(`\n  Cannot create tunnel - service is not reachable.\n`));
    }
    return;
  }

  // Create local tunnel
  const localPort = options.port ? parseInt(options.port, 10) : service.targetPort;
  
  console.log(chalk.cyan(`\n📡 Creating local tunnel...`));
  
  await createLocalTunnel(service, localPort, config, hubUrl);
}

/**
 * Create a local TCP server that tunnels to the remote service via the hub
 */
async function createLocalTunnel(
  service: Service,
  localPort: number,
  config: { agentId: string; token: string; hubUrl: string; apiKey: string; label: string },
  hubUrl: string,
) {
  // Connect to hub via WebSocket
  const socket = io(`${hubUrl}/agent`, {
    auth: {
      agentId: config.agentId,
      token: config.token,
    },
    transports: ['websocket'],
    reconnection: true,
  });

  const connections = new Map<string, { localSocket: net.Socket; ready: boolean }>();

  socket.on('connect', () => {
    console.log(chalk.green('  ✓ Connected to hub'));
  });

  socket.on('connect_error', (error) => {
    console.error(chalk.red(`  ✗ Connection error: ${error.message}`));
    process.exit(1);
  });

  // Handle connection ready from hub
  socket.on('reach_ready', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      conn.ready = true;
    }
  });

  // Handle data from hub (from the remote service)
  socket.on('reach_data', (data: { connectionId: string; data: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn && !conn.localSocket.destroyed) {
      const buffer = Buffer.from(data.data, 'base64');
      conn.localSocket.write(buffer);
    }
  });

  // Handle close from hub
  socket.on('reach_close', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      conn.localSocket.end();
      connections.delete(data.connectionId);
    }
  });

  // Handle error from hub
  socket.on('reach_error', (data: { connectionId: string; error: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      console.error(chalk.red(`  Connection error: ${data.error}`));
      conn.localSocket.end();
      connections.delete(data.connectionId);
    }
  });

  // Create local TCP server
  const server = net.createServer((localSocket) => {
    const connectionId = uuidv4();
    
    connections.set(connectionId, { localSocket, ready: false });

    // Request connection to the service through the hub
    socket.emit('reach_connect', {
      connectionId,
      serviceId: service.id,
    }, (response: { success: boolean; error?: string }) => {
      if (!response.success) {
        console.error(chalk.red(`  Failed to connect: ${response.error}`));
        localSocket.end();
        connections.delete(connectionId);
      }
    });

    // Forward local data to hub
    localSocket.on('data', (chunk) => {
      const conn = connections.get(connectionId);
      if (conn?.ready) {
        socket.emit('reach_data', {
          connectionId,
          data: chunk.toString('base64'),
        });
      }
    });

    localSocket.on('error', (err) => {
      socket.emit('reach_close', { connectionId });
      connections.delete(connectionId);
    });

    localSocket.on('close', () => {
      socket.emit('reach_close', { connectionId });
      connections.delete(connectionId);
    });
  });

  // Start listening
  return new Promise<void>((resolve, reject) => {
    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        console.error(chalk.red(`  ✗ Port ${localPort} is already in use`));
        console.log(chalk.gray(`    Try a different port with ${chalk.cyan(`--port <port>`)}`));
      } else {
        console.error(chalk.red(`  ✗ Server error: ${err.message}`));
      }
      socket.disconnect();
      reject(err);
    });

    server.listen(localPort, '127.0.0.1', () => {
      console.log(chalk.green(`  ✓ Listening on localhost:${localPort}`));
      console.log();
      console.log(chalk.green.bold(`  ✓ Connected to ${service.name} on localhost:${localPort}`));
      console.log();
      console.log(chalk.gray(`  You can now connect to the service at:`));
      console.log(chalk.cyan(`    localhost:${localPort}`));
      console.log();
      console.log(chalk.gray('  Press Ctrl+C to disconnect\n'));
      resolve();
    });
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Disconnecting...'));
    server.close();
    socket.disconnect();
    process.exit(0);
  });
}

/**
 * Reach a URL directly without going through the hub
 */
async function reachDirectUrl(urlString: string, options: ReachOptions, timeoutMs: number) {
  const url = new URL(urlString);
  const isHttps = url.protocol === 'https:';
  const host = url.hostname;
  const port = parseInt(url.port, 10) || (isHttps ? 443 : 80);
  const path = url.pathname || '/';

  if (!options.json) {
    console.log(chalk.gray(`  Target: ${host}:${port}`));
    console.log(chalk.gray(`  Protocol: ${isHttps ? 'HTTPS' : 'HTTP'}`));
    console.log();
    console.log(chalk.cyan('  Running diagnostics...'));
    console.log();
  }

  const result: DirectDiagnosticResult = {
    dnsStatus: 'UNKNOWN',
    tcpStatus: 'UNKNOWN',
    tlsStatus: undefined,
    tlsDetails: undefined,
    httpStatus: undefined,
    httpDetails: undefined,
    latencyMs: undefined,
    message: '',
  };

  // DNS Check
  const dns = await import('dns').then(m => m.promises);
  try {
    const addresses = await dns.lookup(host);
    result.dnsStatus = `OK (${addresses.address})`;
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    result.dnsStatus = 'FAIL';
    result.message = `DNS failed: ${e.code || e.message}`;
    displayDirectDiagnostics(result, urlString, options);
    return;
  }

  // TCP Check
  const netModule = await import('net');
  const startTime = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      const socket = netModule.createConnection({ host, port });
      const timeout = setTimeout(() => {
        socket.destroy();
        reject(new Error('timeout'));
      }, timeoutMs);

      socket.on('connect', () => {
        clearTimeout(timeout);
        socket.end();
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    result.tcpStatus = 'OK';
    result.latencyMs = Date.now() - startTime;
  } catch (err: unknown) {
    const e = err as Error & { code?: string };
    result.tcpStatus = 'FAIL';
    result.message = `TCP failed: ${e.code || e.message}`;
    displayDirectDiagnostics(result, urlString, options);
    return;
  }

  // TLS Check (for HTTPS)
  if (isHttps) {
    const tls = await import('tls');
    try {
      const tlsResult = await new Promise<TlsDetails>((resolve) => {
        const socket = tls.connect({
          host,
          port,
          servername: host,
          rejectUnauthorized: true,
        });

        const timeout = setTimeout(() => {
          socket.destroy();
          resolve({ valid: false, error: 'Connection timeout' });
        }, timeoutMs);

        socket.on('secureConnect', () => {
          clearTimeout(timeout);
          const cert = socket.getPeerCertificate();
          const authorized = socket.authorized;

          const details: TlsDetails = {
            valid: authorized,
            issuer: cert.issuer?.O || cert.issuer?.CN,
            subject: cert.subject?.CN,
            selfSigned: cert.issuer?.CN === cert.subject?.CN,
          };

          if (cert.valid_to) {
            const expiryDate = new Date(cert.valid_to);
            const now = new Date();
            details.daysUntilExpiry = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          }

          if (!authorized) {
            const authError = socket.authorizationError;
            details.error = authError ? formatTlsError(String(authError)) : 'Certificate validation failed';
          }

          socket.end();
          resolve(details);
        });

        socket.on('error', (err: Error & { code?: string }) => {
          clearTimeout(timeout);
          resolve({ valid: false, error: formatTlsError(err.code || err.message) });
        });
      });

      result.tlsStatus = tlsResult.valid ? 'OK' : 'FAIL';
      result.tlsDetails = tlsResult;
    } catch {
      result.tlsStatus = 'FAIL';
    }
  }

  // HTTP Check
  const httpModule = isHttps ? await import('https') : await import('http');
  try {
    const httpResult = await new Promise<HttpDetails>((resolve) => {
      const reqStartTime = Date.now();
      const req = httpModule.request({
        hostname: host,
        port,
        path,
        method: 'GET',
        timeout: timeoutMs,
        rejectUnauthorized: false,
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            statusMessage: res.statusMessage,
            responseTime: Date.now() - reqStartTime,
          });
        });
      });

      req.on('error', (err: Error & { code?: string }) => {
        resolve({ error: err.code || err.message });
      });

      req.on('timeout', () => {
        req.destroy();
        resolve({ error: 'Request timeout' });
      });

      req.end();
    });

    result.httpStatus = httpResult.statusCode && httpResult.statusCode < 500 ? 'OK' : 'FAIL';
    result.httpDetails = httpResult;
  } catch {
    result.httpStatus = 'FAIL';
  }

  // Set overall message
  if (result.tcpStatus === 'OK' && result.tlsStatus !== 'FAIL' && result.httpStatus !== 'FAIL') {
    result.message = 'OK';
  } else if (result.tlsStatus === 'FAIL' && result.tlsDetails?.error) {
    result.message = result.tlsDetails.error;
  } else if (result.httpStatus === 'FAIL' && result.httpDetails?.error) {
    result.message = result.httpDetails.error;
  }

  displayDirectDiagnostics(result, urlString, options);
}

interface DirectDiagnosticResult {
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus?: string;
  tlsDetails?: TlsDetails;
  httpStatus?: string;
  httpDetails?: HttpDetails;
  latencyMs?: number;
  message: string;
}

function formatTlsError(code: string): string {
  const errorMap: Record<string, string> = {
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE': 'Certificate signed by unknown authority',
    'SELF_SIGNED_CERT_IN_CHAIN': 'Self-signed certificate in chain',
    'DEPTH_ZERO_SELF_SIGNED_CERT': 'Self-signed certificate',
    'CERT_HAS_EXPIRED': 'Certificate has expired',
    'ERR_TLS_CERT_ALTNAME_INVALID': 'Certificate hostname mismatch',
    'HOSTNAME_MISMATCH': 'Certificate hostname mismatch',
  };
  return errorMap[code] || `TLS error: ${code}`;
}

function displayDirectDiagnostics(result: DirectDiagnosticResult, url: string, options: ReachOptions) {
  if (options.json) {
    console.log(JSON.stringify({
      success: result.tcpStatus === 'OK' && result.tlsStatus !== 'FAIL' && result.httpStatus !== 'FAIL',
      url,
      diagnostic: {
        ...result,
        tlsDetails: result.tlsDetails,
        httpDetails: result.httpDetails,
      },
    }, null, 2));
    return;
  }

  const isSuccess = result.tcpStatus === 'OK' && result.tlsStatus !== 'FAIL' && result.httpStatus !== 'FAIL';

  if (isSuccess) {
    console.log(chalk.green.bold('  ✓ REACHABLE'));
  } else {
    console.log(chalk.red.bold('  ✗ UNREACHABLE'));
  }
  console.log();

  // Diagnostic table
  console.log(chalk.white('  ┌─────────────────────────────────────────┐'));
  
  const dnsIcon = result.dnsStatus.includes('OK') ? chalk.green('✓') : chalk.red('✗');
  console.log(chalk.white('  │') + `  DNS     ${dnsIcon}  ${result.dnsStatus.includes('OK') ? chalk.green(result.dnsStatus) : chalk.red(result.dnsStatus)}`.padEnd(52) + chalk.white('│'));
  
  const tcpIcon = result.tcpStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
  console.log(chalk.white('  │') + `  TCP     ${tcpIcon}  ${result.tcpStatus === 'OK' ? chalk.green('OK') : chalk.red(result.tcpStatus)}`.padEnd(52) + chalk.white('│'));
  
  if (result.tlsStatus) {
    const tlsIcon = result.tlsStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
    console.log(chalk.white('  │') + `  TLS     ${tlsIcon}  ${result.tlsStatus === 'OK' ? chalk.green('OK') : chalk.red('FAIL')}`.padEnd(52) + chalk.white('│'));
  }

  if (result.httpStatus) {
    const httpIcon = result.httpStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
    let httpDisplay = result.httpStatus === 'OK' ? chalk.green('OK') : chalk.red('FAIL');
    if (result.httpDetails?.statusCode) {
      const sc = result.httpDetails.statusCode;
      httpDisplay = sc < 400 ? chalk.green(`${sc} ${result.httpDetails.statusMessage || ''}`.trim()) : chalk.red(`${sc}`);
    }
    console.log(chalk.white('  │') + `  HTTP    ${httpIcon}  ${httpDisplay}`.padEnd(52) + chalk.white('│'));
  }

  if (result.latencyMs) {
    const latencyColor = result.latencyMs < 50 ? chalk.green : result.latencyMs < 200 ? chalk.yellow : chalk.red;
    console.log(chalk.white('  │') + `  Latency    ${latencyColor(result.latencyMs + 'ms')}`.padEnd(52) + chalk.white('│'));
  }

  console.log(chalk.white('  └─────────────────────────────────────────┘'));

  if (result.tlsDetails && (result.tlsDetails.error || result.tlsDetails.selfSigned || 
      (result.tlsDetails.daysUntilExpiry !== undefined && result.tlsDetails.daysUntilExpiry < 30))) {
    console.log();
    console.log(chalk.white('  🔒 TLS Certificate'));
    if (result.tlsDetails.subject) console.log(chalk.gray(`     Subject: ${result.tlsDetails.subject}`));
    if (result.tlsDetails.issuer) console.log(chalk.gray(`     Issuer: ${result.tlsDetails.issuer}`));
    if (result.tlsDetails.daysUntilExpiry !== undefined) {
      const days = result.tlsDetails.daysUntilExpiry;
      const expiryColor = days < 0 ? chalk.red : days < 30 ? chalk.yellow : chalk.green;
      console.log(chalk.gray(`     Expires: `) + expiryColor(`${days} days`));
    }
    if (result.tlsDetails.selfSigned) console.log(chalk.yellow(`     ⚠ Self-signed certificate`));
    if (result.tlsDetails.error) console.log(chalk.red(`     ✗ ${result.tlsDetails.error}`));
  }

  console.log();

  if (result.message && result.message !== 'OK') {
    console.log(chalk.yellow(`  ⚠ ${result.message}`));
    console.log();
  }

  if (isSuccess) {
    console.log(chalk.green(`  ${url} is reachable.`));
  } else {
    console.log(chalk.red(`  ${url} is not reachable.`));
  }

  console.log();
}

async function findService(name: string, hubUrl: string, apiKey: string): Promise<Service | null> {
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) {
      throw new Error(`Failed to fetch services: ${response.status}`);
    }
    
    const services = await response.json() as Service[];
    return services.find(s => s.name === name) || null;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`  ✗ Failed to connect to hub: ${err.message}`));
    return null;
  }
}

async function listServices(hubUrl: string, apiKey: string) {
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': apiKey },
    });
    if (!response.ok) return;
    
    const services = await response.json() as Service[];
    if (services.length === 0) {
      console.log(chalk.gray('    (no services registered)'));
    } else {
      services.forEach(s => {
        const status = s.status === 'OK' ? chalk.green('●') : 
                       s.status === 'FAIL' ? chalk.red('●') : 
                       chalk.gray('●');
        console.log(chalk.gray(`    ${status} ${s.name}`));
      });
    }
  } catch {
    // Silently fail
  }
}

async function runReachCheck(
  serviceId: string,
  sourceAgentId: string,
  timeoutMs: number,
  hubUrl: string,
  apiKey: string,
): Promise<DiagnosticResult | null> {
  try {
    const response = await fetch(`${hubUrl}/v1/services/${serviceId}/reach`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        sourceAgentId,
        mode: 'tcp',
        timeoutMs,
      }),
    });
    
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    
    const data = await response.json() as { diagnostic: DiagnosticResult };
    return data.diagnostic;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`  ✗ Reach check failed: ${err.message}`));
    return null;
  }
}

function displayDiagnostics(result: DiagnosticResult, service: Service, sourceLabel: string) {
  const isSuccess = result.tcpStatus === 'OK' && 
                    result.tlsStatus !== 'FAIL' && 
                    result.httpStatus !== 'FAIL';
  
  if (isSuccess) {
    console.log(chalk.green.bold('  ✓ REACHABLE'));
  } else {
    console.log(chalk.red.bold('  ✗ UNREACHABLE'));
  }
  console.log();

  console.log(chalk.white('  ┌─────────────────────────────────────────┐'));
  
  const dnsIcon = result.dnsStatus.includes('OK') ? chalk.green('✓') : chalk.red('✗');
  console.log(chalk.white('  │') + `  DNS     ${dnsIcon}  ${formatStatus(result.dnsStatus)}`.padEnd(42) + chalk.white('│'));
  
  const tcpIcon = result.tcpStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
  console.log(chalk.white('  │') + `  TCP     ${tcpIcon}  ${formatStatus(result.tcpStatus)}`.padEnd(42) + chalk.white('│'));
  
  if (result.tlsStatus) {
    const tlsIcon = result.tlsStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
    console.log(chalk.white('  │') + `  TLS     ${tlsIcon}  ${formatStatus(result.tlsStatus)}`.padEnd(42) + chalk.white('│'));
  }

  if (result.httpStatus) {
    const httpIcon = result.httpStatus === 'OK' ? chalk.green('✓') : chalk.red('✗');
    let httpDisplay = formatStatus(result.httpStatus);
    
    if (result.httpDetails) {
      try {
        const details = JSON.parse(result.httpDetails) as HttpDetails;
        if (details.statusCode) {
          httpDisplay = details.statusCode < 400 
            ? chalk.green(`${details.statusCode} ${details.statusMessage || ''}`.trim())
            : chalk.red(`${details.statusCode} ${details.statusMessage || ''}`.trim());
        }
      } catch { /* ignore */ }
    }
    console.log(chalk.white('  │') + `  HTTP    ${httpIcon}  ${httpDisplay}`.padEnd(42) + chalk.white('│'));
  }
  
  if (result.latencyMs !== undefined && result.latencyMs !== null) {
    const latencyColor = result.latencyMs < 50 ? chalk.green : result.latencyMs < 200 ? chalk.yellow : chalk.red;
    console.log(chalk.white('  │') + `  Latency    ${latencyColor(result.latencyMs + 'ms')}`.padEnd(42) + chalk.white('│'));
  }

  console.log(chalk.white('  │') + `  From       ${chalk.cyan(sourceLabel)}`.padEnd(42) + chalk.white('│'));
  
  console.log(chalk.white('  └─────────────────────────────────────────┘'));

  if (result.tlsDetails) {
    try {
      const tlsDetails = JSON.parse(result.tlsDetails) as TlsDetails;
      if (tlsDetails.error || tlsDetails.selfSigned || (tlsDetails.daysUntilExpiry !== undefined && tlsDetails.daysUntilExpiry < 30)) {
        console.log();
        console.log(chalk.white('  🔒 TLS Certificate'));
        if (tlsDetails.subject) console.log(chalk.gray(`     Subject: ${tlsDetails.subject}`));
        if (tlsDetails.issuer) console.log(chalk.gray(`     Issuer: ${tlsDetails.issuer}`));
        if (tlsDetails.daysUntilExpiry !== undefined) {
          const expiryColor = tlsDetails.daysUntilExpiry < 0 ? chalk.red : 
                              tlsDetails.daysUntilExpiry < 30 ? chalk.yellow : chalk.green;
          console.log(chalk.gray(`     Expires: `) + expiryColor(`${tlsDetails.daysUntilExpiry} days`));
        }
        if (tlsDetails.selfSigned) console.log(chalk.yellow(`     ⚠ Self-signed certificate`));
        if (tlsDetails.error) console.log(chalk.red(`     ✗ ${tlsDetails.error}`));
      }
    } catch { /* ignore */ }
  }

  console.log();

  if (result.message && result.message !== 'OK') {
    console.log(chalk.yellow(`  ⚠ ${result.message}`));
    console.log();
  }
}

function formatStatus(status: string): string {
  if (status === 'OK') return chalk.green('OK');
  if (status === 'FAIL') return chalk.red('FAIL');
  if (status.includes('OK')) return chalk.green(status);
  if (status.includes('FAIL')) return chalk.red(status);
  return chalk.gray(status);
}
