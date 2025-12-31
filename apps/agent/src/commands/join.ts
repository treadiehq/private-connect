import * as net from 'net';
import chalk from 'chalk';
import { loadConfig } from '../config';

interface JoinOptions {
  hub: string;
  config?: string;
}

interface ShareRoute {
  serviceName: string;
  serviceId?: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  protocol: string;
}

interface JoinResponse {
  success: boolean;
  share?: {
    code: string;
    name?: string;
    expiresAt: string;
    routes: ShareRoute[];
  };
  error?: string;
}

export async function joinCommand(code: string, options: JoinOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n✗ Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;
  
  // Normalize the code (lowercase, trim)
  const shareCode = code.toLowerCase().trim();

  console.log(chalk.cyan(`\n🔗 Joining environment share: ${shareCode}\n`));

  try {
    // First, preview the share
    const previewResponse = await fetch(`${hubUrl}/v1/env-shares/${shareCode}`, {
      headers: {
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
    });

    if (!previewResponse.ok) {
      if (previewResponse.status === 404) {
        console.error(chalk.red('✗ Share not found or expired'));
        console.log(chalk.gray('  Check the code and try again.\n'));
      } else {
        console.error(chalk.red(`✗ Failed to join: ${previewResponse.statusText}`));
      }
      process.exit(1);
    }

    // Now actually join to get full route details
    const joinResponse = await fetch(`${hubUrl}/v1/env-shares/${shareCode}/join`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
      body: JSON.stringify({
        agentLabel: config.label,
      }),
    });

    if (!joinResponse.ok) {
      console.error(chalk.red(`✗ Failed to join: ${joinResponse.statusText}`));
      process.exit(1);
    }

    const data = await joinResponse.json() as JoinResponse;

    if (!data.success || !data.share) {
      console.error(chalk.red(`✗ Failed to join: ${data.error || 'Unknown error'}`));
      process.exit(1);
    }

    const share = data.share;
    const expiresAt = new Date(share.expiresAt);
    const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

    console.log(chalk.green.bold('✓ Connected to shared environment!\n'));

    if (share.name) {
      console.log(chalk.gray(`  Name: ${share.name}`));
    }
    console.log(chalk.gray(`  Expires in ${hoursLeft} hours\n`));

    // Now create local tunnels for each route
    console.log(chalk.white('  Establishing tunnels...\n'));

    const tunnels: Array<{ server: net.Server; port: number; name: string }> = [];

    for (const route of share.routes) {
      const localPort = route.localPort || route.targetPort;
      
      try {
        // Create a local TCP server that forwards to the service
        const server = await createLocalTunnel(
          hubUrl,
          config.apiKey,
          config.agentId,
          route.serviceName,
          route.serviceId,
          localPort,
        );
        
        tunnels.push({ server, port: localPort, name: route.serviceName });
        console.log(chalk.green(`    ✓ ${route.serviceName}`) + chalk.gray(` → localhost:${localPort}`));
      } catch (err) {
        const error = err as Error;
        console.log(chalk.yellow(`    ⚠ ${route.serviceName}`) + chalk.gray(` → failed: ${error.message}`));
      }
    }

    if (tunnels.length === 0) {
      console.error(chalk.red('\n✗ No tunnels could be established.\n'));
      process.exit(1);
    }

    console.log(chalk.green(`\n✓ ${tunnels.length} tunnel(s) active\n`));
    
    // Show connection examples
    console.log(chalk.gray('  Example connections:'));
    tunnels.forEach(t => {
      console.log(chalk.gray(`    • ${t.name}: `) + chalk.cyan(`localhost:${t.port}`));
    });
    console.log();
    console.log(chalk.gray('  Press Ctrl+C to disconnect all tunnels\n'));

    // Handle cleanup
    const cleanup = () => {
      console.log(chalk.yellow('\n👋 Disconnecting tunnels...'));
      tunnels.forEach(t => {
        t.server.close();
      });
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('ECONNREFUSED')) {
      console.error(chalk.red(`\n✗ Cannot connect to hub at ${hubUrl}`));
      console.log(chalk.gray('  Make sure the hub is running and accessible.\n'));
    } else {
      console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
    }
    process.exit(1);
  }
}

/**
 * Create a local TCP server that tunnels to a remote service
 */
async function createLocalTunnel(
  hubUrl: string,
  apiKey: string,
  agentId: string,
  serviceName: string,
  serviceId: string | undefined,
  localPort: number,
): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const server = net.createServer(async (clientSocket) => {
      try {
        // Connect to the service via the reach endpoint
        // For now, we'll proxy through the hub's tunnel infrastructure
        const serviceTarget = serviceId || serviceName;
        
        // Get service info to find tunnel port
        const serviceResponse = await fetch(`${hubUrl}/v1/services?name=${encodeURIComponent(serviceName)}`, {
          headers: {
            'x-api-key': apiKey,
          },
        });

        if (!serviceResponse.ok) {
          clientSocket.destroy();
          return;
        }

        const services = await serviceResponse.json() as Array<{
          name: string;
          tunnelPort?: number;
          targetHost: string;
          targetPort: number;
        }>;

        const service = services.find(s => s.name === serviceName);
        if (!service || !service.tunnelPort) {
          clientSocket.destroy();
          return;
        }

        // Connect to the tunnel port on the hub
        const hubHost = new URL(hubUrl).hostname;
        const proxySocket = net.createConnection({
          host: hubHost,
          port: service.tunnelPort,
        }, () => {
          // Bi-directional pipe
          clientSocket.pipe(proxySocket);
          proxySocket.pipe(clientSocket);
        });

        proxySocket.on('error', () => {
          clientSocket.destroy();
        });

        clientSocket.on('error', () => {
          proxySocket.destroy();
        });

      } catch {
        clientSocket.destroy();
      }
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${localPort} in use`));
      } else {
        reject(err);
      }
    });

    server.listen(localPort, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

