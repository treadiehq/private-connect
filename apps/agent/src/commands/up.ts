import { io, Socket } from 'socket.io-client';
import * as net from 'net';
import chalk from 'chalk';
import { ensureConfig, AgentConfig, loadConfig, generateConfig, getConfigPath, clearConfig } from '../config';
import { deviceAuthFlow } from '../device-auth';
import { enforceSecureConnection, handleTokenExpiry, handleSecurityEvent } from '../security';

interface UpOptions {
  hub: string;
  apiKey?: string;
  label?: string;
  name?: string;
  token?: string;  // Pre-authenticated token (CI/CD)
  config?: string; // Custom config path
}

interface ConnectionState {
  socket: net.Socket;
  connected: boolean;
}

export async function upCommand(options: UpOptions) {
  console.log(chalk.cyan('🚀 Starting Private Connect Agent...'));
  console.log();
  
  // Enforce HTTPS for non-localhost connections
  enforceSecureConnection(options.hub);
  
  // Check for pre-authenticated token (CI/CD mode)
  const envToken = process.env.PRIVATECONNECT_TOKEN || options.token;
  if (envToken) {
    options.apiKey = envToken;
  }
  
  // Check for existing config
  const existingConfig = loadConfig();
  
  let config: AgentConfig;
  
  if (existingConfig) {
    // Use existing config, update if options provided
    config = ensureConfig(options.hub, options.apiKey, options.label, options.name);
    console.log(chalk.gray(`  Using existing configuration`));
  } else if (options.apiKey) {
    // First time with API key provided
    config = ensureConfig(options.hub, options.apiKey, options.label, options.name);
  } else {
    // No config, no API key - use device authorization flow
    console.log(chalk.cyan('  First time setup - authenticating...'));
    
    const authResult = await deviceAuthFlow(options.hub, options.label, options.name);
    
    if (!authResult) {
      console.log(chalk.red('  ✗ Authentication failed'));
    process.exit(1);
  }

    // Save config with the obtained API key
    config = generateConfig(options.hub, authResult.apiKey, options.label, options.name);
    config.workspaceId = authResult.workspaceId;
  }
  
  console.log(chalk.gray(`  Agent ID: ${config.agentId}`));
  console.log(chalk.gray(`  Label:    ${config.label}`));
  console.log(chalk.gray(`  Hub URL:  ${config.hubUrl}`));
  console.log(chalk.gray(`  Config:   ${getConfigPath()}`));
  if (config.name) {
    console.log(chalk.gray(`  Name:     ${config.name}`));
  }
  console.log();
  
  // Register with hub via HTTP first
  let result = await registerAgent(config);
  
  // Handle 401 - invalid/stale credentials
  if (!result.success && result.status === 401) {
    console.log(chalk.yellow('⚠ Stored credentials are invalid or expired'));
    console.log(chalk.cyan('  Clearing old config and re-authenticating...'));
    console.log();
    
    // Clear the stale config
    clearConfig();
    
    // Restart device auth flow
    const authResult = await deviceAuthFlow(options.hub, options.label, options.name);
    
    if (!authResult) {
      console.log(chalk.red('  ✗ Authentication failed'));
      process.exit(1);
    }
    
    // Save new config
    config = generateConfig(options.hub, authResult.apiKey, options.label, options.name);
    config.workspaceId = authResult.workspaceId;
    
    console.log(chalk.gray(`  New Agent ID: ${config.agentId}`));
    console.log();
    
    // Try registration again with new credentials
    result = await registerAgent(config);
  }
  
  if (!result.success) {
    console.error(chalk.red(`✗ Registration failed: ${result.error}`));
    process.exit(1);
  }
  
  // Connect via WebSocket
  const socket = connectToHub(config);
  
  // Handle process signals
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down agent...'));
    socket.disconnect();
    process.exit(0);
  });
  
  process.on('SIGTERM', () => {
    socket.disconnect();
    process.exit(0);
  });
}

interface RegistrationResult {
  success: boolean;
  status?: number;
  error?: string;
}

async function registerAgent(config: AgentConfig): Promise<RegistrationResult> {
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
      return { success: false, status: response.status, error: text };
    }
    
    console.log(chalk.green('✓ Registered with hub'));
    return { success: true };
  } catch (error: unknown) {
    const err = error as Error;
    return { success: false, error: err.message };
  }
}

