import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { createHash, randomBytes } from 'crypto';

const VALID_RESOURCE_TYPES = ['db', 'api', 'path'] as const;
const VALID_SCOPES = ['read-only', 'full'] as const;

export type ResourceType = typeof VALID_RESOURCE_TYPES[number];
export type GrantScope = typeof VALID_SCOPES[number];

const MAX_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MIN_TTL_SECONDS = 60; // 1 minute

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

interface CreateGrantOptions {
  workspaceId: string;
  agentLabel: string;
  resourceType: ResourceType;
  resourceName: string;
  scope?: GrantScope;
  ttlSeconds?: number; // undefined = persistent
}

@Injectable()
export class GrantsService {
  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
  ) {}

  private generateToken(): string {
    return `gnt_${randomBytes(24).toString('base64url')}`;
  }

  async createGrant(options: CreateGrantOptions) {
    let expiresAt: Date | null = null;

    if (options.ttlSeconds != null) {
      const ttl = Math.min(Math.max(options.ttlSeconds, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
      expiresAt = new Date(Date.now() + ttl * 1000);
    }

    const rawToken = this.generateToken();
    const tokenHash = hashToken(rawToken);
    const tokenPrefix = rawToken.slice(0, 12);

    const service = await this.prisma.service.findFirst({
      where: {
        workspaceId: options.workspaceId,
        name: options.resourceName,
      },
    });

    const grant = await this.prisma.grant.create({
      data: {
        workspaceId: options.workspaceId,
        agentLabel: options.agentLabel,
        resourceType: options.resourceType,
        resourceName: options.resourceName,
        serviceId: service?.id ?? null,
        scope: options.scope ?? 'read-only',
        tokenHash,
        tokenPrefix,
        expiresAt,
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
            publicSubdomain: true,
          },
        },
      },
    });

    this.webhooksService.emit(options.workspaceId, 'grant.created', {
      grantId: grant.id,
      agentLabel: grant.agentLabel,
      resourceType: grant.resourceType,
      resourceName: grant.resourceName,
      scope: grant.scope,
      persistent: expiresAt === null,
      expiresAt: grant.expiresAt?.toISOString() ?? null,
    }).catch(() => {});

    return { ...grant, rawToken };
  }

  async validateGrantToken(rawToken: string) {
    const tokenH = hashToken(rawToken);

    const grant = await this.prisma.withoutRls(() =>
      this.prisma.grant.findUnique({
        where: { tokenHash: tokenH },
        include: {
          service: {
            select: {
              id: true,
              name: true,
              targetHost: true,
              targetPort: true,
              tunnelPort: true,
              agentId: true,
              protocol: true,
              isPublic: true,
              publicSubdomain: true,
            },
          },
        },
      })
    );

    if (!grant) return null;
    if (grant.revokedAt) return null;
    if (grant.expiresAt && grant.expiresAt < new Date()) return null;

    return grant;
  }

  async listGrants(workspaceId: string, includeExpired = false) {
    const where: any = { workspaceId, revokedAt: null };
    if (!includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    return this.prisma.grant.findMany({
      where,
      include: {
        service: {
          select: { id: true, name: true, targetHost: true, targetPort: true },
        },
        _count: { select: { accessLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listGrantsForService(serviceId: string, includeExpired = false) {
    const where: any = { serviceId, revokedAt: null };
    if (!includeExpired) {
      where.OR = [
        { expiresAt: null },
        { expiresAt: { gt: new Date() } },
      ];
    }

    return this.prisma.grant.findMany({
      where,
      include: {
        _count: { select: { accessLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeGrant(grantId: string, workspaceId: string) {
    const grant = await this.prisma.grant.findFirst({
      where: { id: grantId, workspaceId },
    });

    if (!grant) {
      throw new HttpException('Grant not found', HttpStatus.NOT_FOUND);
    }

    return this.prisma.grant.update({
      where: { id: grantId },
      data: { revokedAt: new Date() },
    });
  }

  async logAccess(options: {
    grantId: string;
    requestType: 'db_query' | 'api_call';
    requestSummary?: string;
    responseStatus?: string;
    allowed: boolean;
    ipAddress?: string;
    userAgent?: string;
    latencyMs?: number;
  }) {
    return this.prisma.grantAccessLog.create({
      data: {
        grantId: options.grantId,
        requestType: options.requestType,
        requestSummary: options.requestSummary?.slice(0, 500),
        responseStatus: options.responseStatus,
        allowed: options.allowed,
        ipAddress: options.ipAddress,
        userAgent: options.userAgent,
        latencyMs: options.latencyMs,
      },
    }).catch(() => {});
  }

  async getAccessLogs(grantId: string, limit = 50) {
    return this.prisma.grantAccessLog.findMany({
      where: { grantId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getAccessLogsForService(serviceId: string, limit = 100) {
    return this.prisma.grantAccessLog.findMany({
      where: { grant: { serviceId } },
      include: {
        grant: {
          select: { id: true, agentLabel: true, tokenPrefix: true, scope: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async cleanupExpiredGrants() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    return this.prisma.grant.deleteMany({
      where: {
        expiresAt: { lt: cutoff },
      },
    });
  }
}
