import * as http from 'http';
import * as net from 'net';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { findAvailablePort, isPortAvailable, getPortUser, killProcess, isProcessRunning } from '../ports';

/**
 * Try to kill the process using a port
 */
async function tryKillPortProcess(port: number): Promise<boolean> {
  const portUser = getPortUser(port);
  if (!portUser) return false;
  
  // Only kill if it looks like a Private Connect process
  if (!portUser.command.includes('node') && !portUser.command.includes('connect')) {
    return false;
  }
  
  killProcess(portUser.pid, 'SIGTERM');
  
  // Wait for graceful shutdown
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!isProcessRunning(portUser.pid)) {
      return true;
    }
  }
  
  // Force kill if still running
  killProcess(portUser.pid, 'SIGKILL');
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return !isProcessRunning(portUser.pid);
}

interface ProxyOptions {
  port: number;
  hub: string;
  config?: string;
  replace?: boolean;
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

export async function proxyCommand(options: ProxyOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('✗ Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;
  const preferredPort = options.port;
  
  console.log(chalk.cyan('\n🌐 Starting subdomain proxy...\n'));
  console.log(chalk.gray(`  Hub:  ${hubUrl}`));
  
  // Check if preferred port is available
  let actualPort = preferredPort;
  let wasAutoSelected = false;
  
  if (!(await isPortAvailable(preferredPort))) {
    if (options.replace) {
      // Try to kill the existing process on this port
      console.log(chalk.yellow(`  ⚠ Port ${preferredPort} in use, attempting to take over...`));
      const killed = await tryKillPortProcess(preferredPort);
      if (killed) {
        console.log(chalk.green(`  ✓ Killed existing process`));
        // Wait for port to become available
        await new Promise(resolve => setTimeout(resolve, 500));
      } else {
        console.log(chalk.red(`  ✗ Could not kill existing process`));
      }
    }
    
    // Check again after potential kill
    if (!(await isPortAvailable(preferredPort))) {
      const alternativePort = await findAvailablePort(preferredPort + 1);
      if (alternativePort) {
        actualPort = alternativePort;
        wasAutoSelected = true;
        console.log(chalk.yellow(`  ⚠ Port ${preferredPort} in use, using ${actualPort} instead`));
      } else {
        console.error(chalk.red(`\n✗ Port ${preferredPort} is in use and no alternatives available`));
        console.log(chalk.gray(`  Try: ${chalk.cyan(`connect proxy --port ${preferredPort + 100}`)}`));
        console.log(chalk.gray(`  Or:  ${chalk.cyan(`connect proxy --replace`)} to take over\n`));
        process.exit(1);
      }
    }
  }
  
  console.log(chalk.gray(`  Port: ${actualPort}${wasAutoSelected ? chalk.yellow(' (auto-selected)') : ''}`));
  console.log();

  // Fetch initial service list
  let services: Service[] = [];
  
  const refreshServices = async () => {
    try {
      const response = await fetch(`${hubUrl}/v1/services`, {
        headers: { 'x-api-key': config.apiKey },
      });
      if (response.ok) {
        services = await response.json() as Service[];
      }
    } catch (err) {
      // Silently fail, keep using cached services
    }
  };

  await refreshServices();
  
  if (services.length === 0) {
    console.log(chalk.yellow('⚠ No services found. Expose some services first:'));
    console.log(chalk.gray(`  ${chalk.cyan('connect expose localhost:8080 --name my-api')}\n`));
  } else {
    console.log(chalk.green(`✓ Found ${services.length} service(s):`));
    services.forEach(s => {
      const tunnelInfo = s.tunnelPort ? `:${s.tunnelPort}` : ' (external)';
      console.log(chalk.gray(`  • ${s.name} → ${s.targetHost}:${s.targetPort}${tunnelInfo}`));
    });
    console.log();
  }

  // Refresh services periodically
  const refreshInterval = setInterval(refreshServices, 10000);

  // Find service by subdomain
  const findService = (hostname: string): Service | null => {
    // Extract subdomain from hostname
    // Handles: my-api.localhost, my-api.localhost:3000, my-api.127.0.0.1.nip.io
    const subdomain = hostname.split('.')[0].split(':')[0];
    return services.find(s => s.name.toLowerCase() === subdomain.toLowerCase()) || null;
  };

  // Create HTTP proxy server
  const server = http.createServer(async (req, res) => {
    const host = req.headers.host || '';
    const service = findService(host);
    
    if (!service) {
      const subdomain = host.split('.')[0];
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Service not found',
        subdomain,
        available: services.map(s => s.name),
        hint: `Try: ${services[0]?.name || 'my-service'}.localhost:${options.port}`,
      }, null, 2));
      console.log(chalk.red(`  ✗ ${subdomain} → not found`));
      return;
    }

    // Determine target - use tunnelPort for internal services
    const targetPort = service.tunnelPort || service.targetPort;
    const targetHost = service.tunnelPort ? '127.0.0.1' : service.targetHost;

    console.log(chalk.gray(`  → ${service.name} → ${targetHost}:${targetPort}${req.url}`));

    // Proxy the request
    const proxyReq = http.request({
      hostname: targetHost,
      port: targetPort,
      path: req.url,
      method: req.method,
      headers: {
        ...req.headers,
        host: `${service.targetHost}:${service.targetPort}`, // Original host for the service
      },
    }, (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', (err) => {
      console.log(chalk.red(`  ✗ ${service.name} → connection failed: ${err.message}`));
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        error: 'Service unavailable',
        service: service.name,
        target: `${targetHost}:${targetPort}`,
        message: err.message,
      }, null, 2));
    });

    req.pipe(proxyReq);
  });

  // Handle WebSocket upgrades
  server.on('upgrade', (req, socket, head) => {
    const host = req.headers.host || '';
    const service = findService(host);

    if (!service) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const targetPort = service.tunnelPort || service.targetPort;
    const targetHost = service.tunnelPort ? '127.0.0.1' : service.targetHost;

    console.log(chalk.magenta(`  ↔ ${service.name} → WebSocket upgrade`));

    const proxySocket = net.createConnection({
      host: targetHost,
      port: targetPort,
    }, () => {
      // Reconstruct the upgrade request
      const headers = Object.entries(req.headers)
        .map(([key, value]) => `${key}: ${value}`)
        .join('\r\n');
      
      proxySocket.write(
        `${req.method} ${req.url} HTTP/1.1\r\n` +
        `Host: ${service.targetHost}:${service.targetPort}\r\n` +
        `${headers}\r\n\r\n`
      );
      
      if (head.length > 0) {
        proxySocket.write(head);
      }

      // Bi-directional pipe
      socket.pipe(proxySocket);
      proxySocket.pipe(socket);
    });

    proxySocket.on('error', (err) => {
      console.log(chalk.red(`  ✗ ${service.name} → WebSocket failed: ${err.message}`));
      socket.destroy();
    });

    socket.on('error', () => {
      proxySocket.destroy();
    });
  });

  // Handle CONNECT for HTTPS tunneling (less common but useful)
  server.on('connect', (req, clientSocket, head) => {
    const [hostname] = (req.url || '').split(':');
    const service = findService(hostname);

    if (!service) {
      clientSocket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      clientSocket.destroy();
      return;
    }

    const targetPort = service.tunnelPort || service.targetPort;
    const targetHost = service.tunnelPort ? '127.0.0.1' : service.targetHost;

    console.log(chalk.blue(`  ⇄ ${service.name} → CONNECT tunnel`));

    const proxySocket = net.createConnection({
      host: targetHost,
      port: targetPort,
    }, () => {
      clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
      
      if (head.length > 0) {
        proxySocket.write(head);
      }

      clientSocket.pipe(proxySocket);
      proxySocket.pipe(clientSocket);
    });

    proxySocket.on('error', () => {
      clientSocket.destroy();
    });

    clientSocket.on('error', () => {
      proxySocket.destroy();
    });
  });

  // Start server
  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(chalk.red(`\n✗ Port ${actualPort} is already in use`));
      console.log(chalk.gray(`  Try: ${chalk.cyan(`connect proxy --port ${actualPort + 1}`)}`));
      console.log(chalk.gray(`  Or:  ${chalk.cyan(`connect proxy --replace`)} to take over\n`));
    } else {
      console.error(chalk.red(`\n✗ Server error: ${err.message}\n`));
    }
    process.exit(1);
  });

  server.listen(actualPort, '127.0.0.1', () => {
    console.log(chalk.green.bold(`✓ Proxy running on port ${actualPort}\n`));
    console.log(chalk.white('  Access your services via subdomains:'));
    console.log();
    
    if (services.length > 0) {
      services.forEach(s => {
        console.log(chalk.cyan(`    http://${s.name}.localhost:${actualPort}`));
      });
    } else {
      console.log(chalk.gray(`    http://<service-name>.localhost:${actualPort}`));
    }
    
    console.log();
    console.log(chalk.gray('  Press Ctrl+C to stop\n'));
  });

  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Stopping proxy...'));
    clearInterval(refreshInterval);
    server.close();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(refreshInterval);
    server.close();
    process.exit(0);
  });
}

