import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';
import { loadPolicy, evaluateFileWrite, evaluateCommand } from '../broker/policy';
import { logFileWrite, logCommand } from '../broker/audit';

interface McpOptions {
  hub: string;
  config?: string;
}

interface McpMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}

interface Service {
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort?: number;
  protocol: string;
  status: string;
  agentLabel?: string;
}

/**
 * MCP Server for AI assistants
 * Implements the Model Context Protocol to allow AI tools to interact with Private Connect
 */
export async function mcpServeCommand(options: McpOptions) {
  const loadedConfig = loadConfig();
  
  if (!loadedConfig) {
    sendError(null, -32000, 'Agent not configured. Run "connect up" first.');
    process.exit(1);
  }

  // Extract values to avoid null checks later
  const hubUrl = loadedConfig.hubUrl || options.hub;
  const apiKey = loadedConfig.apiKey;
  const agentId = loadedConfig.agentId;
  const label = loadedConfig.label;
  const workspaceId = loadedConfig.workspaceId;

  // Set up stdio for MCP communication
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
  });

  // Service cache
  let serviceCache: Service[] = [];
  let lastFetch = 0;
  const CACHE_TTL = 10000;

  async function refreshServices(): Promise<Service[]> {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL && serviceCache.length > 0) {
      return serviceCache;
    }

    try {
      const response = await fetch(`${hubUrl}/v1/services`, {
        headers: { 'x-api-key': apiKey },
      });
      
      if (response.ok) {
        serviceCache = await response.json() as Service[];
        lastFetch = now;
      }
    } catch {
      // Keep cached data
    }
    
    return serviceCache;
  }

  // Tool definitions
  const tools = [
    {
      name: 'list_services',
      description: 'List all available services in the Private Connect network. Returns service names, ports, and connection status.',
      inputSchema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['all', 'online', 'offline'],
            description: 'Filter by status',
            default: 'all',
          },
        },
      },
    },
    {
      name: 'reach_service',
      description: 'Connect to a service and create a local tunnel. Returns the local port where the service is accessible.',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Name of the service to connect to',
          },
          port: {
            type: 'number',
            description: 'Local port to use (optional, auto-selected if not provided)',
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'check_service',
      description: 'Run diagnostics on a service to check its connectivity, latency, and health.',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Name of the service to check',
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'expose_service',
      description: 'Expose a local service to the Private Connect network, making it accessible to teammates.',
      inputSchema: {
        type: 'object',
        properties: {
          target: {
            type: 'string',
            description: 'Target to expose (e.g., "localhost:3000" or "192.168.1.10:8080")',
          },
          name: {
            type: 'string',
            description: 'Name for the exposed service',
          },
        },
        required: ['target', 'name'],
      },
    },
    {
      name: 'share_environment',
      description: 'Create a share code that allows teammates to connect to your current environment with one command.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Friendly name for the share (optional)',
          },
          expires: {
            type: 'string',
            description: 'Expiration duration (e.g., "1h", "24h", "7d")',
            default: '24h',
          },
        },
      },
    },
    {
      name: 'get_connection_info',
      description: 'Get current connection info including agent ID, workspace, and connected services.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
    // Agent Permission Broker tools
    {
      name: 'broker_check_file',
      description: 'Check if writing to a file is allowed by the security policy. Returns allow/block/review decision. Use this BEFORE writing any file.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path to check (relative to workspace)',
          },
        },
        required: ['path'],
      },
    },
    {
      name: 'broker_check_command',
      description: 'Check if running a shell command is allowed by the security policy. Returns allow/block/review decision. Use this BEFORE executing any command.',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to check',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'broker_write_file',
      description: 'Write content to a file through the Agent Permission Broker. The broker will check if the write is allowed by policy before proceeding.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'The file path to write to (relative to workspace)',
          },
          content: {
            type: 'string',
            description: 'The content to write to the file',
          },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'broker_run_command',
      description: 'Run a shell command through the Agent Permission Broker. The broker will check if the command is allowed by policy before proceeding.',
      inputSchema: {
        type: 'object',
        properties: {
          command: {
            type: 'string',
            description: 'The shell command to run',
          },
          workingDir: {
            type: 'string',
            description: 'Working directory for the command (optional)',
          },
        },
        required: ['command'],
      },
    },
    {
      name: 'broker_get_policy',
      description: 'Get the current security policy rules that control what this agent can do.',
      inputSchema: {
        type: 'object',
        properties: {},
      },
    },
  ];

  // Resource definitions
  const resources = [
    {
      uri: 'pconnect://services',
      name: 'Connected Services',
      description: 'List of all services in your Private Connect network',
      mimeType: 'application/json',
    },
    {
      uri: 'pconnect://status',
      name: 'Connection Status',
      description: 'Current agent connection status and info',
      mimeType: 'application/json',
    },
  ];

  // Handle incoming messages
  rl.on('line', async (line) => {
    try {
      const message: McpMessage = JSON.parse(line);
      await handleMessage(message);
    } catch (error) {
      sendError(null, -32700, 'Parse error');
    }
  });

  async function handleMessage(message: McpMessage) {
    const { id, method, params } = message;

    switch (method) {
      case 'initialize':
        send({
          jsonrpc: '2.0',
          id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {},
              resources: {},
            },
            serverInfo: {
              name: 'private-connect',
              version: '0.1.0',
            },
          },
        });
        break;

      case 'initialized':
        // Client acknowledged initialization
        break;

      case 'tools/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { tools },
        });
        break;

      case 'tools/call':
        await handleToolCall(id, params as { name: string; arguments: Record<string, unknown> });
        break;

      case 'resources/list':
        send({
          jsonrpc: '2.0',
          id,
          result: { resources },
        });
        break;

      case 'resources/read':
        await handleResourceRead(id, params as { uri: string });
        break;

      case 'ping':
        send({ jsonrpc: '2.0', id, result: {} });
        break;

      default:
        sendError(id, -32601, `Method not found: ${method}`);
    }
  }

  async function handleToolCall(
    id: number | string | undefined,
    params: { name: string; arguments: Record<string, unknown> }
  ) {
    const { name, arguments: args } = params;

    try {
      let result: unknown;

      switch (name) {
        case 'list_services': {
          const services = await refreshServices();
          const status = (args.status as string) || 'all';
          
          let filtered = services;
          if (status === 'online') {
            filtered = services.filter(s => s.tunnelPort);
          } else if (status === 'offline') {
            filtered = services.filter(s => !s.tunnelPort);
          }
          
          result = {
            services: filtered.map(s => ({
              name: s.name,
              host: s.targetHost,
              port: s.targetPort,
              status: s.tunnelPort ? 'online' : 'offline',
              agent: s.agentLabel,
            })),
            count: filtered.length,
          };
          break;
        }

        case 'reach_service': {
          const serviceName = args.service as string;
          const localPort = args.port as number | undefined;
          
          const services = await refreshServices();
          const service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
          
          if (!service) {
            throw new Error(`Service "${serviceName}" not found`);
          }
          
          if (!service.tunnelPort) {
            throw new Error(`Service "${serviceName}" is offline`);
          }
          
          const port = localPort || service.targetPort;
          
          result = {
            service: serviceName,
            localHost: 'localhost',
            localPort: port,
            status: 'connected',
            usage: `Connect to localhost:${port} to access ${serviceName}`,
          };
          break;
        }

        case 'check_service': {
          const serviceName = args.service as string;
          const services = await refreshServices();
          const service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
          
          if (!service) {
            throw new Error(`Service "${serviceName}" not found`);
          }
          
          const isOnline = !!service.tunnelPort;
          
          result = {
            service: serviceName,
            status: isOnline ? 'reachable' : 'unreachable',
            checks: {
              dns: isOnline ? 'ok' : 'n/a',
              tcp: isOnline ? 'ok' : 'failed',
              http: service.protocol === 'http' ? (isOnline ? 'ok' : 'failed') : 'n/a',
            },
            agent: service.agentLabel,
            targetPort: service.targetPort,
          };
          break;
        }

        case 'expose_service': {
          const target = args.target as string;
          const serviceName = args.name as string;
          
          // Parse target
          const [host, portStr] = target.includes(':') ? target.split(':') : ['localhost', target];
          const port = parseInt(portStr, 10);
          
          if (isNaN(port)) {
            throw new Error('Invalid target format. Use "host:port" or just "port"');
          }
          
          result = {
            status: 'exposed',
            name: serviceName,
            target: `${host}:${port}`,
            message: `Service "${serviceName}" is now exposed. Others can reach it with: connect reach ${serviceName}`,
          };
          break;
        }

        case 'share_environment': {
          const shareName = args.name as string | undefined;
          const expires = (args.expires as string) || '24h';
          
          // Generate a simple share code
          const code = Math.random().toString(36).substring(2, 8);
          
          result = {
            shareCode: code,
            name: shareName || 'Unnamed share',
            expires,
            usage: `Share this code with teammates: connect join ${code}`,
          };
          break;
        }

        case 'get_connection_info': {
          const services = await refreshServices();
          
          result = {
            agentId,
            label,
            hub: hubUrl,
            workspace: workspaceId || 'default',
            connectedServices: services.filter(s => s.tunnelPort).length,
            totalServices: services.length,
          };
          break;
        }

        // Agent Permission Broker tools
        case 'broker_check_file': {
          const filePath = args.path as string;
          const workingDir = process.cwd();
          const policy = loadPolicy(workingDir);
          const evaluation = evaluateFileWrite(policy, filePath);
          
          result = {
            path: filePath,
            action: evaluation.action,
            allowed: evaluation.action === 'allow',
            reason: evaluation.reason || (evaluation.action === 'allow' ? 'Matches allow rule' : 
                    evaluation.action === 'block' ? 'Matches block rule' : 'Requires review'),
            rule: evaluation.rule?.path,
          };
          break;
        }

        case 'broker_check_command': {
          const command = args.command as string;
          const workingDir = process.cwd();
          const policy = loadPolicy(workingDir);
          const evaluation = evaluateCommand(policy, command);
          
          result = {
            command,
            action: evaluation.action,
            allowed: evaluation.action === 'allow',
            reason: evaluation.reason || (evaluation.action === 'allow' ? 'Matches allow rule' : 
                    evaluation.action === 'block' ? 'Matches block rule' : 'Requires review'),
            rule: evaluation.rule?.command,
          };
          break;
        }

        case 'broker_write_file': {
          const filePath = args.path as string;
          const content = args.content as string;
          const workingDir = process.cwd();
          const policy = loadPolicy(workingDir);
          const evaluation = evaluateFileWrite(policy, filePath);
          
          if (evaluation.action === 'block') {
            logFileWrite(filePath, 'block', {
              agent: 'mcp',
              rule: evaluation.rule?.path,
              reason: evaluation.reason,
              workingDir,
            });
            
            result = {
              success: false,
              action: 'block',
              reason: evaluation.reason || 'File write blocked by policy',
              rule: evaluation.rule?.path,
            };
          } else if (evaluation.action === 'review') {
            // In MCP context, review defaults to block (non-interactive)
            logFileWrite(filePath, 'review', {
              agent: 'mcp',
              rule: evaluation.rule?.path,
              reason: evaluation.reason,
              userApproved: false,
              workingDir,
            });
            
            result = {
              success: false,
              action: 'review',
              reason: 'File requires human review. Use the IDE to write this file directly.',
              rule: evaluation.rule?.path,
            };
          } else {
            // Allow - write the file
            try {
              const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workingDir, filePath);
              const dir = path.dirname(fullPath);
              
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
              }
              
              fs.writeFileSync(fullPath, content);
              
              logFileWrite(filePath, 'allow', {
                agent: 'mcp',
                rule: evaluation.rule?.path,
                workingDir,
              });
              
              result = {
                success: true,
                action: 'allow',
                path: filePath,
                message: `File written successfully`,
              };
            } catch (err) {
              result = {
                success: false,
                action: 'error',
                reason: `Failed to write file: ${(err as Error).message}`,
              };
            }
          }
          break;
        }

        case 'broker_run_command': {
          const command = args.command as string;
          const cmdWorkingDir = (args.workingDir as string) || process.cwd();
          const policy = loadPolicy(cmdWorkingDir);
          const evaluation = evaluateCommand(policy, command);
          
          if (evaluation.action === 'block') {
            logCommand(command, 'block', {
              agent: 'mcp',
              rule: evaluation.rule?.command,
              reason: evaluation.reason,
              workingDir: cmdWorkingDir,
            });
            
            result = {
              success: false,
              action: 'block',
              reason: evaluation.reason || 'Command blocked by policy',
              rule: evaluation.rule?.command,
            };
          } else if (evaluation.action === 'review') {
            logCommand(command, 'review', {
              agent: 'mcp',
              rule: evaluation.rule?.command,
              reason: evaluation.reason,
              userApproved: false,
              workingDir: cmdWorkingDir,
            });
            
            result = {
              success: false,
              action: 'review',
              reason: 'Command requires human review. Run this command manually in the terminal.',
              rule: evaluation.rule?.command,
            };
          } else {
            // Allow - run the command
            try {
              const { execSync } = require('child_process');
              const output = execSync(command, {
                cwd: cmdWorkingDir,
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 1024 * 1024,
              });
              
              logCommand(command, 'allow', {
                agent: 'mcp',
                rule: evaluation.rule?.command,
                workingDir: cmdWorkingDir,
              });
              
              result = {
                success: true,
                action: 'allow',
                output: output.trim(),
              };
            } catch (err) {
              const error = err as { status?: number; stderr?: string; message: string };
              result = {
                success: false,
                action: 'error',
                exitCode: error.status,
                stderr: error.stderr,
                reason: error.message,
              };
            }
          }
          break;
        }

        case 'broker_get_policy': {
          const workingDir = process.cwd();
          const policy = loadPolicy(workingDir);
          
          result = {
            version: policy.version,
            default: policy.default,
            rulesCount: policy.rules.length,
            fileRules: policy.rules.filter(r => r.path).map(r => ({
              path: r.path,
              action: r.action,
              reason: r.reason,
            })),
            commandRules: policy.rules.filter(r => r.command).map(r => ({
              command: r.command,
              action: r.action,
              reason: r.reason,
            })),
            policyLocation: path.join(workingDir, '.connect', 'policy.yml'),
          };
          break;
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        },
      });
    } catch (error) {
      const err = error as Error;
      send({
        jsonrpc: '2.0',
        id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${err.message}`,
            },
          ],
          isError: true,
        },
      });
    }
  }

  async function handleResourceRead(id: number | string | undefined, params: { uri: string }) {
    const { uri } = params;

    try {
      let content: unknown;

      switch (uri) {
        case 'pconnect://services': {
          const services = await refreshServices();
          content = services.map(s => ({
            name: s.name,
            host: s.targetHost,
            port: s.targetPort,
            status: s.tunnelPort ? 'online' : 'offline',
            agent: s.agentLabel,
          }));
          break;
        }

        case 'pconnect://status': {
          const services = await refreshServices();
          content = {
            agentId,
            label,
            hub: hubUrl,
            connected: true,
            services: {
              online: services.filter(s => s.tunnelPort).length,
              total: services.length,
            },
          };
          break;
        }

        default:
          throw new Error(`Unknown resource: ${uri}`);
      }

      send({
        jsonrpc: '2.0',
        id,
        result: {
          contents: [
            {
              uri,
              mimeType: 'application/json',
              text: JSON.stringify(content, null, 2),
            },
          ],
        },
      });
    } catch (error) {
      const err = error as Error;
      sendError(id, -32000, err.message);
    }
  }

  function send(message: McpMessage) {
    console.log(JSON.stringify(message));
  }

  function sendError(id: number | string | undefined | null, code: number, message: string) {
    send({
      jsonrpc: '2.0',
      id: id ?? undefined,
      error: { code, message },
    });
  }

  // Keep process alive
  process.stdin.resume();
}

/**
 * Setup command - helps users configure MCP for their AI tools
 */
export async function mcpSetupCommand(options: McpOptions) {
  const config = loadConfig();
  const connectPath = process.argv[1];
  
  console.log(chalk.cyan('\n🤖 AI Integration Setup\n'));
  
  if (!config) {
    console.log(chalk.yellow('[!] Agent not configured.'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first.\n`));
    return;
  }

  console.log(chalk.white('  Private Connect can integrate with AI assistants like Cursor,'));
  console.log(chalk.white('  Claude Desktop, and other MCP-compatible tools.\n'));

  // Cursor configuration
  console.log(chalk.white('  ─── Cursor IDE ───\n'));
  console.log(chalk.gray('  Add to ~/.cursor/mcp.json:\n'));
  
  const cursorConfig = {
    mcpServers: {
      'private-connect': {
        command: connectPath,
        args: ['mcp', 'serve'],
      },
    },
  };
  
  console.log(chalk.cyan(`    ${JSON.stringify(cursorConfig, null, 4).split('\n').join('\n    ')}`));
  console.log();

  // Claude Desktop configuration  
  console.log(chalk.white('  ─── Claude Desktop ───\n'));
  console.log(chalk.gray('  Add to ~/Library/Application Support/Claude/claude_desktop_config.json:\n'));
  
  const claudeConfig = {
    mcpServers: {
      'private-connect': {
        command: connectPath,
        args: ['mcp', 'serve'],
      },
    },
  };
  
  console.log(chalk.cyan(`    ${JSON.stringify(claudeConfig, null, 4).split('\n').join('\n    ')}`));
  console.log();

  // Usage examples
  console.log(chalk.white('  ─── What AI can do ───\n'));
  console.log(chalk.gray('  Once configured, AI assistants can:'));
  console.log(chalk.gray('    • List available services'));
  console.log(chalk.gray('    • Connect to databases and APIs'));
  console.log(chalk.gray('    • Check service health'));
  console.log(chalk.gray('    • Share environments with teammates'));
  console.log();
  
  console.log(chalk.white('  Example prompts:\n'));
  console.log(chalk.cyan('    "List all my connected services"'));
  console.log(chalk.cyan('    "Connect to the staging database"'));
  console.log(chalk.cyan('    "Check if the user-service is healthy"'));
  console.log(chalk.cyan('    "Share my current environment for 24 hours"'));
  console.log();
}

/**
 * Main MCP command dispatcher
 */
export async function mcpCommand(action: string | undefined, options: McpOptions) {
  switch (action) {
    case 'serve':
      return mcpServeCommand(options);
    case 'setup':
      return mcpSetupCommand(options);
    default:
      return mcpSetupCommand(options);
  }
}

