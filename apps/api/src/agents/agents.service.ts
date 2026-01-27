import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WebhooksService } from '../webhooks/webhooks.service';
import { 
  calculateTokenExpiry, 
  isTokenExpired, 
  isTokenExpiringSoon,
  SecureLogger,
  maskIpAddress,
} from '../common/security';
import { isIpAllowed } from '../auth/api-key.guard';

// Audit event types for agent token usage
export enum AgentAuditEvent {
  CONNECTED = 'CONNECTED',
  ROTATED = 'ROTATED',
  EXPIRED = 'EXPIRED',
  IP_CHANGED = 'IP_CHANGED',
  REJECTED = 'REJECTED',
}

export interface TokenValidationResult {
  valid: boolean;
  expired?: boolean;
  expiringSoon?: boolean;
  ipChanged?: boolean;
  newToken?: string;
  expiresAt?: Date;
}

@Injectable()
export class AgentsService {
  private readonly logger = new SecureLogger('AgentsService');

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtimeGateway: RealtimeGateway,
    private webhooksService: WebhooksService,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  async register(workspaceId: string, agentId: string, token: string, label?: string, name?: string) {
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const tokenExpiresAt = calculateTokenExpiry();
    
    // Check if this is a new agent (for webhook event)
    const existingAgent = await this.prisma.agent.findUnique({ where: { id: agentId } });
    const isNewAgent = !existingAgent;
    
    const agent = await this.prisma.agent.upsert({
      where: { id: agentId },
      update: { 
        lastSeenAt: now,
        connectedAt: now,
        name: name || undefined,
        label: label || undefined,
        isOnline: true,
      },
      create: {
        id: agentId,
        workspaceId,
        tokenHash,
        tokenExpiresAt,
        name,
        label: label || 'default',
        lastSeenAt: now,
        connectedAt: now,
        isOnline: true,
      },
      include: { workspace: true },
    });

    // Broadcast agent online status to workspace-specific room
    this.realtimeGateway.broadcastAgentStatus(agentId, true, workspaceId);

    // Emit webhook for new agent registration
    if (isNewAgent) {
      this.webhooksService.emit(workspaceId, 'agent.registered', {
        agentId,
        label: agent.label,
        name: agent.name,
        registeredAt: now.toISOString(),
      }).catch(err => this.logger.error(`Webhook emit failed: ${err.message}`));
    }

    return agent;
  }

  /**
   * Validate token with enhanced security checks
   * Returns detailed validation result including expiry status and IP change detection
   */
  async validateTokenWithAudit(
    agentId: string, 
    token: string, 
    clientIp?: string,
    userAgent?: string,
  ): Promise<TokenValidationResult> {
    const tokenHash = this.hashToken(token);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    
    if (!agent) {
      return { valid: false };
    }

    // Check token hash
    if (agent.tokenHash !== tokenHash) {
      await this.logAuditEvent(agentId, AgentAuditEvent.REJECTED, clientIp, userAgent, {
        reason: 'invalid_token_hash',
      });
      return { valid: false };
    }

    // Check if token is expired (with grace period for rotation)
    const expired = isTokenExpired(agent.tokenExpiresAt, false);
    const expiredWithGrace = isTokenExpired(agent.tokenExpiresAt, true);
    const expiringSoon = isTokenExpiringSoon(agent.tokenExpiresAt);

    if (expiredWithGrace) {
      await this.logAuditEvent(agentId, AgentAuditEvent.EXPIRED, clientIp, userAgent, {
        expiredAt: agent.tokenExpiresAt?.toISOString(),
      });
      this.logger.warn(`Agent ${agentId} token expired beyond grace period`);
      return { valid: false, expired: true };
    }

    // Check for IP change (potential security concern)
    const ipChanged = agent.lastSeenIp && clientIp && agent.lastSeenIp !== clientIp;
    
    if (ipChanged) {
      await this.logAuditEvent(agentId, AgentAuditEvent.IP_CHANGED, clientIp, userAgent, {
        previousIp: maskIpAddress(agent.lastSeenIp ?? undefined),
        newIp: maskIpAddress(clientIp),
      });
      this.logger.warn(
        `Agent ${agentId} connected from new IP: ${maskIpAddress(clientIp)} (was ${maskIpAddress(agent.lastSeenIp ?? undefined)})`
      );
    }

    // Update last seen IP
    await this.prisma.agent.update({
      where: { id: agentId },
      data: { lastSeenIp: clientIp },
    });

    // Log successful connection
    await this.logAuditEvent(agentId, AgentAuditEvent.CONNECTED, clientIp, userAgent, {
      expiringSoon,
      expired,
    });

    return {
      valid: true,
      expired,
      expiringSoon,
      ipChanged: !!ipChanged,
      expiresAt: agent.tokenExpiresAt ?? undefined,
    };
  }

  /**
   * Simple token validation (backwards compatible)
   */
  async validateToken(agentId: string, token: string): Promise<boolean> {
    const result = await this.validateTokenWithAudit(agentId, token);
    return result.valid;
  }

