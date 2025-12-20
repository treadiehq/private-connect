import { Injectable, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { createHash, randomBytes } from 'crypto';
import { RealtimeGateway } from '../realtime/realtime.gateway';

@Injectable()
export class AgentsService {
  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => RealtimeGateway))
    private realtimeGateway: RealtimeGateway,
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
    
    const agent = await this.prisma.agent.upsert({
      where: { id: agentId },
      update: { 
        lastSeenAt: now,
        connectedAt: now, // Track when agent connected for uptime
        name: name || undefined,
        label: label || undefined,
        isOnline: true,
      },
      create: {
        id: agentId,
        workspaceId,
        tokenHash,
        name,
        label: label || 'default',
        lastSeenAt: now,
        connectedAt: now,
        isOnline: true,
      },
      include: { workspace: true },
    });

    // Broadcast agent online status
    this.realtimeGateway.broadcastAgentStatus(agentId, true);

    return agent;
  }

  async validateToken(agentId: string, token: string): Promise<boolean> {
    const tokenHash = this.hashToken(token);
    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
    });
    
    if (!agent) return false;
    return agent.tokenHash === tokenHash;
  }

  async validateWorkspaceApiKey(apiKey: string) {
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { workspace: true },
    });

    if (!key || key.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

    return key.workspace;
  }

  async heartbeat(agentId: string) {
    return this.prisma.agent.update({
      where: { id: agentId },
      data: { 
        lastSeenAt: new Date(),
        isOnline: true,
      },
    });
  }

  async setOnlineStatus(agentId: string, isOnline: boolean) {
    const agent = await this.prisma.agent.update({
      where: { id: agentId },
      data: { 
        isOnline,
        // Clear connectedAt when going offline
        connectedAt: isOnline ? undefined : null,
      },
    });
    
    this.realtimeGateway.broadcastAgentStatus(agentId, isOnline);
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
      },
    });
  }
}
