import * as http from 'http';
import * as http2 from 'http2';
import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { findAvailablePort, isPortAvailable, getPortUser, killProcess, isProcessRunning } from '../ports';
import { loadActiveRoutes, getActiveRoutesPath, ActiveRoute } from '../active-routes';
import { ensureCerts, isCATrusted, trustCA, loadTLSOptions } from '../certs';
import {
  writeProxyState, clearProxyState, readProxyState,
  getProxyLogPath, getProxyHeader,
  getDefaultProxyPort, isProxyResponding, waitForProxy,
} from '../proxy-state';
import { getLanIP, getLanHostname, startMdnsResponder, type MdnsResponder } from '../lan';
import { syncHosts, cleanHosts } from '../hosts';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ProxyOptions {
  port: number;
  hub: string;
  config?: string;
  replace?: boolean;
  https?: boolean;
  cert?: string;
  key?: string;
  trust?: boolean;
  foreground?: boolean;
  lan?: boolean;
  wildcard?: boolean;
}

interface Service {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort: number | null;
  status: string;
  protocol: string;
}

interface RouteTarget {
  name: string;
  host: string;
  port: number;
  source: 'hub' | 'local';
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function tryKillPortProcess(port: number): Promise<boolean> {
  const portUser = getPortUser(port);
  if (!portUser) return false;

  if (!portUser.command.includes('node') && !portUser.command.includes('connect')) {
    return false;
  }

  killProcess(portUser.pid, 'SIGTERM');

  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!isProcessRunning(portUser.pid)) return true;
  }

  killProcess(portUser.pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 200));
  return !isProcessRunning(portUser.pid);
}

