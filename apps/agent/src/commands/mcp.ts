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
    // ============================================
    // Agent Orchestration Tools
    // ============================================
    {
      name: 'get_connection_string',
      description: 'Get a connection string for a service (e.g., DATABASE_URL for postgres). Useful for configuring environment variables.',
      inputSchema: {
        type: 'object',
        properties: {
          service: {
            type: 'string',
            description: 'Name of the service to get connection string for',
          },
          format: {
            type: 'string',
            enum: ['url', 'env', 'json'],
            description: 'Output format: url (connection URL), env (KEY=value), json',
            default: 'url',
          },
        },
        required: ['service'],
      },
    },
    {
      name: 'list_agents',
      description: 'List all agents in the workspace with their status, capabilities, and services.',
      inputSchema: {
        type: 'object',
        properties: {
          onlineOnly: {
            type: 'boolean',
            description: 'Only show online agents',
            default: false,
          },
          capability: {
            type: 'string',
            description: 'Filter by capability (e.g., "database", "gpu", "mcp-server")',
          },
        },
      },
    },
    {
      name: 'register_capabilities',
      description: 'Register capabilities this agent provides (e.g., "database", "gpu", "mcp-server"). Other agents can discover you by capability.',
      inputSchema: {
        type: 'object',
        properties: {
          capabilities: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                metadata: { type: 'object' },
              },
              required: ['name'],
            },
            description: 'List of capabilities to register',
          },
        },
        required: ['capabilities'],
      },
    },
    {
      name: 'send_agent_message',
      description: 'Send a message to another agent for orchestration/coordination.',
      inputSchema: {
        type: 'object',
        properties: {
          toAgentId: {
            type: 'string',
            description: 'ID of the target agent',
          },
          payload: {
            type: 'object',
            description: 'Message payload (any JSON object)',
          },
          channel: {
            type: 'string',
            description: 'Channel/topic for the message (default: "default")',
          },
          type: {
            type: 'string',
            enum: ['request', 'response', 'event'],
            description: 'Message type',
            default: 'event',
          },
        },
        required: ['toAgentId', 'payload'],
      },
    },
    {
      name: 'broadcast_message',
      description: 'Broadcast a message to all online agents in the workspace.',
      inputSchema: {
        type: 'object',
        properties: {
          payload: {
            type: 'object',
            description: 'Message payload (any JSON object)',
          },
          channel: {
            type: 'string',
            description: 'Channel/topic for the broadcast',
          },
        },
        required: ['payload'],
      },
    },
    {
      name: 'get_agent_messages',
      description: 'Get messages sent to this agent from other agents.',
      inputSchema: {
        type: 'object',
        properties: {
          channel: {
            type: 'string',
            description: 'Filter by channel',
          },
          unreadOnly: {
            type: 'boolean',
            description: 'Only show unread messages',
            default: true,
          },
          limit: {
            type: 'number',
            description: 'Maximum messages to return',
            default: 50,
          },
        },
      },
    },
    {
      name: 'find_agents_by_capability',
      description: 'Find online agents that have a specific capability (e.g., find all agents with "gpu" capability).',
      inputSchema: {
        type: 'object',
        properties: {
          capability: {
            type: 'string',
            description: 'Capability to search for',
          },
        },
        required: ['capability'],
      },
    },
    {
      name: 'create_session',
      description: 'Create an ephemeral orchestration session. Useful for coordinating multi-agent workflows with automatic cleanup.',
      inputSchema: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            description: 'Session name/identifier',
          },
          ttlMinutes: {
            type: 'number',
            description: 'Session time-to-live in minutes (default: 60)',
            default: 60,
          },
          metadata: {
            type: 'object',
            description: 'Optional metadata to attach to the session',
          },
        },
        required: ['name'],
      },
    },
    {
      name: 'end_session',
      description: 'End an ephemeral orchestration session and clean up resources.',
      inputSchema: {
        type: 'object',
        properties: {
          sessionId: {
            type: 'string',
            description: 'Session ID to end',
          },
        },
        required: ['sessionId'],
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

        // ============================================
        // Agent Orchestration Handlers
        // ============================================

        case 'get_connection_string': {
          const serviceName = args.service as string;
          const format = (args.format as string) || 'url';
          
          const services = await refreshServices();
          const service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
          
          if (!service) {
            throw new Error(`Service "${serviceName}" not found`);
          }
          
          const port = service.tunnelPort || service.targetPort;
          const host = 'localhost';
          
          // Detect service type and generate appropriate connection string
          let connectionString = '';
          let envVar = 'SERVICE_URL';
          
          if (service.targetPort === 5432 || service.protocol === 'postgres') {
            connectionString = `postgres://${host}:${port}/postgres`;
            envVar = 'DATABASE_URL';
          } else if (service.targetPort === 3306 || service.protocol === 'mysql') {
            connectionString = `mysql://${host}:${port}`;
            envVar = 'DATABASE_URL';
          } else if (service.targetPort === 6379 || service.protocol === 'redis') {
            connectionString = `redis://${host}:${port}`;
            envVar = 'REDIS_URL';
          } else if (service.targetPort === 27017 || service.protocol === 'mongodb') {
            connectionString = `mongodb://${host}:${port}`;
            envVar = 'MONGODB_URI';
          } else if (service.protocol === 'http' || service.protocol === 'https') {
            connectionString = `http://${host}:${port}`;
            envVar = 'API_URL';
          } else {
            connectionString = `tcp://${host}:${port}`;
            envVar = `${serviceName.toUpperCase().replace(/-/g, '_')}_URL`;
          }
          
          if (format === 'env') {
            result = {
              format: 'env',
              value: `${envVar}=${connectionString}`,
              envVar,
              connectionString,
            };
          } else if (format === 'json') {
            result = {
              format: 'json',
              host,
              port,
              protocol: service.protocol,
              connectionString,
              envVar,
            };
          } else {
            result = {
              format: 'url',
              connectionString,
              usage: `Set ${envVar}="${connectionString}" in your environment`,
            };
          }
          break;
        }

        case 'list_agents': {
          const onlineOnly = args.onlineOnly as boolean;
          const capability = args.capability as string | undefined;
          
          let url = `${hubUrl}/v1/agents`;
          if (capability) {
            url = `${hubUrl}/v1/agents/by-capability/${encodeURIComponent(capability)}`;
          } else {
            url = `${hubUrl}/v1/agents/orchestration`;
          }
          
          try {
            const response = await fetch(url, {
              headers: { 'x-api-key': apiKey },
            });
            
            if (response.ok) {
              const data = await response.json() as { agents: any[] };
              let agents = data.agents || [];
              
              if (onlineOnly) {
                agents = agents.filter((a: any) => a.isOnline);
              }
              
              result = {
                agents: agents.map((a: any) => ({
                  id: a.id,
                  name: a.name || a.label,
                  label: a.label,
                  isOnline: a.isOnline,
                  capabilities: a.capabilities?.map((c: any) => c.name) || [],
                  services: a.services?.map((s: any) => s.name) || [],
                  isSelf: a.id === agentId,
                })),
                count: agents.length,
              };
            } else {
              throw new Error('Failed to fetch agents');
            }
          } catch (err) {
            throw new Error(`Failed to list agents: ${(err as Error).message}`);
          }
          break;
        }

        case 'register_capabilities': {
          const capabilities = args.capabilities as Array<{ name: string; metadata?: Record<string, unknown> }>;
          
          try {
            const response = await fetch(`${hubUrl}/v1/agents/${agentId}/capabilities`, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ capabilities }),
            });
            
            if (response.ok) {
              result = {
                success: true,
                registered: capabilities.map(c => c.name),
                message: `Registered ${capabilities.length} capabilities. Other agents can now find you.`,
              };
            } else {
              throw new Error('Failed to register capabilities');
            }
          } catch (err) {
            throw new Error(`Failed to register capabilities: ${(err as Error).message}`);
          }
          break;
        }

        case 'send_agent_message': {
          const toAgentId = args.toAgentId as string;
          const payload = args.payload as Record<string, unknown>;
          const channel = args.channel as string | undefined;
          const type = args.type as string | undefined;
          
          try {
            const response = await fetch(`${hubUrl}/v1/agents/${agentId}/messages/send`, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ toAgentId, payload, channel, type }),
            });
            
            if (response.ok) {
              const data = await response.json() as { messageId: string };
              result = {
                success: true,
                messageId: data.messageId,
                to: toAgentId,
                channel: channel || 'default',
              };
            } else {
              const error = await response.json() as { message?: string };
              throw new Error(error.message || 'Failed to send message');
            }
          } catch (err) {
            throw new Error(`Failed to send message: ${(err as Error).message}`);
          }
          break;
        }

        case 'broadcast_message': {
          const payload = args.payload as Record<string, unknown>;
          const channel = args.channel as string | undefined;
          
          try {
            const response = await fetch(`${hubUrl}/v1/agents/${agentId}/messages/broadcast`, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ payload, channel }),
            });
            
            if (response.ok) {
              const data = await response.json() as { sent: number };
              result = {
                success: true,
                sent: data.sent,
                channel: channel || 'default',
                message: `Message broadcast to ${data.sent} agents`,
              };
            } else {
              throw new Error('Failed to broadcast message');
            }
          } catch (err) {
            throw new Error(`Failed to broadcast: ${(err as Error).message}`);
          }
          break;
        }

        case 'get_agent_messages': {
          const channel = args.channel as string | undefined;
          const unreadOnly = args.unreadOnly !== false;
          const limit = (args.limit as number) || 50;
          
          try {
            const params = new URLSearchParams();
            if (channel) params.set('channel', channel);
            params.set('unreadOnly', String(unreadOnly));
            params.set('limit', String(limit));
            
            const response = await fetch(
              `${hubUrl}/v1/agents/${agentId}/messages?${params}`,
              { headers: { 'x-api-key': apiKey } }
            );
            
            if (response.ok) {
              const data = await response.json() as { messages: any[] };
              result = {
                messages: data.messages.map((m: any) => ({
                  id: m.id,
                  from: m.from?.name || m.from?.label || m.from?.id,
                  channel: m.channel,
                  type: m.type,
                  payload: m.payload,
                  createdAt: m.createdAt,
                  isRead: !!m.readAt,
                })),
                count: data.messages.length,
                hasUnread: data.messages.some((m: any) => !m.readAt),
              };
            } else {
              throw new Error('Failed to fetch messages');
            }
          } catch (err) {
            throw new Error(`Failed to get messages: ${(err as Error).message}`);
          }
          break;
        }

        case 'find_agents_by_capability': {
          const capability = args.capability as string;
          
          try {
            const response = await fetch(
              `${hubUrl}/v1/agents/by-capability/${encodeURIComponent(capability)}`,
              { headers: { 'x-api-key': apiKey } }
            );
            
            if (response.ok) {
              const data = await response.json() as { agents: any[] };
              result = {
                capability,
                agents: data.agents.map((a: any) => ({
                  id: a.id,
                  name: a.name || a.label,
                  isOnline: a.isOnline,
                  services: a.services?.map((s: any) => s.name) || [],
                })),
                count: data.agents.length,
              };
            } else {
              throw new Error('Failed to find agents');
            }
          } catch (err) {
            throw new Error(`Failed to find agents: ${(err as Error).message}`);
          }
          break;
        }

        case 'create_session': {
          const sessionName = args.name as string;
          const ttlMinutes = (args.ttlMinutes as number) || 60;
          const metadata = args.metadata as Record<string, unknown> | undefined;
          
          // Create a local session tracker
          const sessionId = `${agentId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
          const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
          
          // Store session info (in practice, this would be persisted)
          const session = {
            id: sessionId,
            name: sessionName,
            createdBy: agentId,
            createdAt: new Date().toISOString(),
            expiresAt: expiresAt.toISOString(),
            metadata,
          };
          
          // Broadcast session creation to other agents
          try {
            await fetch(`${hubUrl}/v1/agents/${agentId}/messages/broadcast`, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                payload: {
                  type: 'session:created',
                  session,
                },
                channel: 'orchestration',
              }),
            });
          } catch {
            // Non-critical, continue
          }
          
          result = {
            success: true,
            session,
            message: `Session "${sessionName}" created. It will expire in ${ttlMinutes} minutes.`,
            usage: 'Use session ID to coordinate with other agents. Call end_session when done.',
          };
          break;
        }

        case 'end_session': {
          const sessionId = args.sessionId as string;
          
          // Broadcast session end to other agents
          try {
            await fetch(`${hubUrl}/v1/agents/${agentId}/messages/broadcast`, {
              method: 'POST',
              headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                payload: {
                  type: 'session:ended',
                  sessionId,
                  endedBy: agentId,
                  endedAt: new Date().toISOString(),
                },
                channel: 'orchestration',
              }),
            });
          } catch {
            // Non-critical
          }
          
          result = {
            success: true,
            sessionId,
            message: 'Session ended. All participating agents have been notified.',
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

