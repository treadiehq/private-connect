import { io, Socket } from 'socket.io-client';
import * as net from 'net';
import * as readline from 'readline';
import chalk from 'chalk';
import { ensureConfig, AgentConfig, loadConfig, generateConfig, getConfigPath, clearConfig } from '../config';
import { deviceAuthFlow } from '../device-auth';
import { enforceSecureConnection, handleTokenExpiry, handleSecurityEvent, SecurityError } from '../security';
import { runZeroTouchSetup, isSetupComplete } from '../setup';
import { exposeCommand } from './expose';

interface UpOptions {
  hub: string;
  apiKey?: string;
  label?: string;
  name?: string;
  token?: string;  // Pre-authenticated token (CI/CD)
  config?: string; // Custom config path
}

/**
 * Prompt user to expose their first service after initial setup
 * Returns true if they exposed something, false if they skipped
 */
async function promptForFirstExposure(hubUrl: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log('');
    rl.question(
      chalk.cyan('  Expose a service now? ') + 
      chalk.gray('(e.g. localhost:3306) or Enter to skip: '),
      async (answer) => {
        rl.close();
        
        const input = answer.trim();
        
        if (!input) {
          // User pressed Enter - skip
          resolve(false);
          return;
        }
        
        // Parse the input: could be "localhost:3306" or just "3306"
        let target = input;
        if (/^\d+$/.test(input)) {
          target = `localhost:${input}`;
        }
        
        // Validate format
        const [host, portStr] = target.split(':');
        const port = parseInt(portStr, 10);
        
        if (!host || isNaN(port)) {
          console.log(chalk.yellow('\n  [!] Invalid format. Expected host:port (e.g. localhost:3306)'));
          console.log(chalk.gray('      You can expose services later with: connect expose localhost:PORT --name SERVICE\n'));
          resolve(false);
          return;
        }
        
        // Generate a default name from the port
        const defaultName = getDefaultServiceName(port);
        
        console.log('');
        
        // Call exposeCommand - this will stay running
        try {
          await exposeCommand(target, {
            name: defaultName,
            hub: hubUrl,
            protocol: 'tcp',
          });
          resolve(true);
        } catch (err) {
          const error = err as Error;
          console.log(chalk.red(`\n  [x] Failed to expose: ${error.message}`));
          console.log(chalk.gray('      You can try again with: connect expose ' + target + ' --name ' + defaultName + '\n'));
          resolve(false);
        }
      }
    );
  });
}

/**
 * Generate a sensible default service name based on port
 */
function getDefaultServiceName(port: number): string {
  const portNames: Record<number, string> = {
    3306: 'mysql',
    5432: 'postgres',
    6379: 'redis',
    27017: 'mongodb',
    5672: 'rabbitmq',
    9200: 'elasticsearch',
    8080: 'api',
    8000: 'api',
    3000: 'web',
    4000: 'graphql',
    18789: 'openclaw',
  };
  
  return portNames[port] || `service-${port}`;
}

interface ConnectionState {
  socket: net.Socket;
  connected: boolean;
}

export async function upCommand(options: UpOptions) {
  console.log(chalk.cyan('🚀 Starting Private Connect Agent...'));
  console.log();
  
  // Enforce HTTPS for non-localhost connections
  try {
    enforceSecureConnection(options.hub);
  } catch (err) {
    if (err instanceof SecurityError) {
      process.exit(1);
    }
    throw err;
  }
  
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
      console.log(chalk.red('  [x] Authentication failed'));
    process.exit(1);
  }

    // Save config with the obtained API key
    config = generateConfig(options.hub, authResult.apiKey, options.label, options.name);
    config.workspaceId = authResult.workspaceId;
    
    // Run zero-touch setup on first authentication (daemon + DNS)
    // Skip if we're already running as a daemon
    if (!process.env.CONNECT_DAEMON) {
      await runZeroTouchSetup({ hubUrl: options.hub });
      
      // First-time setup: offer to expose a service right away (Option A+B)
      const exposedService = await promptForFirstExposure(options.hub);
      
      if (exposedService) {
        // User chose to expose a service - exposeCommand stays running
        return;
      } else {
        // User skipped - daemon is running in background, exit gracefully
        console.log(chalk.green('\n[ok] Setup complete! Daemon is running in the background.\n'));
        console.log(chalk.gray('  To expose a service, run:'));
        console.log(chalk.cyan('    connect expose localhost:PORT --name SERVICE\n'));
        console.log(chalk.gray('  Examples:'));
        console.log(chalk.cyan('    connect expose localhost:3306 --name mysql'));
        console.log(chalk.cyan('    connect expose localhost:5432 --name postgres'));
        console.log(chalk.cyan('    connect expose localhost:8080 --name api\n'));
        process.exit(0);
      }
    }
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
    console.log(chalk.yellow('[!] Stored credentials are invalid or expired'));
    console.log(chalk.cyan('  Clearing old config and re-authenticating...'));
    console.log();
    
    // Clear the stale config
    clearConfig();
    
    // Restart device auth flow
    const authResult = await deviceAuthFlow(options.hub, options.label, options.name);
    
    if (!authResult) {
      console.log(chalk.red('  [x] Authentication failed'));
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
    console.error(chalk.red(`[x] Registration failed: ${result.error}`));
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
    
    console.log(chalk.green('[ok] Registered with hub'));
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
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.green(`[${timestamp}] Connected to hub via WebSocket`));
  });

  socket.on('disconnect', (reason: string) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.yellow(`[${timestamp}] Disconnected: ${reason}`));
  });

  socket.on('reconnect', (attempt: number) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.green(`[${timestamp}] Reconnected after ${attempt} attempt(s)`));
  });

  socket.on('reconnect_attempt', (attempt: number) => {
    if (attempt === 1 || attempt % 5 === 0) {
      const timestamp = new Date().toLocaleTimeString();
      console.log(chalk.gray(`[${timestamp}] Reconnecting... (attempt ${attempt})`));
    }
  });

  socket.on('connect_error', (err: Error) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(chalk.red(`[${timestamp}] Connection error: ${err.message}`));
  });

  socket.on('disconnect', (reason) => {
    console.log(chalk.yellow(`[!] Disconnected: ${reason}`));
    // Close all active connections
    connections.forEach((conn, id) => {
      conn.socket.destroy();
      connections.delete(id);
    });
  });

  socket.on('connect_error', (error) => {
    console.log(chalk.red(`[x] Connection error: ${error.message}`));
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
        console.log(chalk.green(`   [ok] Connected to ${data.targetHost}:${data.targetPort}`));
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
        console.log(chalk.red(`   [x] Connection error: ${err.message}`));
        socket.emit('dial_error', { connectionId: data.connectionId, error: err.message });
        connections.delete(data.connectionId);
      });

      targetSocket.on('close', () => {
        socket.emit('close', { connectionId: data.connectionId });
        connections.delete(data.connectionId);
      });

    } catch (error: unknown) {
      const err = error as Error;
      console.log(chalk.red(`   [x] Dial failed: ${err.message}`));
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