function buildForwardedHeaders(req: http.IncomingMessage, isTls: boolean): Record<string, string> {
  const remote = req.socket.remoteAddress || '127.0.0.1';
  const proto = isTls ? 'https' : 'http';
  const host = req.headers.host || '';
  const defaultPort = isTls ? '443' : '80';

  return {
    'x-forwarded-for': req.headers['x-forwarded-for']
      ? `${req.headers['x-forwarded-for']}, ${remote}`
      : remote,
    'x-forwarded-proto': (req.headers['x-forwarded-proto'] as string) || proto,
    'x-forwarded-host': (req.headers['x-forwarded-host'] as string) || host,
    'x-forwarded-port': (req.headers['x-forwarded-port'] as string) || host.split(':')[1] || defaultPort,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Resolution
// ─────────────────────────────────────────────────────────────────────────────

function buildRouteTable(
  hubServices: Service[],
  activeRoutes: ActiveRoute[],
): Map<string, RouteTarget> {
  const table = new Map<string, RouteTarget>();

  for (const s of hubServices) {
    if (s.tunnelPort) {
      table.set(s.name.toLowerCase(), {
        name: s.name,
        host: '127.0.0.1',
        port: s.tunnelPort,
        source: 'hub',
      });
    }
  }

  for (const r of activeRoutes) {
    table.set(r.serviceName.toLowerCase(), {
      name: r.serviceName,
      host: '127.0.0.1',
      port: r.localPort,
      source: 'local',
    });
  }

  return table;
}

function findRoute(routes: Map<string, RouteTarget>, hostname: string, wildcard = false): RouteTarget | null {
  const labels = hostname.split(':')[0].toLowerCase().split('.');
  const exact = routes.get(labels[0]);
  if (exact) return exact;
  // Wildcard: tenant.myapp.localhost → fall back to the "myapp" route
  if (wildcard && labels.length > 2) {
    return routes.get(labels[1]) || null;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Proxy Command - Dispatcher
// ─────────────────────────────────────────────────────────────────────────────

export async function proxyCommand(action: string | undefined, options: ProxyOptions) {
  switch (action) {
    case 'start':
      return startProxy(options);
    case 'stop':
      return stopProxy();
    case 'status':
      return statusProxy();
    case 'trust':
      return handleTrust();
    default:
      // Bare `connect proxy` defaults to start
      return startProxy(options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Start (daemon or foreground)
// ─────────────────────────────────────────────────────────────────────────────

async function startProxy(options: ProxyOptions) {
  const config = loadConfig();

  if (options.trust) {
    return handleTrust();
  }

  const isForeground = !!options.foreground || process.env.CONNECT_PROXY_FOREGROUND === '1';
  const wantLan = !!options.lan;
  const wantHttps = !!options.https || !!options.cert || wantLan;

  // Check if already running
  const existing = readProxyState();
  if (existing.running && existing.port) {
    if (await isProxyResponding(existing.port, existing.tls)) {
      if (isForeground) return; // Internal fork; exit silently
      console.log(chalk.yellow(`\n[!] Proxy is already running on port ${existing.port}`));
      console.log(chalk.gray(`  Stop it first: ${chalk.cyan('connect proxy stop')}\n`));
      return;
    }
    // PID alive but not responding — stale state
    clearProxyState();
  }

  // ── Daemon mode (default): fork and detach ─────────────────────────────

  if (!isForeground) {
    console.log(chalk.cyan('\n🌐 Starting proxy...\n'));

    const proxyPort = options.port || getDefaultProxyPort();
    const logPath = getProxyLogPath();
    const dir = path.dirname(logPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    const logFd = fs.openSync(logPath, 'a');
    try {
      const daemonArgs = [process.argv[1], 'proxy', 'start', '--foreground'];
      daemonArgs.push('--port', proxyPort.toString());
      if (wantHttps) {
        if (options.cert && options.key) {
          daemonArgs.push('--cert', options.cert, '--key', options.key);
        } else {
          daemonArgs.push('--https');
        }
      }
      if (wantLan) daemonArgs.push('--lan');
      if (options.wildcard) daemonArgs.push('--wildcard');

      const child = spawn(process.execPath, daemonArgs, {
        detached: true,
        stdio: ['ignore', logFd, logFd],
        env: { ...process.env, CONNECT_PROXY_FOREGROUND: '1' },
      });
      child.unref();
    } finally {
      fs.closeSync(logFd);
    }

    // Wait for it to come up
    if (!(await waitForProxy(proxyPort, wantHttps))) {
      console.error(chalk.red('[x] Proxy failed to start (timed out).'));
      console.error(chalk.gray(`  Try foreground mode to see the error:`));
      console.error(chalk.cyan(`    connect proxy start --foreground`));
      if (fs.existsSync(logPath)) {
        console.error(chalk.gray(`  Logs: ${logPath}`));
      }
      process.exit(1);
    }

    const proto = wantHttps ? 'HTTPS' : 'HTTP';
    console.log(chalk.green(`[ok] ${proto} proxy started on port ${proxyPort}`));
    console.log(chalk.gray(`  Logs: ${logPath}`));
    console.log(chalk.gray(`  Stop: ${chalk.cyan('connect proxy stop')}\n`));
    return;
  }

  // ── Foreground mode ────────────────────────────────────────────────────

  const hubUrl = config?.hubUrl || options.hub;
  const preferredPort = options.port || getDefaultProxyPort();

  console.log(chalk.cyan('\n🌐 Starting subdomain proxy...\n'));
  if (hubUrl) console.log(chalk.gray(`  Hub:  ${hubUrl}`));

  // Port selection
  let actualPort = preferredPort;
  let wasAutoSelected = false;

  if (!(await isPortAvailable(preferredPort))) {
    if (options.replace) {
      console.log(chalk.yellow(`  [!] Port ${preferredPort} in use, attempting to take over...`));
      const killed = await tryKillPortProcess(preferredPort);
      if (killed) {
        console.log(chalk.green(`  [ok] Killed existing process`));
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    if (!(await isPortAvailable(preferredPort))) {
      const alternativePort = await findAvailablePort(preferredPort + 1);
      if (alternativePort) {
        actualPort = alternativePort;
        wasAutoSelected = true;
        console.log(chalk.yellow(`  [!] Port ${preferredPort} in use, using ${actualPort} instead`));
      } else {
        console.error(chalk.red(`\n[x] Port ${preferredPort} is in use and no alternatives available`));
        process.exit(1);
      }
    }
  }

  console.log(chalk.gray(`  Port: ${actualPort}${wasAutoSelected ? chalk.yellow(' (auto-selected)') : ''}`));

  // LAN mode setup
  let lanIP: string | null = null;
  let lanHostname: string | null = null;
  let mdnsResponder: MdnsResponder | null = null;

  if (wantLan) {
    lanIP = getLanIP();
    if (!lanIP) {
      console.error(chalk.red('\n[x] Could not detect a LAN IP address.'));
      console.error(chalk.gray('  Make sure you are connected to a Wi-Fi or Ethernet network.\n'));
      process.exit(1);
    }
    lanHostname = getLanHostname();
    console.log(chalk.gray(`  LAN:  ${lanIP} (${lanHostname})`));
  }

  // TLS setup
  let tlsOptions: { cert: Buffer; key: Buffer } | null = null;

  if (wantHttps) {
    if (options.cert && options.key) {
      try {
        tlsOptions = { cert: fs.readFileSync(options.cert), key: fs.readFileSync(options.key) };
        console.log(chalk.gray(`  TLS:  custom certs`));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(chalk.red(`[x] Failed to read certificate files: ${msg}`));
        process.exit(1);
      }
    } else {
      const sanLabel = wantLan ? 'auto-generating certificates (LAN)...' : 'auto-generating certificates...';
      console.log(chalk.gray(`  TLS:  ${sanLabel}`));
      const extraSANs = wantLan && lanHostname && lanIP ? {
        dnsNames: [`*.${lanHostname}`, lanHostname],
        ips: [lanIP],
      } : undefined;
      const result = ensureCerts(extraSANs);
      if (result.caGenerated) console.log(chalk.green(`  [ok] Generated local CA`));
      if (result.serverGenerated) console.log(chalk.green(`  [ok] Generated server certificate`));

      if (!isCATrusted()) {
        console.log(chalk.yellow(`  [!] Adding CA to system trust store...`));
        const trustResult = trustCA();
        if (trustResult.trusted) {
          console.log(chalk.green(`  [ok] CA trusted — no browser warnings`));
        } else {
          console.warn(chalk.yellow(`  [!] Could not auto-trust CA: ${trustResult.error || 'unknown'}`));
          console.warn(chalk.gray(`      Fix later with: ${chalk.cyan('connect proxy trust')}`));
        }
      }

      tlsOptions = loadTLSOptions();
      if (!tlsOptions) {
        console.error(chalk.red(`[x] TLS certificates not found after generation.`));
        process.exit(1);
      }
    }
  }

  console.log();

  // Start mDNS responder for LAN mode
  if (wantLan && lanIP && lanHostname) {
    try {
      mdnsResponder = startMdnsResponder(lanHostname, lanIP);
      console.log(chalk.green(`[ok] mDNS: ${lanHostname} \u2192 ${lanIP}`));
    } catch {
      console.warn(chalk.yellow('[!] Could not start mDNS responder. Devices can still connect via IP.'));
    }
    console.log();
  }

  // Service + route state
  let hubServices: Service[] = [];
  let activeRoutes: ActiveRoute[] = [];
  let routes: Map<string, RouteTarget> = new Map();

  const refreshAll = async () => {
    if (config?.apiKey && hubUrl) {
      try {
        const response = await fetch(`${hubUrl}/v1/services`, {
          headers: { 'x-api-key': config.apiKey },
        });
        if (response.ok) hubServices = await response.json() as Service[];
      } catch { /* keep cached */ }
    }

    activeRoutes = loadActiveRoutes();
    routes = buildRouteTable(hubServices, activeRoutes);
  };

  await refreshAll();

  const totalRoutes = routes.size;
  if (totalRoutes === 0) {
    console.log(chalk.yellow('[!] No services found. Expose or reach some services first.'));
  } else {
    console.log(chalk.green(`[ok] Found ${totalRoutes} route(s):`));
    for (const r of routes.values()) {
      const src = r.source === 'local' ? chalk.blue('reach') : chalk.gray('hub');
      console.log(chalk.gray(`  • ${r.name} → 127.0.0.1:${r.port} [${src}]`));
    }
  }
  console.log();

  // Sync /etc/hosts for Safari compatibility (best-effort, non-interactive)
  if (routes.size > 0) {
    const hostEntries = Array.from(routes.values()).map(r => ({
      hostname: `${r.name}.localhost`,
      ip: '127.0.0.1',
    }));
    const hostsResult = syncHosts(hostEntries);
    if (hostsResult.synced) {
      console.log(chalk.green('[ok] /etc/hosts synced'));
    }
  }

  const hubRefreshInterval = setInterval(refreshAll, 10000);

  // Watch active-routes file
  const routesPath = getActiveRoutesPath();
  let routeWatcher: fs.FSWatcher | null = null;
  let routeDebounce: ReturnType<typeof setTimeout> | null = null;

  try {
    const routesDir = path.dirname(routesPath);
    if (fs.existsSync(routesDir)) {
      routeWatcher = fs.watch(routesDir, (_event: string, filename: string | null) => {
        if (filename === 'active-routes.json') {
          if (routeDebounce) clearTimeout(routeDebounce);
          routeDebounce = setTimeout(async () => {
            activeRoutes = loadActiveRoutes();
            routes = buildRouteTable(hubServices, activeRoutes);
          }, 100);
        }
      });
    }
  } catch { /* fallback to polling */ }

  // Request handling
  const isTls = !!tlsOptions;
  const proto = isTls ? 'https' : 'http';
  const headerName = getProxyHeader();
  const useWildcard = !!options.wildcard;

  const handleRequest = (req: http.IncomingMessage, res: http.ServerResponse) => {
    res.setHeader(headerName, '1');

    // Loop detection — request already passed through this proxy
    if (req.headers[headerName]) {
      res.writeHead(508, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Loop Detected',
        message: 'Request already passed through this proxy. Check your dev server proxy config \u2014 set changeOrigin: true.',
      }));
      return;
    }

    const host = req.headers.host || '';
    const route = findRoute(routes, host, useWildcard);

    if (!route) {
      const subdomain = host.split('.')[0];
      const domain = lanHostname || 'localhost';
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Service not found',
        subdomain,
        available: Array.from(routes.values()).map(r => r.name),
        hint: `Try: ${proto}://${Array.from(routes.values())[0]?.name || 'my-service'}.${domain}:${actualPort}`,
      }, null, 2));
      return;
    }

    const forwardedHeaders = buildForwardedHeaders(req, isTls);

    const proxyReq = http.request({
      hostname: route.host,
      port: route.port,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, ...forwardedHeaders, [headerName]: '1' },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      if (!res.headersSent) {
        const errWithCode = err as NodeJS.ErrnoException;
        const message = errWithCode.code === 'ECONNREFUSED'
          ? 'Bad Gateway: the service is not responding.'
          : `Bad Gateway: ${err.message}`;
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message, service: route.name }));
      }
    });

    res.on('close', () => { if (!proxyReq.destroyed) proxyReq.destroy(); });
    req.pipe(proxyReq);
  };

  const handleUpgrade = (req: http.IncomingMessage, socket: net.Socket, head: Buffer) => {
    if (req.headers[headerName]) {
      socket.write('HTTP/1.1 508 Loop Detected\r\n\r\n');
      socket.destroy();
      return;
    }

    const host = req.headers.host || '';
    const route = findRoute(routes, host, useWildcard);

    if (!route) { socket.write('HTTP/1.1 404 Not Found\r\n\r\n'); socket.destroy(); return; }

    const proxyReq = http.request({
      hostname: route.host, port: route.port,
      path: req.url, method: req.method,
      headers: { ...req.headers, [headerName]: '1' },
    });

    proxyReq.on('upgrade', (proxyRes, proxySocket, proxyHead) => {
      let response = 'HTTP/1.1 101 Switching Protocols\r\n';
      for (let i = 0; i < proxyRes.rawHeaders.length; i += 2) {
        response += `${proxyRes.rawHeaders[i]}: ${proxyRes.rawHeaders[i + 1]}\r\n`;
      }
      response += '\r\n';
      socket.write(response);
      if (proxyHead.length > 0) socket.write(proxyHead);
      proxySocket.pipe(socket);
      socket.pipe(proxySocket);
      proxySocket.on('error', () => socket.destroy());
      socket.on('error', () => proxySocket.destroy());
    });

    proxyReq.on('error', () => socket.destroy());
    proxyReq.on('response', (res) => {
      if (!socket.destroyed) {
        let response = `HTTP/1.1 ${res.statusCode} ${res.statusMessage}\r\n`;
        for (let i = 0; i < res.rawHeaders.length; i += 2) {
          response += `${res.rawHeaders[i]}: ${res.rawHeaders[i + 1]}\r\n`;
        }
        response += '\r\n';
        socket.write(response);
        res.pipe(socket);
      }
    });

    if (head.length > 0) proxyReq.write(head);
    proxyReq.end();
  };

  const handleConnect = (req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) => {
    if (req.headers[headerName]) {
      clientSocket.write('HTTP/1.1 508 Loop Detected\r\n\r\n');
      clientSocket.destroy();
      return;
    }

    const [hostname] = (req.url || '').split(':');
    const route = findRoute(routes, hostname, useWildcard);

    if (!route) { clientSocket.write('HTTP/1.1 404 Not Found\r\n\r\n'); clientSocket.destroy(); return; }

    const proxySocket = net.createConnection({ host: route.host, port: route.port }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      if (head.length > 0) proxySocket.write(head);
      clientSocket.pipe(proxySocket);
      proxySocket.pipe(clientSocket);
    });

    proxySocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => proxySocket.destroy());
  };

  // Server creation — HTTP/2 when TLS is active (with HTTP/1.1 fallback)
  let server: http.Server | http2.Http2SecureServer;
  if (tlsOptions) {
    server = http2.createSecureServer(
      { cert: tlsOptions.cert, key: tlsOptions.key, allowHTTP1: true },
      handleRequest as any,
    );
  } else {
    server = http.createServer(handleRequest);
  }

  server.on('upgrade', handleUpgrade);
  server.on('connect', handleConnect);

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`\n[x] Port ${actualPort} is already in use`));
      console.error(chalk.gray(`  Try: ${chalk.cyan(`connect proxy start --port ${actualPort + 1}`)}`));
    } else {
      console.error(chalk.red(`\n[x] Server error: ${err.message}\n`));
    }
    process.exit(1);
  });

  server.listen(actualPort, wantLan ? '0.0.0.0' : '127.0.0.1', () => {
    writeProxyState(process.pid, actualPort, isTls);

    const label = isTls ? 'HTTPS' : 'HTTP';
    console.log(chalk.green.bold(`[ok] ${label} proxy running on port ${actualPort}\n`));

    if (wantLan && lanHostname) {
      console.log(chalk.white('  From this machine:'));
      if (routes.size > 0) {
        for (const r of routes.values()) {
          console.log(chalk.gray(`    ${proto}://${r.name}.localhost:${actualPort}`));
        }
      } else {
        console.log(chalk.gray(`    ${proto}://<service-name>.localhost:${actualPort}`));
      }
      console.log();
      console.log(chalk.white('  From other devices on your network:'));
      if (routes.size > 0) {
        for (const r of routes.values()) {
          console.log(chalk.cyan(`    ${proto}://${r.name}.${lanHostname}:${actualPort}`));
        }
      } else {
        console.log(chalk.gray(`    ${proto}://<service-name>.${lanHostname}:${actualPort}`));
      }
    } else {
      console.log(chalk.white('  Access your services via subdomains:'));
      console.log();
      if (routes.size > 0) {
        for (const r of routes.values()) {
          console.log(chalk.cyan(`    ${proto}://${r.name}.localhost:${actualPort}`));
        }
      } else {
        console.log(chalk.gray(`    ${proto}://<service-name>.localhost:${actualPort}`));
      }
    }

    console.log();
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
  });

  // Shutdown
  let exiting = false;
  const cleanup = () => {
    if (exiting) return;
    exiting = true;
    clearInterval(hubRefreshInterval);
    if (routeDebounce) clearTimeout(routeDebounce);
    if (routeWatcher) routeWatcher.close();
    if (mdnsResponder) mdnsResponder.stop();
    cleanHosts();
    clearProxyState();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 2000).unref();
  };

  process.on('SIGINT', () => { console.log(chalk.yellow('\n👋 Stopping proxy...')); cleanup(); });
  process.on('SIGTERM', cleanup);
}

