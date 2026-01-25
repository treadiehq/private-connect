import chalk from 'chalk';
import { loadConfig } from '../config';
import { io } from 'socket.io-client';

interface DebugOptions {
  hub: string;
  list?: boolean;
  stop?: string;
  config?: string;
}

interface DebugSession {
  id: string;
  token: string;
  name?: string;
  status: string;
  serviceId?: string;
  aiEnabled: boolean;
  packetCount: number;
  createdAt: string;
}

interface DebugPacket {
  id: string;
  sequence: number;
  direction: 'inbound' | 'outbound';
  protocol: string;
  payloadSize: number;
  parsed?: any;
  connectionId?: string;
  capturedAt: string;
}

export async function debugCommand(sessionIdOrToken: string | undefined, options: DebugOptions): Promise<void> {
  // Handle --list flag
  if (options.list) {
    await listDebugSessions(options);
    return;
  }

  // Handle --stop flag
  if (options.stop) {
    await stopDebugSession(options.stop, options);
    return;
  }

  // If no session ID provided, list sessions
  if (!sessionIdOrToken) {
    await listDebugSessions(options);
    return;
  }

  // Watch a specific debug session
  await watchDebugSession(sessionIdOrToken, options);
}

async function listDebugSessions(options: DebugOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('[x] Not authenticated. Run: connect up'));
    return;
  }

  console.log(chalk.cyan('🔍 Active debug sessions:\n'));

  try {
    const response = await fetch(`${options.hub}/v1/debug/sessions`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(chalk.red(`[x] Failed to list sessions: ${text}`));
      return;
    }

    const data = await response.json() as { sessions: DebugSession[] };
    
    if (data.sessions.length === 0) {
      console.log(chalk.gray('   No active debug sessions'));
      console.log(chalk.gray('\n   Start one with: connect expose <target> --debug'));
      return;
    }

    for (const session of data.sessions) {
      const age = getTimeAgo(new Date(session.createdAt));
      const aiLabel = session.aiEnabled ? chalk.magenta(' [AI]') : '';
      const statusColor = session.status === 'active' ? chalk.green : chalk.gray;
      
      console.log(`   ${chalk.cyan(session.token)} ${chalk.white(session.name || 'Unnamed')}${aiLabel}`);
      console.log(`      ${statusColor(session.status)} · ${session.packetCount} packets · ${age}`);
      console.log();
    }

    console.log(chalk.gray('   View session: connect debug <token>'));
    console.log(chalk.gray('   Stop session: connect debug --stop <token>'));
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`[x] Error: ${err.message}`));
  }
}

