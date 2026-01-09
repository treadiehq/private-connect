import { Controller, Post, Body, Get, Param, Query, HttpException, HttpStatus, UseGuards, Req } from '@nestjs/common';
import { AgentsService } from './agents.service';
import { ApiKeyGuard } from '../auth/api-key.guard';
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

@Controller('v1/agents')
export class AgentsController {
  constructor(private agentsService: AgentsService) {}

  @Post('register')
  @UseGuards(ApiKeyGuard)
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

  @Post('heartbeat')
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
  @UseGuards(ApiKeyGuard)
  async findAll(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.findByWorkspace(workspace.id);
  }

  @Get('online')
  @UseGuards(ApiKeyGuard)
  async getOnlineAgents(@Req() req: any) {
    const workspace = req.workspace;
    return this.agentsService.getOnlineAgents(workspace.id);
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Rotate agent token - returns new credentials
   * Agent must provide current valid token to get a new one
   */
  @Post('rotate-token')
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

  /**
   * Get agent audit logs - for security monitoring
   */
  @Get(':id/audit-logs')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Get agents with expiring tokens - for alerting/dashboard
   */
  @Get('expiring-tokens')
  @UseGuards(ApiKeyGuard)
  async getExpiringTokens(@Req() req: any) {
    const workspace = req.workspace;
    const agents = await this.agentsService.getAgentsWithExpiringTokens(workspace.id);
    return { agents };
  }

  // ============================================
  // Agent Orchestration Endpoints
  // ============================================

  /**
   * Get all agents with orchestration details (capabilities, services)
   */
  @Get('orchestration')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Find agents by capability
   */
  @Get('by-capability/:capability')
  @UseGuards(ApiKeyGuard)
  async findByCapability(
    @Param('capability') capability: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const agents = await this.agentsService.findAgentsByCapability(workspace.id, capability);
    return { agents };
  }

  /**
   * Register capabilities for an agent
   */
  @Post(':id/capabilities')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Send a message to another agent
   */
  @Post(':id/messages/send')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Broadcast a message to all agents in workspace
   */
  @Post(':id/messages/broadcast')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Get messages for an agent
   */
  @Get(':id/messages')
  @UseGuards(ApiKeyGuard)
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

  /**
   * Mark messages as read
   */
  @Post(':id/messages/read')
  @UseGuards(ApiKeyGuard)
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
}