// ─────────────────────────────────────────────────────────────────────────────
// Stop
// ─────────────────────────────────────────────────────────────────────────────

async function stopProxy() {
  const state = readProxyState();

  if (!state.running || !state.pid) {
    console.log(chalk.yellow('\n[!] Proxy is not running.\n'));
    return;
  }

  try {
    process.kill(state.pid, 'SIGTERM');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    if (e.code === 'ESRCH') {
      console.log(chalk.yellow('\n[!] Proxy process already gone. Cleaning up.\n'));
      clearProxyState();
      return;
    }
    throw err;
  }

  // Wait for graceful exit
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 200));
    try { process.kill(state.pid, 0); } catch {
      // Process is gone
      clearProxyState();
      console.log(chalk.green('\n[ok] Proxy stopped.\n'));
      return;
    }
  }

  // Force kill
  try { process.kill(state.pid, 'SIGKILL'); } catch { /* already gone */ }
  clearProxyState();
  console.log(chalk.green('\n[ok] Proxy stopped (forced).\n'));
}

// ─────────────────────────────────────────────────────────────────────────────
// Status
// ─────────────────────────────────────────────────────────────────────────────

async function statusProxy() {
  const state = readProxyState();

  console.log(chalk.cyan('\n🌐 Proxy Status\n'));

  if (!state.running) {
    console.log(chalk.red('  ○ Proxy: stopped'));
    console.log(chalk.gray(`\n  Start with: ${chalk.cyan('connect proxy start')}\n`));
    return;
  }

  const responding = state.port ? await isProxyResponding(state.port, state.tls) : false;

  if (responding) {
    console.log(chalk.green(`  ● Proxy: running (PID ${state.pid})`));
  } else {
    console.log(chalk.yellow(`  ● Proxy: running but not responding (PID ${state.pid})`));
  }

  console.log(chalk.gray(`    Port: ${state.port}`));
  console.log(chalk.gray(`    TLS:  ${state.tls ? 'enabled' : 'disabled'}`));

  // Show active routes
  const activeRoutes = loadActiveRoutes();
  if (activeRoutes.length > 0) {
    const proto = state.tls ? 'https' : 'http';
    console.log(chalk.gray(`    Routes:`));
    for (const r of activeRoutes) {
      console.log(chalk.cyan(`      ${proto}://${r.serviceName}.localhost:${state.port}`));
    }
  }

  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Trust
// ─────────────────────────────────────────────────────────────────────────────

function handleTrust() {
  console.log(chalk.cyan('\n🔒 Trusting Private Connect local CA...\n'));

  const result = ensureCerts();
  if (result.caGenerated) console.log(chalk.green('  [ok] Generated local CA certificate'));

  const trustResult = trustCA();
  if (trustResult.trusted) {
    console.log(chalk.green('  [ok] CA added to system trust store'));
    console.log(chalk.gray('  Browsers will now trust Private Connect HTTPS certificates.\n'));
  } else {
    console.error(chalk.red(`  [x] Failed to trust CA: ${trustResult.error}`));
    if (trustResult.error?.includes('sudo') || trustResult.error?.includes('Permission')) {
      console.log(chalk.gray(`  Try: ${chalk.cyan('sudo connect proxy trust')}\n`));
    }
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Auto-start (called from reach)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Ensure the proxy is running. If not, auto-start it as a daemon.
 * Returns the proxy state after starting.
 */
export async function ensureProxyRunning(options?: { https?: boolean }): Promise<{ port: number; tls: boolean } | null> {
  const state = readProxyState();
  if (state.running && state.port) {
    if (await isProxyResponding(state.port, state.tls)) {
      return { port: state.port, tls: state.tls || false };
    }
    clearProxyState();
  }

  // Auto-start
  const port = getDefaultProxyPort();
  const wantHttps = !!options?.https;
  const logPath = getProxyLogPath();
  const dir = path.dirname(logPath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  const logFd = fs.openSync(logPath, 'a');
  try {
    const daemonArgs = [process.argv[1], 'proxy', 'start', '--foreground', '--port', port.toString()];
    if (wantHttps) daemonArgs.push('--https');

    const child = spawn(process.execPath, daemonArgs, {
      detached: true,
      stdio: ['ignore', logFd, logFd],
      env: { ...process.env, CONNECT_PROXY_FOREGROUND: '1' },
    });
    child.unref();
  } finally {
    fs.closeSync(logFd);
  }

  if (await waitForProxy(port, wantHttps)) {
    return { port, tls: wantHttps };
  }

  return null;
}
