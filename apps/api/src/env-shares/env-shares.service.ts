import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

interface RouteSnapshot {
  serviceName: string;
  serviceId?: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  protocol: string;
}

interface CreateEnvShareOptions {
  agentId: string;
  workspaceId: string;
  routes: RouteSnapshot[];
  name?: string;
  expiresInHours?: number; // default: 24
  requireDeviceApproval?: boolean; // if true, host must approve each device before join
}

@Injectable()
export class EnvSharesService {
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a short, memorable share code (6 chars)
   */
  private generateCode(): string {
    // Use alphanumeric chars that are easy to type and read
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'; // no i,l,o,0,1 to avoid confusion
    let code = '';
    const bytes = crypto.randomBytes(6);
    for (let i = 0; i < 6; i++) {
      code += chars[bytes[i] % chars.length];
    }
    return code;
  }

  /**
   * Create a new environment share
   */
  async createShare(options: CreateEnvShareOptions) {
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + (options.expiresInHours || 24));

    return this.prisma.environmentShare.create({
      data: {
        code,
        name: options.name,
        createdById: options.agentId,
        workspaceId: options.workspaceId,
        expiresAt,
        requireDeviceApproval: options.requireDeviceApproval ?? false,
        routes: {
          create: options.routes.map((route) => ({
            serviceName: route.serviceName,
            serviceId: route.serviceId,
            targetHost: route.targetHost,
            targetPort: route.targetPort,
            localPort: route.localPort,
            protocol: route.protocol,
          })),
        },
      },
      include: {
        routes: true,
      },
    });
  }

  /**
   * Check if an agent is allowed to join (either no approval required, or in allowlist)
   */
  async isAgentAllowed(envShareId: string, agentId: string): Promise<boolean> {
    const share = await this.prisma.environmentShare.findUnique({
      where: { id: envShareId },
      select: { requireDeviceApproval: true, allowedDevices: { where: { agentId }, take: 1 } },
    });
    if (!share) return false;
    if (!share.requireDeviceApproval) return true;
    return share.allowedDevices.length > 0;
  }

  /**
   * Add or update a pending join request (when requireDeviceApproval and not yet allowed)
   */
  async addPendingJoin(envShareId: string, agentId: string, agentLabel?: string): Promise<void> {
    await this.prisma.environmentSharePendingJoin.upsert({
      where: {
        envShareId_agentId: { envShareId, agentId },
      },
      create: { envShareId, agentId, agentLabel },
      update: { agentLabel, requestedAt: new Date() },
    });
  }

  /**
   * List pending join requests for a share (for host to approve/deny)
   */
  async getPendingJoins(envShareId: string) {
    return this.prisma.environmentSharePendingJoin.findMany({
      where: { envShareId },
      orderBy: { requestedAt: 'asc' },
    });
  }

  /**
   * Approve a device: add to allowlist and remove from pending
   */
  async approveDevice(envShareId: string, agentId: string, approvedById: string): Promise<boolean> {
    const share = await this.prisma.environmentShare.findUnique({
      where: { id: envShareId },
      select: { createdById: true },
    });
    if (!share) return false;
    await this.prisma.$transaction([
      this.prisma.environmentShareAllowedDevice.upsert({
        where: { envShareId_agentId: { envShareId, agentId } },
        create: { envShareId, agentId, approvedById },
        update: { approvedById, approvedAt: new Date() },
      }),
      this.prisma.environmentSharePendingJoin.deleteMany({
        where: { envShareId, agentId },
      }),
    ]);
    return true;
  }

  /**
   * Deny a pending device (remove from pending only)
   */
  async denyDevice(envShareId: string, agentId: string): Promise<boolean> {
    const result = await this.prisma.environmentSharePendingJoin.deleteMany({
      where: { envShareId, agentId },
    });
    return result.count > 0;
  }

  /**
   * Get a share by code
   */
  async getShareByCode(code: string) {
    return this.prisma.environmentShare.findUnique({
      where: { code },
      include: {
        routes: true,
        joins: {
          orderBy: { joinedAt: 'desc' },
          take: 10,
        },
        _count: {
          select: { pendingJoins: true },
        },
      },
    });
  }

  /**
   * Validate if a share is active
   */
  async validateShare(code: string) {
    const share = await this.getShareByCode(code);

    if (!share) {
      return { valid: false, reason: 'Share not found' };
    }

    if (share.revokedAt) {
      return { valid: false, reason: 'Share has been revoked' };
    }

    if (share.expiresAt < new Date()) {
      return { valid: false, reason: 'Share has expired' };
    }

    return { valid: true, share };
  }

  /**
   * Resolve share code to the "shell" service for browser terminal.
   * Returns the Service (with agent) if the share is valid and has a shell service; null otherwise.
   */
  async getShellServiceForShare(code: string): Promise<{ id: string; agentId: string; targetHost: string; targetPort: number; name: string } | null> {
    const normalized = code?.toLowerCase().trim();
    if (!normalized) return null;

    const validation = await this.validateShare(normalized);
    if (!validation.valid || !validation.share) return null;

    const share = validation.share;
    const shellRoute = share.routes.find((r) => r.serviceName === 'shell');
    if (!shellRoute) return null;

    let service: { id: string; agentId: string | null; targetHost: string; targetPort: number; name: string } | null = null;

    if (shellRoute.serviceId) {
      service = await this.prisma.service.findUnique({
        where: { id: shellRoute.serviceId },
        select: { id: true, agentId: true, targetHost: true, targetPort: true, name: true },
      });
    }

    if (!service && share.createdById) {
      const services = await this.prisma.service.findMany({
        where: { agentId: share.createdById, name: 'shell' },
        select: { id: true, agentId: true, targetHost: true, targetPort: true, name: true },
        take: 1,
      });
      service = services[0] ?? null;
    }

    if (!service || !service.agentId) return null;
    return {
      id: service.id,
      agentId: service.agentId,
      targetHost: service.targetHost,
      targetPort: service.targetPort,
      name: service.name,
    };
  }

  /**
   * Record when someone joins a shared environment
   */
  async recordJoin(envShareId: string, agentId: string, agentLabel?: string) {
    return this.prisma.environmentShareJoin.create({
      data: {
        envShareId,
        agentId,
        agentLabel,
      },
    });
  }

  /**
   * Get active shares created by an agent
   */
  async getActiveSharesByAgent(agentId: string) {
    const now = new Date();
    return this.prisma.environmentShare.findMany({
      where: {
        createdById: agentId,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      include: {
        routes: true,
        _count: {
          select: { joins: true, pendingJoins: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke a share
   */
  async revokeShare(code: string, agentId: string) {
    const share = await this.getShareByCode(code);
    
    if (!share) {
      return { success: false, reason: 'Share not found' };
    }
    
    if (share.createdById !== agentId) {
      return { success: false, reason: 'Not authorized to revoke this share' };
    }

    await this.prisma.environmentShare.update({
      where: { code },
      data: { revokedAt: new Date() },
    });

    return { success: true };
  }

  /**
   * Clean up expired shares (called periodically)
   */
  async cleanupExpiredShares() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const result = await this.prisma.environmentShare.deleteMany({
      where: {
        expiresAt: { lt: thirtyDaysAgo },
      },
    });

    return result.count;
  }
}