async function stopDebugSession(tokenOrId: string, options: DebugOptions): Promise<void> {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('[x] Not authenticated. Run: connect up'));
    return;
  }

  console.log(chalk.yellow(`⏹  Stopping debug session ${tokenOrId}...`));

  try {
    // First, get session ID from token if needed
    let sessionId = tokenOrId;
    if (tokenOrId.startsWith('s-')) {
      const response = await fetch(`${options.hub}/v1/debug/public/${tokenOrId}`, {
        headers: {
          'x-api-key': config.apiKey,
        },
      });
      
      if (!response.ok) {
        console.error(chalk.red('[x] Session not found'));
        return;
      }
      
      const data = await response.json() as { id: string };
      sessionId = data.id;
    }

    const response = await fetch(`${options.hub}/v1/debug/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(chalk.red(`[x] Failed to stop session: ${text}`));
      return;
    }

    console.log(chalk.green('[ok] Session stopped'));
  } catch (error: unknown) {
    const err = error as Error;
    console.error(chalk.red(`[x] Error: ${err.message}`));
  }
}

async function watchDebugSession(tokenOrId: string, options: DebugOptions): Promise<void> {
  const config = loadConfig();
  
  // Determine the token to use
  const token = tokenOrId.startsWith('s-') ? tokenOrId : null;
  
  if (!token) {
    console.error(chalk.red('[x] Please provide a session token (starts with s-)'));
    return;
  }

  console.log(chalk.cyan(`🔍 Connecting to debug session ${token}...\n`));

  // Connect to debug WebSocket
  const wsUrl = options.hub.replace('https://', 'wss://').replace('http://', 'ws://');
  const socket = io(`${wsUrl}/debug`, {
    transports: ['websocket'],
  });

  socket.on('connect', () => {
    console.log(chalk.green('[ok] Connected to debug stream'));
    
    // Subscribe to the session
    socket.emit('subscribe', { token }, (response: { success: boolean; error?: string; sessionId?: string }) => {
      if (!response.success) {
        console.error(chalk.red(`[x] ${response.error}`));
        socket.disconnect();
        process.exit(1);
      }
      
      console.log(chalk.gray(`   Session ID: ${response.sessionId}`));
      console.log(chalk.gray('   Waiting for packets...\n'));
    });
  });

  socket.on('session', (session: { id: string; status: string; aiEnabled: boolean; packetCount: number }) => {
    console.log(chalk.gray(`   Status: ${session.status}`));
    console.log(chalk.gray(`   AI Copilot: ${session.aiEnabled ? 'enabled' : 'disabled'}`));
    console.log(chalk.gray(`   Existing packets: ${session.packetCount}`));
    console.log();
  });

  socket.on('packet', (packet: DebugPacket) => {
    printPacket(packet);
  });

  socket.on('error', (error: { message: string }) => {
    console.error(chalk.red(`[x] ${error.message}`));
  });

  socket.on('disconnect', (reason: string) => {
    console.log(chalk.yellow(`\n[!] Disconnected: ${reason}`));
    process.exit(0);
  });

  socket.on('connect_error', (err: Error) => {
    console.error(chalk.red(`[x] Connection error: ${err.message}`));
    process.exit(1);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Disconnecting...'));
    socket.disconnect();
    process.exit(0);
  });
}

function printPacket(packet: DebugPacket): void {
  const timestamp = new Date(packet.capturedAt).toLocaleTimeString();
  const direction = packet.direction === 'inbound' 
    ? chalk.green('←') 
    : chalk.blue('→');
  const protocol = chalk.yellow(`[${packet.protocol.toUpperCase()}]`);
  const size = chalk.gray(`${packet.payloadSize}B`);

  let summary = '';
  
  if (packet.parsed) {
    switch (packet.protocol) {
      case 'http':
        if (packet.parsed.type === 'request') {
          summary = chalk.white(`${packet.parsed.method} ${packet.parsed.path}`);
        } else if (packet.parsed.type === 'response') {
          const statusColor = packet.parsed.status >= 400 ? chalk.red : chalk.green;
          summary = statusColor(`${packet.parsed.status} ${packet.parsed.statusText}`);
        }
        break;
      case 'postgres':
        if (packet.parsed.type === 'query') {
          const query = packet.parsed.query?.substring(0, 60) || '';
          summary = chalk.white(`Query: ${query}${query.length >= 60 ? '...' : ''}`);
        } else if (packet.parsed.type === 'command_complete') {
          summary = chalk.green(packet.parsed.tag);
        } else if (packet.parsed.type === 'error') {
          summary = chalk.red(`Error: ${packet.parsed.preview?.substring(0, 50)}`);
        } else {
          summary = chalk.gray(packet.parsed.type);
        }
        break;
      case 'redis':
        if (packet.parsed.type === 'command') {
          summary = chalk.white(`${packet.parsed.command} ${(packet.parsed.args || []).join(' ')}`);
        } else if (packet.parsed.type === 'error') {
          summary = chalk.red(packet.parsed.message);
        } else {
          summary = chalk.gray(packet.parsed.type);
        }
        break;
      default:
        summary = chalk.gray(`${packet.payloadSize} bytes`);
    }
  } else {
    summary = chalk.gray(`${packet.payloadSize} bytes`);
  }

  console.log(`${chalk.gray(timestamp)} ${direction} ${protocol} ${size} ${summary}`);
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
