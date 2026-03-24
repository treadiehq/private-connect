import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn, spawnSync } from 'child_process';
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
      name: 'get_service_status',
      description: 'Check if a service is online and get its tunnel port. Does NOT establish a tunnel — use "connect reach <name>" in the terminal to create one.',
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

        case 'get_service_status': {
          const serviceName = args.service as string;

          const services = await refreshServices();
          const service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());

          if (!service) {
            throw new Error(`Service "${serviceName}" not found`);
          }

          const isOnline = !!service.tunnelPort;

          result = {
            service: serviceName,
            status: isOnline ? 'online' : 'offline',
            tunnelPort: service.tunnelPort || null,
            targetHost: service.targetHost,
            targetPort: service.targetPort,
            protocol: service.protocol,
            agent: service.agentLabel,
            hint: isOnline
              ? `Service is online. If you need a local tunnel, run: connect reach ${serviceName}`
              : `Service is offline. The agent exposing it may not be running.`,
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
          const evaluation = evaluateFileWrite(policy, filePath, workingDir);
          
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
          const evaluation = evaluateFileWrite(policy, filePath, workingDir);
          
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
            try {
              const proc = spawnSync('sh', ['-c', command], {
                cwd: cmdWorkingDir,
                encoding: 'utf-8',
                timeout: 30000,
                maxBuffer: 1024 * 1024,
                shell: false,
              });

              logCommand(command, 'allow', {
                agent: 'mcp',
                rule: evaluation.rule?.command,
                workingDir: cmdWorkingDir,
              });

              if (proc.status === 0) {
                result = {
                  success: true,
                  action: 'allow',
                  output: (proc.stdout || '').trim(),
                };
              } else {
                result = {
                  success: false,
                  action: 'error',
                  exitCode: proc.status,
                  stderr: (proc.stderr || '').trim(),
                  reason: `Command exited with code ${proc.status}`,
                };
              }
            } catch (err) {
              const error = err as { message: string };
              result = {
                success: false,
                action: 'error',
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
  console.log(chalk.gray('    • List and check service status'));
  console.log(chalk.gray('    • Get connection strings for databases and APIs'));
  console.log(chalk.gray('    • Discover and message other agents'));
  console.log(chalk.gray('    • Run policy-checked commands via the broker'));
  console.log();
  
  console.log(chalk.white('  Example prompts:\n'));
  console.log(chalk.cyan('    "List all my connected services"'));
  console.log(chalk.cyan('    "Get the connection string for staging-db"'));
  console.log(chalk.cyan('    "Check if the user-service is online"'));
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