  /**
   * Rotate agent token and return new credentials
   */
  async rotateToken(agentId: string, currentToken: string): Promise<{ 
    success: boolean; 
    newToken?: string; 
    expiresAt?: Date;
    error?: string;
  }> {
    // First validate the current token
    const tokenHash = this.hashToken(currentToken);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });

    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }

    if (agent.tokenHash !== tokenHash) {
      return { success: false, error: 'Invalid current token' };
    }

    // Generate new token
    const newToken = this.generateToken();
    const newTokenHash = this.hashToken(newToken);
    const newExpiresAt = calculateTokenExpiry();

    await this.prisma.agent.update({
      where: { id: agentId },
      data: {
        tokenHash: newTokenHash,
        tokenExpiresAt: newExpiresAt,
      },
    });

    // Log rotation event
    await this.logAuditEvent(agentId, AgentAuditEvent.ROTATED, undefined, undefined, {
      newExpiresAt: newExpiresAt.toISOString(),
    });

    this.logger.log(`Token rotated for agent ${agentId}, expires ${newExpiresAt.toISOString()}`);

    return {
      success: true,
      newToken,
      expiresAt: newExpiresAt,
    };
  }

  /**
   * Log an audit event for agent token usage
   */
  private async logAuditEvent(
    agentId: string,
    event: AgentAuditEvent,
    ipAddress?: string,
    userAgent?: string,
    details?: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.prisma.agentTokenAuditLog.create({
        data: {
          agentId,
          event,
          ipAddress,
          userAgent,
          previousIp: event === AgentAuditEvent.IP_CHANGED ? (details?.previousIp as string) : undefined,
          details: details ? JSON.stringify(details) : undefined,
        },
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      this.logger.error(`Failed to log audit event: ${error}`);
    }
  }

  async validateWorkspaceApiKey(apiKey: string, clientIp?: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { workspace: true },
    });

    if (!key || key.revokedAt) {
      return null;
    }

    // Check IP restrictions if configured
    if (clientIp && key.allowedIpRanges && key.allowedIpRanges.length > 0) {
      if (!isIpAllowed(clientIp, key.allowedIpRanges)) {
        this.logger.warn(`API key ${key.keyPrefix}... rejected: IP ${clientIp} not in allowed ranges`);
        return null;
      }
    }

    // Update last used timestamp and IP
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { 
        lastUsedAt: new Date(),
        lastUsedIp: clientIp || undefined,
      },
    });

    return key.workspace;
  }

  async heartbeat(agentId: string, clientIp?: string) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { 
        lastSeenAt: new Date(),
        isOnline: true,
        lastSeenIp: clientIp || undefined,
      },
    });
  }

  async setOnlineStatus(agentId: string, isOnline: boolean) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { 
        isOnline,
        connectedAt: isOnline ? undefined : null,
      },
    });
    
    this.realtimeGateway.broadcastAgentStatus(agentId, isOnline, agent.workspaceId);

    // Emit webhook for agent connect/disconnect
    const eventType = isOnline ? 'agent.connected' : 'agent.disconnected';
    this.webhooksService.emit(agent.workspaceId, eventType, {
      agentId,
      label: agent.label,
      name: agent.name,
      timestamp: new Date().toISOString(),
    }).catch(err => this.logger.error(`Webhook emit failed: ${err.message}`));

    return agent;
  }

  async findById(agentId: string) {
    return this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { 
        services: true,
        workspace: true,
      },
    });
  }

  async findByWorkspace(workspaceId: string) {
    return this.prisma.agent.findMany({
      where: { workspaceId },
      include: { services: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async findAll() {
    return this.prisma.agent.findMany({
      include: { services: true, workspace: true },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  async getOnlineAgents(workspaceId?: string) {
    const where = workspaceId 
      ? { isOnline: true, workspaceId }
      : { isOnline: true };
    
    return this.prisma.agent.findMany({
      where,
      select: {
        id: true,
        label: true,
        name: true,
        lastSeenAt: true,
        connectedAt: true,
        tokenExpiresAt: true,
      },
    });
  }

  /**
   * Get recent audit logs for an agent
   */
  async getAuditLogs(agentId: string, limit: number = 50) {
    return this.prisma.agentTokenAuditLog.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Get agents with expiring tokens (for alerting)
   */
  async getAgentsWithExpiringTokens(workspaceId?: string) {
    const warningDate = new Date();
    warningDate.setDate(warningDate.getDate() + 7); // 7 days warning

    const where = workspaceId 
      ? {
          workspaceId,
          tokenExpiresAt: { lte: warningDate, gt: new Date() },
        }
      : {
          tokenExpiresAt: { lte: warningDate, gt: new Date() },
        };

    return this.prisma.agent.findMany({
      where,
      select: {
        id: true,
        label: true,
        name: true,
        tokenExpiresAt: true,
        workspace: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * Validate agent by ID and API key
   * Used for authenticated agent operations
   */
  async validateAgent(agentId: string, apiKey: string, clientIp?: string) {
    // Validate the API key first (including IP restrictions)
    const workspace = await this.validateWorkspaceApiKey(apiKey, clientIp);
    if (!workspace) {
      return null;
    }

    // Find the agent and verify it belongs to the workspace
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      include: { workspace: true },
    });

    if (!agent || agent.workspaceId !== workspace.id) {
      return null;
    }

    return agent;
  }

  // ============================================
  // Agent Orchestration: Messaging & Discovery
  // ============================================

  /**
   * Send a message to another agent
   */
  async sendMessage(
    fromAgentId: string,
    toAgentId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
    options?: {
      channel?: string;
      type?: 'request' | 'response' | 'event' | 'broadcast';
      correlationId?: string;
      ttlSeconds?: number;
    }
  ) {
    const expiresAt = options?.ttlSeconds 
      ? new Date(Date.now() + options.ttlSeconds * 1000)
      : new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h default TTL

    const message = await this.prisma.agentMessage.create({
      data: {
        fromAgentId,
        toAgentId,
        workspaceId,
        channel: options?.channel || 'default',
        type: options?.type || 'event',
        payload: JSON.stringify(payload),
        correlationId: options?.correlationId,
        expiresAt,
      },
    });

    // Broadcast via realtime if target agent is online
    this.realtimeGateway.sendToAgent(toAgentId, 'agent:message', {
      id: message.id,
      from: fromAgentId,
      channel: message.channel,
      type: message.type,
      payload,
      correlationId: message.correlationId,
    });

    return message;
  }

  /**
   * Broadcast a message to all agents in workspace
   */
  async broadcastMessage(
    fromAgentId: string,
    workspaceId: string,
    payload: Record<string, unknown>,
    options?: {
      channel?: string;
      ttlSeconds?: number;
    }
  ) {
    const agents = await this.getOnlineAgents(workspaceId);
    
    const messages = await Promise.all(
      agents
        .filter(a => a.id !== fromAgentId)
        .map(agent => 
          this.sendMessage(fromAgentId, agent.id, workspaceId, payload, {
            ...options,
            type: 'broadcast',
          })
        )
    );

    return { sent: messages.length };
  }

  /**
   * Get unread messages for an agent
   */
  async getMessages(
    agentId: string,
    options?: {
      channel?: string;
      unreadOnly?: boolean;
      limit?: number;
    }
  ) {
    const where: any = {
      toAgentId: agentId,
      expiresAt: { gt: new Date() },
    };

    if (options?.channel) {
      where.channel = options.channel;
    }

    if (options?.unreadOnly !== false) {
      where.readAt = null;
    }

    return this.prisma.agentMessage.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      include: {
        fromAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });
  }

  /**
   * Mark messages as read
   */
  async markMessagesRead(agentId: string, messageIds: string[]) {
    return this.prisma.agentMessage.updateMany({
      where: {
        id: { in: messageIds },
        toAgentId: agentId,
      },
      data: { readAt: new Date() },
    });
  }

  /**
   * Register agent capabilities for discovery
   */
  async registerCapabilities(
    agentId: string,
    capabilities: Array<{ name: string; metadata?: Record<string, unknown> }>
  ) {
    // Upsert each capability
    const results = await Promise.all(
      capabilities.map(cap =>
        this.prisma.agentCapability.upsert({
          where: {
            agentId_name: { agentId, name: cap.name },
          },
          update: {
            metadata: cap.metadata ? JSON.stringify(cap.metadata) : null,
          },
          create: {
            agentId,
            name: cap.name,
            metadata: cap.metadata ? JSON.stringify(cap.metadata) : null,
          },
        })
      )
    );

    return results;
  }

  /**
   * Find agents with specific capabilities
   */
  async findAgentsByCapability(workspaceId: string, capability: string) {
    return this.prisma.agent.findMany({
      where: {
        workspaceId,
        isOnline: true,
        capabilities: {
          some: { name: capability },
        },
      },
      include: {
        capabilities: true,
        services: {
          select: { name: true, targetPort: true, status: true },
        },
      },
    });
  }

  /**
   * Get detailed agent info for orchestration
   */
  async getAgentDetails(agentId: string) {
    return this.prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        capabilities: true,
        services: {
          select: {
            id: true,
            name: true,
            targetHost: true,
            targetPort: true,
            protocol: true,
            status: true,
          },
        },
      },
    });
  }

  /**
   * Get all agents in workspace with their capabilities and services
   */
  async getAgentsForOrchestration(workspaceId: string) {
    return this.prisma.agent.findMany({
      where: { workspaceId },
      include: {
        capabilities: true,
        services: {
          select: {
            id: true,
            name: true,
            targetHost: true,
            targetPort: true,
            protocol: true,
            status: true,
          },
        },
      },
      orderBy: [
        { isOnline: 'desc' },
        { lastSeenAt: 'desc' },
      ],
    });
  }

  /**
   * Cleanup expired messages
   */
  async cleanupExpiredMessages() {
    return this.prisma.agentMessage.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}
