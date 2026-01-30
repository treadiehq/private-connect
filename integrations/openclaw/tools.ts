/**
 * Private Connect Skill for OpenClaw
 * 
 * Access private services by name, from anywhere.
 * https://privateconnect.co
 */

import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface ToolResult {
  success: boolean;
  output?: string;
  error?: string;
}

/**
 * Run a connect CLI command safely using execFile with argument array.
 * This prevents command injection by avoiding shell interpretation.
 */
async function runConnect(args: string[]): Promise<ToolResult> {
  try {
    const { stdout, stderr } = await execFileAsync('connect', args, {
      timeout: 30000, // 30 second timeout
    });
    return {
      success: true,
      output: stdout || stderr,
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || 'Command failed',
      output: error.stdout || error.stderr,
    };
  }
}

/**
 * Connect to a private service by name
 */
export async function connect_reach(params: { service: string; port?: number }) {
  const { service, port } = params;
  
  const args = ['reach', service];
  if (port) {
    args.push('--port', String(port));
  }
  
  const result = await runConnect(args);
  
  if (result.success) {
    return {
      message: `Connected to ${service}. You can now access it at localhost.`,
      details: result.output,
    };
  } else {
    return {
      message: `Failed to connect to ${service}.`,
      error: result.error,
      details: result.output,
    };
  }
}

/**
 * Show available services and their status
 */
export async function connect_status() {
  const result = await runConnect(['status', '--json']);
  
  if (result.success && result.output) {
    try {
      const status = JSON.parse(result.output);
      return {
        message: 'Here are your available services:',
        services: status,
      };
    } catch {
      return {
        message: 'Services status:',
        details: result.output,
      };
    }
  } else {
    return {
      message: 'Could not get service status.',
      error: result.error,
    };
  }
}

/**
 * Share your environment with a teammate
 */
export async function connect_share(params: { expires?: string; name?: string }) {
  const { expires, name } = params;
  
  const args = ['share'];
  if (expires) {
    args.push('--expires', expires);
  }
  if (name) {
    args.push('--name', name);
  }
  
  const result = await runConnect(args);
  
  if (result.success) {
    // Try to extract share code from output
    const codeMatch = result.output?.match(/[a-z0-9]{6,}/i);
    const shareCode = codeMatch ? codeMatch[0] : null;
    
    return {
      message: shareCode 
        ? `Environment shared! Share code: ${shareCode}`
        : 'Environment shared!',
      shareCode,
      details: result.output,
    };
  } else {
    return {
      message: 'Failed to share environment.',
      error: result.error,
    };
  }
}

/**
 * Join a shared environment
 */
export async function connect_join(params: { code: string }) {
  const { code } = params;
  
  const result = await runConnect(['join', code]);
  
  if (result.success) {
    return {
      message: `Joined shared environment ${code}.`,
      details: result.output,
    };
  } else {
    return {
      message: `Failed to join environment ${code}.`,
      error: result.error,
    };
  }
}

/**
 * Clone a teammate's environment
 */
export async function connect_clone(params: { teammate: string }) {
  const { teammate } = params;
  
  const result = await runConnect(['clone', teammate]);
  
  if (result.success) {
    return {
      message: `Cloned ${teammate}'s environment. All their services are now available.`,
      details: result.output,
    };
  } else {
    return {
      message: `Failed to clone ${teammate}'s environment.`,
      error: result.error,
    };
  }
}

/**
 * List active shares
 */
export async function connect_list_shares() {
  const result = await runConnect(['share', '--list']);
  
  if (result.success) {
    return {
      message: 'Active shares:',
      details: result.output,
    };
  } else {
    return {
      message: 'Could not list shares.',
      error: result.error,
    };
  }
}

/**
 * Revoke a share
 */
export async function connect_revoke(params: { code: string }) {
  const { code } = params;
  
  const result = await runConnect(['share', '--revoke', code]);
  
  if (result.success) {
    return {
      message: `Share ${code} has been revoked.`,
      details: result.output,
    };
  } else {
    return {
      message: `Failed to revoke share ${code}.`,
      error: result.error,
    };
  }
}

/**
 * Expose a local service
 */
export async function connect_expose(params: { target: string; name: string }) {
  const { target, name } = params;
  
  const result = await runConnect(['expose', target, '--name', name]);
  
  if (result.success) {
    return {
      message: `Exposed ${target} as "${name}". Others can now reach it with: connect reach ${name}`,
      details: result.output,
    };
  } else {
    return {
      message: `Failed to expose ${target}.`,
      error: result.error,
    };
  }
}

/**
 * Expose the OpenClaw gateway for remote access
 */
