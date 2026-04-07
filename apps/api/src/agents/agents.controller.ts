import { Controller, Post, Body, Get, Delete, Param, Query, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { AgentsService, VALID_CLIENT_TYPES } from './agents.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { PROVISION_CONFIG } from '../common/security';
import { z } from 'zod';

const RegisterSchema = z.object({
  agentId: z.string().uuid(),
  token: z.string().min(32),
  label: z.string().optional(),
  name: z.string().optional(),
});

const HeartbeatSchema = z.object({
  agentId: z.string().uuid(),
  token: z.string().min(32),
});

const RotateTokenSchema = z.object({
  agentId: z.string().uuid(),
  currentToken: z.string().min(32),
});

const SendMessageSchema = z.object({
  toAgentId: z.string().uuid(),
  payload: z.record(z.unknown()),
  channel: z.string().optional(),
  type: z.enum(['request', 'response', 'event', 'broadcast']).optional(),
  correlationId: z.string().optional(),
  ttlSeconds: z.number().optional(),
});

const BroadcastMessageSchema = z.object({
  payload: z.record(z.unknown()),
  channel: z.string().optional(),
  ttlSeconds: z.number().optional(),
});

const RegisterCapabilitiesSchema = z.object({
  capabilities: z.array(z.object({
    name: z.string(),
    metadata: z.record(z.unknown()).optional(),
  })),
});

const MarkReadSchema = z.object({
  messageIds: z.array(z.string().uuid()),
});

const ProvisionSchema = z.object({
  clientType: z.enum(VALID_CLIENT_TYPES as unknown as [string, ...string[]]),
  label: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
  ttlSeconds: z.number()
    .int()
    .min(PROVISION_CONFIG.MIN_TTL_SECONDS)
    .max(PROVISION_CONFIG.MAX_TTL_SECONDS)
    .optional(),
});

@ApiTags('Agents')
@Controller('v1/agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post('register')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Register agent', description: 'Registers a new agent in the workspace.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'token'],
      properties: {
        agentId: { type: 'string', format: 'uuid' },
        token: { type: 'string', minLength: 32 },
        label: { type: 'string', example: 'production' },
        name: { type: 'string', example: 'web-server-1' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Agent registered successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async register(
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = RegisterSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    const { agentId, token, label, name } = parsed.data;
    const agent = await this.agentsService.register(workspace.id, agentId, token, label, name);
    
    return { 
      success: true, 
      agent: { 
        id: agent.id, 
        name: agent.name,
        label: agent.label,
        workspaceId: agent.workspaceId,
        createdAt: agent.createdAt,
      } 
    };
  }

  @Post('provision')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Provision agent token',
    description: 'Creates a short-lived agent token programmatically. Used by AI agent runtimes to get workspace access without the device authorization flow.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['clientType'],
      properties: {
        clientType: {
          type: 'string',
          enum: [...VALID_CLIENT_TYPES],
          description: 'The tool requesting access',
          example: 'cursor',
        },
        label: { type: 'string', example: 'staging', maxLength: 100 },
        name: { type: 'string', example: 'cursor-agent-1', maxLength: 100 },
        ttlSeconds: {
          type: 'number',
          minimum: PROVISION_CONFIG.MIN_TTL_SECONDS,
          maximum: PROVISION_CONFIG.MAX_TTL_SECONDS,
          default: PROVISION_CONFIG.DEFAULT_TTL_SECONDS,
          description: 'Token lifetime in seconds (default: 2h, max: 24h)',
        },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Agent provisioned with short-lived token' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async provision(
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = ProvisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const workspace = req.workspace;
    const { clientType, label, name, ttlSeconds } = parsed.data;

    const result = await this.agentsService.provision(workspace.id, clientType, {
      label,
      name,
      ttlSeconds,
    });

    return {
      agentId: result.agentId,
      token: result.token,
      expiresAt: result.expiresAt.toISOString(),
      workspaceId: result.workspaceId,
      workspaceName: result.workspaceName,
    };
  }

  @Post('heartbeat')
  @ApiOperation({ summary: 'Agent heartbeat', description: 'Updates agent last-seen timestamp. Called periodically by connected agents.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'token'],
      properties: {
        agentId: { type: 'string', format: 'uuid' },
        token: { type: 'string', minLength: 32 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Heartbeat recorded' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async heartbeat(@Body() body: unknown) {
    const parsed = HeartbeatSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { agentId, token } = parsed.data;
    
    const valid = await this.agentsService.validateToken(agentId, token);
    if (!valid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    await this.agentsService.heartbeat(agentId);
    return { success: true };
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'List agents', description: 'Returns all agents in the workspace.' })
  @ApiResponse({ status: 200, description: 'List of agents' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async findAll(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.findByWorkspace(workspace.id);
  }

  @Get('online')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'List online agents', description: 'Returns all currently online agents in the workspace.' })
  @ApiResponse({ status: 200, description: 'List of online agents' })
  async getOnlineAgents(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.getOnlineAgents(workspace.id);
  }

  @Get('expiring-tokens')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get agents with expiring tokens', description: 'Returns agents whose tokens will expire soon.' })
  @ApiResponse({ status: 200, description: 'Agents with expiring tokens' })
  async getExpiringTokens(@Req() req: any) {
    const workspace = req.workspace;
    const agents = await this.agentsService.getAgentsWithExpiringTokens(workspace.id);
    return { agents };
  }

  // ============================================
  // Agent Orchestration Endpoints
  // ============================================

  @Get('orchestration')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get agents for orchestration', description: 'Returns all agents with their capabilities and services for orchestration purposes.' })
  @ApiResponse({ status: 200, description: 'Agents with orchestration details' })
  async getAgentsForOrchestration(@Req() req: any) {
    const workspace = req.workspace;
    const agents = await this.agentsService.getAgentsForOrchestration(workspace.id);
    return { 
      agents: agents.map(agent => ({
        id: agent.id,
        name: agent.name,
        label: agent.label,
        isOnline: agent.isOnline,
        lastSeenAt: agent.lastSeenAt,
        capabilities: agent.capabilities.map(c => ({
          name: c.name,
          metadata: c.metadata ? JSON.parse(c.metadata) : null,
        })),
        services: agent.services,
      })),
    };
  }

  @Get(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get agent', description: 'Returns details for a specific agent.' })
  @ApiResponse({ status: 200, description: 'Agent details' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async findOne(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const agent = await this.agentsService.findById(id);
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Verify agent belongs to requester's workspace
    const workspace = req.workspace;
    if (agent.workspaceId !== workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    return agent;
  }

  @Delete(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Delete agent', description: 'Permanently removes an agent and all its associated data (services, messages, capabilities, sessions). If the agent is online it will be disconnected.' })
  @ApiResponse({ status: 200, description: 'Agent deleted successfully' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiResponse({ status: 401, description: 'Invalid API key' })
  async deleteAgent(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const result = await this.agentsService.deleteAgent(id, workspace.id);
    return { success: true, ...result };
  }

  @Post('rotate-token')
  @ApiOperation({ summary: 'Rotate agent token', description: 'Generates a new token for the agent. The current valid token must be provided.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId', 'currentToken'],
      properties: {
        agentId: { type: 'string', format: 'uuid' },
        currentToken: { type: 'string', minLength: 32 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Token rotated successfully' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async rotateToken(@Body() body: unknown) {
    const parsed = RotateTokenSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { agentId, currentToken } = parsed.data;
    const result = await this.agentsService.rotateToken(agentId, currentToken);

    if (!result.success) {
      throw new HttpException(result.error || 'Token rotation failed', HttpStatus.UNAUTHORIZED);
    }

    return {
      success: true,
      newToken: result.newToken,
      expiresAt: result.expiresAt?.toISOString(),
    };
  }

  @Get(':id/audit-logs')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get agent audit logs', description: 'Returns security audit logs for a specific agent.' })
  @ApiResponse({ status: 200, description: 'Audit logs' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async getAuditLogs(
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const agent = await this.agentsService.findById(id);
    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Verify agent belongs to requester's workspace
    const workspace = req.workspace;
    if (agent.workspaceId !== workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    const logs = await this.agentsService.getAuditLogs(id);
    return { logs };
  }

  @Get('by-capability/:capability')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Find agents by capability', description: 'Returns agents that have a specific capability.' })
  @ApiResponse({ status: 200, description: 'Agents with the capability' })
  async findByCapability(
    @Param('capability') capability: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const agents = await this.agentsService.findAgentsByCapability(workspace.id, capability);
    return { agents };
  }

  @Post(':id/capabilities')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Register capabilities', description: 'Registers capabilities for an agent.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['capabilities'],
      properties: {
        capabilities: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', example: 'gpu' },
              metadata: { type: 'object' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Capabilities registered' })
  async registerCapabilities(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = RegisterCapabilitiesSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Verify agent belongs to workspace
    const agent = await this.agentsService.findById(id);
    if (!agent || agent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    const capabilities = await this.agentsService.registerCapabilities(id, parsed.data.capabilities);
    return { success: true, capabilities };
  }

  @Post(':id/messages/send')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Send message to agent', description: 'Sends a message from one agent to another.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['toAgentId', 'payload'],
      properties: {
        toAgentId: { type: 'string', format: 'uuid' },
        payload: { type: 'object' },
        channel: { type: 'string' },
        type: { type: 'string', enum: ['request', 'response', 'event', 'broadcast'] },
        correlationId: { type: 'string' },
        ttlSeconds: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Message sent' })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  async sendMessage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = SendMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Verify sender agent belongs to workspace
    const fromAgent = await this.agentsService.findById(id);
    if (!fromAgent || fromAgent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Verify target agent belongs to same workspace
    const toAgent = await this.agentsService.findById(parsed.data.toAgentId);
    if (!toAgent || toAgent.workspaceId !== req.workspace.id) {
      throw new HttpException('Target agent not found', HttpStatus.NOT_FOUND);
    }

    const message = await this.agentsService.sendMessage(
      id,
      parsed.data.toAgentId,
      req.workspace.id,
      parsed.data.payload,
      {
        channel: parsed.data.channel,
        type: parsed.data.type,
        correlationId: parsed.data.correlationId,
        ttlSeconds: parsed.data.ttlSeconds,
      }
    );

    return { 
      success: true, 
      messageId: message.id,
      expiresAt: message.expiresAt,
    };
  }

  @Post(':id/messages/broadcast')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Broadcast message', description: 'Broadcasts a message to all agents in the workspace.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['payload'],
      properties: {
        payload: { type: 'object' },
        channel: { type: 'string' },
        ttlSeconds: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Message broadcast' })
  async broadcastMessage(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = BroadcastMessageSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Verify agent belongs to workspace
    const agent = await this.agentsService.findById(id);
    if (!agent || agent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    const result = await this.agentsService.broadcastMessage(
      id,
      req.workspace.id,
      parsed.data.payload,
      {
        channel: parsed.data.channel,
        ttlSeconds: parsed.data.ttlSeconds,
      }
    );

    return { success: true, ...result };
  }

  @Get(':id/messages')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get messages', description: 'Returns messages for an agent.' })
  @ApiQuery({ name: 'channel', required: false, description: 'Filter by channel' })
  @ApiQuery({ name: 'unreadOnly', required: false, description: 'Only return unread messages' })
  @ApiQuery({ name: 'limit', required: false, description: 'Limit number of messages' })
  @ApiResponse({ status: 200, description: 'Messages' })
  async getMessages(
    @Param('id') id: string,
    @Query('channel') channel: string | undefined,
    @Query('unreadOnly') unreadOnly: string | undefined,
    @Query('limit') limit: string | undefined,
    @Req() req: any,
  ) {
    // Verify agent belongs to workspace
    const agent = await this.agentsService.findById(id);
    if (!agent || agent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    const messages = await this.agentsService.getMessages(id, {
      channel,
      unreadOnly: unreadOnly !== 'false',
      limit: limit ? parseInt(limit, 10) : undefined,
    });

    return { 
      messages: messages.map(m => ({
        id: m.id,
        from: m.fromAgent,
        channel: m.channel,
        type: m.type,
        payload: JSON.parse(m.payload),
        correlationId: m.correlationId,
        createdAt: m.createdAt,
        readAt: m.readAt,
      })),
    };
  }

  @Post(':id/messages/read')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Mark messages as read', description: 'Marks specified messages as read.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['messageIds'],
      properties: {
        messageIds: { type: 'array', items: { type: 'string', format: 'uuid' } },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Messages marked as read' })
  async markMessagesRead(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = MarkReadSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Verify agent belongs to workspace
    const agent = await this.agentsService.findById(id);
    if (!agent || agent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    await this.agentsService.markMessagesRead(id, parsed.data.messageIds);
    return { success: true };
  }

  // ============================================
  // Agent Command Endpoint
  // ============================================

  @Post(':id/command')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Send command to agent',
    description: 'Sends a command to an agent for remote control. Commands are delivered via WebSocket.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['action'],
      properties: {
        action: {
          type: 'string',
          enum: ['restart', 'stop', 'expose', 'reach', 'status'],
          description: 'The action to perform',
        },
        params: {
          type: 'object',
          description: 'Action-specific parameters',
          properties: {
            target: { type: 'string', description: 'For expose/reach: target host:port or service name' },
            name: { type: 'string', description: 'For expose: service name' },
            protocol: { type: 'string', enum: ['auto', 'tcp', 'udp', 'http', 'https'] },
            isPublic: { type: 'boolean' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Command sent',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        commandId: { type: 'string' },
        message: { type: 'string' },
        agentOnline: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Agent not found' })
  @ApiResponse({ status: 400, description: 'Agent offline' })
  async sendCommand(
    @Param('id') id: string,
    @Body() body: { action: string; params?: Record<string, unknown> },
    @Req() req: any,
  ) {
    // Validate action
    const validActions = ['restart', 'stop', 'expose', 'reach', 'status'];
    if (!body.action || !validActions.includes(body.action)) {
      throw new HttpException(
        `Invalid action. Must be one of: ${validActions.join(', ')}`,
        HttpStatus.BAD_REQUEST,
      );
    }

    // Verify agent belongs to workspace
    const agent = await this.agentsService.findById(id);
    if (!agent || agent.workspaceId !== req.workspace.id) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    // Check if agent is online
    if (!agent.isOnline) {
      return {
        success: false,
        message: 'Agent is offline. Command queued for delivery when agent reconnects.',
        agentOnline: false,
      };
    }

    // Send command as a message to the agent (fromAgentId must be a valid Agent id; use target agent for system commands)
    const message = await this.agentsService.sendMessage(
      id,
      id,
      req.workspace.id,
      {
        type: 'command',
        action: body.action,
        params: body.params || {},
        timestamp: new Date().toISOString(),
      },
      {
        channel: 'system',
        type: 'request',
        ttlSeconds: 300, // 5 minute TTL for commands
      },
    );

    return {
      success: true,
      commandId: message.id,
      message: `Command '${body.action}' sent to agent`,
      agentOnline: true,
    };
  }
}