function connectToHub(config: AgentConfig): Socket {
  const socket = io(`${config.hubUrl}/agent`, {
    auth: {
      agentId: config.agentId,
      token: config.token,
    },
    transports: ['websocket'],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 60000,  // Connection timeout
  });

  // Track active connections for tunneling
  const connections = new Map<string, ConnectionState>();

  socket.on('connect', () => {
    console.log(chalk.green('✓ Connected to hub via WebSocket'));
  });

  socket.on('disconnect', (reason) => {
    console.log(chalk.yellow(`⚠ Disconnected: ${reason}`));
    // Close all active connections
    connections.forEach((conn, id) => {
      conn.socket.destroy();
      connections.delete(id);
    });
  });

  socket.on('connect_error', (error) => {
    console.log(chalk.red(`✗ Connection error: ${error.message}`));
  });

  // Handle auth errors
  socket.on('error', (data: { code: string; message: string }) => {
    if (data.code === 'TOKEN_EXPIRED') {
      console.error(chalk.red(`\n✗ ${data.message}`));
      console.log(chalk.gray('  Your token has expired. Run: connect up --api-key <key> to get a new token.\n'));
      process.exit(1);
    } else if (data.code === 'INVALID_TOKEN') {
      console.error(chalk.red(`\n✗ ${data.message}`));
      process.exit(1);
    }
  });

  // Handle token expiry warnings
  socket.on('token_warning', (data: { message: string; expiresAt: string }) => {
    handleTokenExpiry({ expiresAt: data.expiresAt });
  });

  // Handle security notices (IP changes, etc.)
  socket.on('security_notice', (data: { type: string; message: string }) => {
    handleSecurityEvent(data);
  });

  socket.on('connected', (data: { message: string; tokenExpiresAt?: string }) => {
    console.log(chalk.gray(`   ${data.message}`));
    
    // Check token expiry on connect
    if (data.tokenExpiresAt) {
      handleTokenExpiry({ expiresAt: data.tokenExpiresAt });
    }
  });

  // Handle dial requests from hub
  socket.on('dial', async (data: { connectionId: string; targetHost: string; targetPort: number; serviceId: string }) => {
    console.log(chalk.gray(`   Dialing ${data.targetHost}:${data.targetPort} for connection ${data.connectionId.substring(0, 8)}...`));
    
    try {
      const targetSocket = net.createConnection({
        host: data.targetHost,
        port: data.targetPort,
      });

      connections.set(data.connectionId, {
        socket: targetSocket,
        connected: false,
      });

      targetSocket.on('connect', () => {
        console.log(chalk.green(`   ✓ Connected to ${data.targetHost}:${data.targetPort}`));
        const conn = connections.get(data.connectionId);
        if (conn) conn.connected = true;
        socket.emit('dial_success', { connectionId: data.connectionId });
      });

      targetSocket.on('data', (chunk) => {
        socket.emit('data', {
          connectionId: data.connectionId,
          data: chunk.toString('base64'),
        });
      });

      targetSocket.on('error', (err) => {
        console.log(chalk.red(`   ✗ Connection error: ${err.message}`));
        socket.emit('dial_error', { connectionId: data.connectionId, error: err.message });
        connections.delete(data.connectionId);
      });

      targetSocket.on('close', () => {
        socket.emit('close', { connectionId: data.connectionId });
        connections.delete(data.connectionId);
      });

    } catch (error: unknown) {
      const err = error as Error;
      console.log(chalk.red(`   ✗ Dial failed: ${err.message}`));
      socket.emit('dial_error', { connectionId: data.connectionId, error: err.message });
    }
  });

  // Handle data from hub (client -> agent -> target)
  socket.on('data', (data: { connectionId: string; data: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn && conn.connected) {
      const buffer = Buffer.from(data.data, 'base64');
      conn.socket.write(buffer);
    }
  });

  // Handle close from hub
  socket.on('close', (data: { connectionId: string }) => {
    const conn = connections.get(data.connectionId);
    if (conn) {
      conn.socket.end();
      connections.delete(data.connectionId);
    }
  });

  // Heartbeat every 30 seconds
  setInterval(() => {
    if (socket.connected) {
      socket.emit('heartbeat');
    }
  }, 30000);

  return socket;
}
