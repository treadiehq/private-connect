import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

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
  constructor(private prisma: PrismaService) {}

  /**
   * Generate a secure share token
   */
  private generateToken(): string {
    return `share_${crypto.randomBytes(24).toString('hex')}`;
  }

  /**
   * Create a new service share
   */
  async createShare(options: CreateShareOptions) {
    const token = this.generateToken();

    return this.prisma.serviceShare.create({
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
          },
        },
      },
    });
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
    path?: string,
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

    // Check allowed paths
    if (share.allowedPaths && path) {
      const allowedPaths = JSON.parse(share.allowedPaths) as string[];
      const isPathAllowed = allowedPaths.some((allowed) => path.startsWith(allowed));
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
    await this.prisma.$transaction([
      this.prisma.shareAccessLog.create({
        data: {
          shareId,
          ...data,
        },
      }),
      this.prisma.serviceShare.update({
        where: { id: shareId },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 },
        },
      }),
    ]);
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
    return this.prisma.serviceShare.update({
      where: { id: shareId },
      data: { revokedAt: new Date() },
    });
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

