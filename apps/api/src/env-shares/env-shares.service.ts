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
          select: { joins: true },
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

