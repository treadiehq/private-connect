import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import * as crypto from 'crypto';
import * as path from 'path';

interface CreateShareOptions {
  serviceId: string;
  name: string;
  description?: string;
  expiresAt?: Date;
  allowedPaths?: string[];
  allowedMethods?: string[];
  rateLimitPerMin?: number;
  createdBy?: string;
}

@Injectable()
export class SharesService {
  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
  ) {}

  /**
   * Generate a secure share token
   * Uses 8 bytes (64 bits) with base64url encoding for short, URL-safe tokens
   * Lowercase because DNS subdomains are case-insensitive
   * Result: ~11 character tokens like "a1b2c3d4e5f"
   */
  private generateToken(): string {
    return crypto.randomBytes(8).toString('base64url').toLowerCase();
  }

  /**
   * Create a new service share
   */
  async createShare(options: CreateShareOptions) {
    const token = this.generateToken();

    const share = await this.prisma.serviceShare.create({
      data: {
        serviceId: options.serviceId,
        token,
        name: options.name,
        description: options.description,
        expiresAt: options.expiresAt,
        allowedPaths: options.allowedPaths ? JSON.stringify(options.allowedPaths) : null,
        allowedMethods: options.allowedMethods ? JSON.stringify(options.allowedMethods) : null,
        rateLimitPerMin: options.rateLimitPerMin,
        createdBy: options.createdBy,
      },
      include: {
        service: {
          select: {
            id: true,
            name: true,
            targetHost: true,
            targetPort: true,
            tunnelPort: true,
            protocol: true,
            workspaceId: true,
          },
        },
      },
    });

    // Emit webhook for share creation
    if (share.service?.workspaceId) {
      this.webhooksService.emit(share.service.workspaceId, 'share.created', {
        shareId: share.id,
        shareName: share.name,
        serviceId: share.serviceId,
        serviceName: share.service.name,
        expiresAt: share.expiresAt?.toISOString(),
        createdBy: share.createdBy,
        createdAt: share.createdAt.toISOString(),
      }).catch(() => {}); // Fire and forget
    }

    return share;
  }

  /**
   * Get a share by token (for validation)
   */
  async getShareByToken(token: string) {
    return this.prisma.serviceShare.findUnique({
      where: { token },
      include: {
        service: {
          include: {
            agent: true,
            workspace: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });
  }

  /**
   * Get a share by ID with service relation (for authorization checks)
   */
  async getShareById(shareId: string) {
    return this.prisma.serviceShare.findUnique({
      where: { id: shareId },
      include: {
        service: {
          select: {
            id: true,
            workspaceId: true,
          },
        },
      },
    });
  }

  /**
   * Validate if a share is active and valid
   */
  async validateShare(
    token: string,
    reqPath?: string,
    method?: string
  ) {
    const share = await this.getShareByToken(token);

    if (!share) {
      return { valid: false, reason: 'Share not found' };
    }

    if (share.revokedAt) {
      return { valid: false, reason: 'Share has been revoked' };
    }

    if (share.expiresAt && share.expiresAt < new Date()) {
      return { valid: false, reason: 'Share has expired' };
    }

    // Check allowed paths — normalize to prevent traversal via encoded segments
    if (share.allowedPaths && reqPath) {
      const allowedPaths = JSON.parse(share.allowedPaths) as string[];

      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(reqPath);
      } catch {
        return { valid: false, reason: 'Invalid path encoding' };
      }
      const normalizedPath = path.posix.normalize(decodedPath);

      if (normalizedPath.startsWith('..') || normalizedPath.includes('/../')) {
        return { valid: false, reason: 'Path not allowed' };
      }

      const isPathAllowed = allowedPaths.some((allowed) => {
        if (normalizedPath === allowed) return true;
        if (normalizedPath.startsWith(allowed + '/')) return true;
        if (allowed.endsWith('/') && normalizedPath.startsWith(allowed)) return true;
        return false;
      });
      if (!isPathAllowed) {
        return { valid: false, reason: 'Path not allowed' };
      }
    }

    // Check allowed methods
    if (share.allowedMethods && method) {
      const allowedMethods = JSON.parse(share.allowedMethods) as string[];
      if (!allowedMethods.includes(method.toUpperCase())) {
        return { valid: false, reason: 'Method not allowed' };
      }
    }

    return { valid: true, share };
  }

  /**
   * Log an access attempt
   */
  async logAccess(
    shareId: string,
    data: {
      ipAddress?: string;
      userAgent?: string;
      path?: string;
      method?: string;
      statusCode?: number;
      latencyMs?: number;
    }
  ) {
    await this.prisma.$transaction(async (tx) => {
      await tx.shareAccessLog.create({
        data: {
          shareId,
          ...data,
        },
      });
      await tx.serviceShare.update({
        where: { id: shareId },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        },
      });
    });

    // Emit webhook for share access (get workspace from share)
    const share = await this.prisma.serviceShare.findUnique({
      where: { id: shareId },
      include: {
        service: { select: { workspaceId: true, name: true } },
      },
    });

    if (share?.service?.workspaceId) {
      this.webhooksService.emit(share.service.workspaceId, 'share.accessed', {
        shareId,
        shareName: share.name,
        serviceName: share.service.name,
        ipAddress: data.ipAddress,
        path: data.path,
        method: data.method,
        statusCode: data.statusCode,
        accessedAt: new Date().toISOString(),
      }).catch(() => {}); // Fire and forget
    }
  }

  /**
   * Get all shares for a service
   */
  async getSharesForService(serviceId: string) {
    return this.prisma.serviceShare.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { accessLogs: true },
        },
      },
    });
  }

  /**
   * Revoke a share
   */
  async revokeShare(shareId: string) {
    const share = await this.prisma.serviceShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
      include: {
        service: { select: { workspaceId: true, name: true } },
      },
    });

    // Emit webhook for share revocation
    if (share.service?.workspaceId) {
      this.webhooksService.emit(share.service.workspaceId, 'share.revoked', {
        shareId,
        shareName: share.name,
        serviceName: share.service.name,
        revokedAt: share.revokedAt?.toISOString(),
      }).catch(() => {}); // Fire and forget
    }

    return share;
  }

  /**
   * Delete a share
   */
  async deleteShare(shareId: string) {
    return this.prisma.serviceShare.delete({
      where: { id: shareId },
    });
  }

  /**
   * Get access logs for a share
   */
  async getAccessLogs(shareId: string, limit: number = 100) {
    return this.prisma.shareAccessLog.findMany({
      where: { shareId },
      orderBy: { accessedAt: 'desc' },
      take: limit,
    });
  }
}

