import { io } from 'socket.io-client';
import chalk from 'chalk';
import { loadConfig, ensureConfig } from '../config';

interface ExposeOptions {
  name: string;
  hub: string;
  apiKey?: string;
  protocol: string;
  config?: string;
}

interface DiagnosticResult {
  dnsStatus: string;
  tcpStatus: string;
  tlsStatus?: string;
  httpStatus?: string;
  latencyMs?: number;
  message: string;
}

export async function exposeCommand(target: string, options: ExposeOptions) {
  // Parse target
  const [host, portStr] = target.split(':');
  const port = parseInt(portStr, 10);
  
  if (!host || isNaN(port)) {
    console.error(chalk.red('✗ Invalid target format. Use host:port (e.g., 127.0.0.1:8080)'));
    process.exit(1);
  }

  // Warn if trying to expose Private Connect control plane
  // const isLocalhost = host === 'localhost' || host === '127.0.0.1';
  // if (isLocalhost && port === 3000) {
  //   console.log(chalk.yellow('\n⚠ Warning: Port 3000 is typically the Private Connect Web UI.'));
  //   console.log(chalk.gray('  You might want to expose a different service instead.'));
  //   console.log(chalk.gray('  Example: connect expose localhost:8080 --name my-api\n'));
  // } else if (isLocalhost && port === 3001) {
  //   console.log(chalk.yellow('\n⚠ Warning: Port 3001 is typically the Private Connect API.'));
  //   console.log(chalk.gray('  You might want to expose a different service instead.'));
  //   console.log(chalk.gray('  Example: connect expose localhost:8080 --name my-api\n'));
  // }

  console.log(chalk.cyan(`🔗 Exposing ${target} as "${options.name}"...`));

  // Load or create config
  const existingConfig = loadConfig();
  if (!existingConfig && !options.apiKey) {
    console.error(chalk.red('\n✗ API key required for first-time setup'));
    console.log(chalk.gray(`  Use: ${chalk.cyan('connect expose <target> --api-key <your-api-key>')}`));
    process.exit(1);
  }

  const config = ensureConfig(options.hub, options.apiKey);
  
  console.log(chalk.gray(`   Agent ID: ${config.agentId}`));
  console.log(chalk.gray(`   Label:    ${config.label}`));
  console.log(chalk.gray(`   Hub URL:  ${config.hubUrl}`));

  // Register agent first if needed
  await registerAgent(config);

  // Register service with hub
  const service = await registerService(config.agentId, options.name, host, port, options.protocol, config);
  
  if (!service) {
    console.error(chalk.red('✗ Failed to register service'));
    process.exit(1);
  }

  console.log(chalk.green(`✓ Service registered`));
  console.log(chalk.gray(`   Service ID: ${service.id}`));
  console.log(chalk.gray(`   Tunnel Port: ${service.tunnelPort}`));
  console.log(chalk.gray(`   Protocol: ${service.protocol}`));

  // Connect via WebSocket and set up tunnel
  const socket = io(`${config.hubUrl}/agent`, {
    auth: {
      agentId: config.agentId,
      token: config.token,
    },
    transports: ['websocket'],
    reconnection: true,
  });

  socket.on('connect', () => {
    console.log(chalk.green('✓ Connected to hub'));
  });

  // Wait for server to confirm connection before setting up tunnel
  socket.on('connected', () => {
    console.log(chalk.gray('   Connection confirmed, setting up tunnel...'));
    
    // Request tunnel setup
    socket.emit('expose', {
      serviceId: service.id,
      serviceName: options.name,
      tunnelPort: service.tunnelPort,
      targetHost: host,
      targetPort: port,
    }, async (response: { success: boolean; error?: string }) => {
      if (response.success) {
        console.log(chalk.green('✓ Tunnel established'));
        console.log(chalk.cyan(`\n📡 Service "${options.name}" is now accessible through the hub`));
        console.log(chalk.gray(`   Hub can reach it at localhost:${service.tunnelPort}`));
        
        // Auto-run diagnostics to verify the tunnel works
        console.log(chalk.gray('\n   Running initial diagnostics...'));
        await runInitialDiagnostics(service.id, options.name, config.hubUrl);
        
        console.log(chalk.gray('\n   Press Ctrl+C to stop exposing\n'));
      } else {
        console.error(chalk.red(`✗ Tunnel setup failed: ${response.error}`));
      }
    });
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

  socket.on('disconnect', () => {
    console.log(chalk.yellow('⚠ Disconnected from hub'));
  });

  // Handle process signals
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Stopping exposure...'));
    socket.disconnect();
    process.exit(0);
  });
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
    console.error(chalk.red(`✗ Agent registration failed: ${err.message}`));
    throw error;
  }
}

async function registerService(
  agentId: string,
  name: string,
  targetHost: string,
  targetPort: number,
  protocol: string,
  config: { hubUrl: string; apiKey: string },
): Promise<{ id: string; tunnelPort: number; protocol: string } | null> {
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
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(chalk.red(`Service registration failed: ${text}`));
      return null;
    }

    const data = await response.json() as { service: { id: string; tunnelPort: number; protocol: string } };
    return data.service;
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`✗ Service registration failed: ${err.message}`));
    return null;
  }
}

async function runInitialDiagnostics(serviceId: string, serviceName: string, hubUrl: string) {
  try {
    // Small delay to ensure tunnel is fully ready
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const response = await fetch(`${hubUrl}/v1/services/${serviceId}/check`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      console.log(chalk.yellow('   ⚠ Could not run diagnostics'));
      return;
    }
    
    const data = await response.json() as { diagnostic: DiagnosticResult };
    const result = data.diagnostic;
    
    // Display compact diagnostic result
    const isSuccess = result.tcpStatus === 'OK';
    
    if (isSuccess) {
      console.log(chalk.green(`\n   ✓ ${serviceName} is REACHABLE`));
      const parts = [];
      if (result.dnsStatus.includes('OK')) parts.push(chalk.green('DNS ✓'));
      if (result.tcpStatus === 'OK') parts.push(chalk.green('TCP ✓'));
      if (result.tlsStatus === 'OK') parts.push(chalk.green('TLS ✓'));
      if (result.httpStatus === 'OK') parts.push(chalk.green('HTTP ✓'));
      if (result.latencyMs) parts.push(chalk.gray(`${result.latencyMs}ms`));
      console.log(chalk.gray(`     ${parts.join('  ')}`));
    } else {
      console.log(chalk.red(`\n   ✗ ${serviceName} is UNREACHABLE`));
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
    console.log(chalk.yellow(`   ⚠ Diagnostics error: ${err.message}`));
  }
}