export async function connect_expose_gateway(params: { name?: string; persistent?: boolean }) {
  const { name = 'openclaw', persistent = true } = params;
  
  // First, check if gateway is running
  try {
    await execFileAsync('curl', ['-s', 'http://localhost:18789/health'], { timeout: 5000 });
  } catch {
    return {
      success: false,
      message: 'OpenClaw gateway not found on localhost:18789. Is OpenClaw running?',
      hint: 'Start OpenClaw with: openclaw start (or see https://openclaw.ai)',
    };
  }
  
  // Install daemon if persistent
  if (persistent) {
    await runConnect(['daemon', 'install']);
  }
  
  const result = await runConnect(['expose', 'localhost:18789', '--name', name]);
  
  if (result.success) {
    return {
      success: true,
      message: `OpenClaw gateway exposed as "${name}".`,
      instructions: [
        `On other devices, run: connect reach ${name}`,
        'Your chat apps will connect via localhost:18789 as usual.',
        persistent ? 'Tunnel will persist across reboots.' : 'Tunnel active until terminal closes.',
      ],
      details: result.output,
    };
  } else {
    return {
      success: false,
      message: 'Failed to expose OpenClaw gateway.',
      error: result.error,
    };
  }
}

/**
 * Connect to a remote OpenClaw gateway
 */
export async function connect_reach_gateway(params: { name?: string; persistent?: boolean }) {
  const { name = 'openclaw', persistent = true } = params;
  
  // Install daemon if persistent
  if (persistent) {
    await runConnect(['daemon', 'install']);
  }
  
  const result = await runConnect(['reach', name]);
  
  if (result.success) {
    return {
      success: true,
      message: `Connected to remote OpenClaw gateway "${name}".`,
      endpoint: 'ws://localhost:18789',
      instructions: [
        'OpenClaw gateway is now available at localhost:18789',
        'Your chat apps (WhatsApp, Telegram, etc.) will work as if OpenClaw were local.',
        persistent ? 'Connection will persist across reboots.' : 'Connection active until terminal closes.',
      ],
      details: result.output,
    };
  } else {
    return {
      success: false,
      message: `Failed to connect to OpenClaw gateway "${name}".`,
      error: result.error,
      hint: 'Make sure the gateway is exposed with: connect expose localhost:18789 --name openclaw',
    };
  }
}

/**
 * Tool definitions for OpenClaw
 */
export const toolDefinitions = {
  connect_reach: {
    name: 'connect_reach',
    description: 'Connect to a private service by name. Use this when the user wants to access a database, API, or other service.',
    parameters: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'The name of the service to connect to (e.g., "staging-db", "prod-api", "jupyter-gpu")',
        },
        port: {
          type: 'number',
          description: 'Optional local port to bind to. If not specified, uses the service default.',
        },
      },
      required: ['service'],
    },
  },
  
  connect_status: {
    name: 'connect_status',
    description: 'Show available services and their connection status. Use this when the user asks what services are available or wants to check service health.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  
  connect_share: {
    name: 'connect_share',
    description: 'Share the current environment with a teammate. Creates a share code they can use to join.',
    parameters: {
      type: 'object',
      properties: {
        expires: {
          type: 'string',
          description: 'How long the share should last (e.g., "1h", "24h", "7d"). Default is 24h.',
        },
        name: {
          type: 'string',
          description: 'A friendly name for this share.',
        },
      },
    },
  },
  
  connect_join: {
    name: 'connect_join',
    description: 'Join a shared environment using a share code from a teammate.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The share code to join (e.g., "x7k9m2")',
        },
      },
      required: ['code'],
    },
  },
  
  connect_clone: {
    name: 'connect_clone',
    description: 'Clone a teammate\'s entire environment setup. All their exposed services become available to you.',
    parameters: {
      type: 'object',
      properties: {
        teammate: {
          type: 'string',
          description: 'The name or label of the teammate to clone (e.g., "alice", "bob")',
        },
      },
      required: ['teammate'],
    },
  },
  
  connect_list_shares: {
    name: 'connect_list_shares',
    description: 'List all active environment shares.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  
  connect_revoke: {
    name: 'connect_revoke',
    description: 'Revoke an active share, removing access for anyone who joined.',
    parameters: {
      type: 'object',
      properties: {
        code: {
          type: 'string',
          description: 'The share code to revoke',
        },
      },
      required: ['code'],
    },
  },
  
  connect_expose: {
    name: 'connect_expose',
    description: 'Expose a local service so others can reach it. Use this to share a database, API, or dev server with teammates.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          description: 'The local address to expose (e.g., "localhost:5432", "localhost:8080")',
        },
        name: {
          type: 'string',
          description: 'A name for the service (e.g., "staging-db", "my-api")',
        },
      },
      required: ['target', 'name'],
    },
  },
  
  connect_expose_gateway: {
    name: 'connect_expose_gateway',
    description: 'Expose the OpenClaw gateway (localhost:18789) for secure remote access. Use this when you want to access OpenClaw from your phone, laptop, or other devices while it runs on a server.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name for the exposed gateway. Default is "openclaw".',
        },
        persistent: {
          type: 'boolean',
          description: 'Install daemon for persistent connection across reboots. Default is true.',
        },
      },
    },
  },
  
  connect_reach_gateway: {
    name: 'connect_reach_gateway',
    description: 'Connect to a remote OpenClaw gateway. Use this when OpenClaw runs on a server and you want to access it from your current device.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the exposed gateway to connect to. Default is "openclaw".',
        },
        persistent: {
          type: 'boolean',
          description: 'Install daemon for persistent connection across reboots. Default is true.',
        },
      },
    },
  },
};
