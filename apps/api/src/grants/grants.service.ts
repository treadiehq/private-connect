import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import * as crypto from 'crypto';

const VALID_RESOURCE_TYPES = ['db', 'api', 'path'] as const;
const VALID_SCOPES = ['read-only', 'full'] as const;

export type ResourceType = typeof VALID_RESOURCE_TYPES[number];
export type GrantScope = typeof VALID_SCOPES[number];

const MAX_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const MIN_TTL_SECONDS = 60; // 1 minute

interface CreateGrantOptions {
  workspaceId: string;
  agentLabel: string;
  resourceType: ResourceType;
  resourceName: string;
  scope?: GrantScope;
  ttlSeconds: number;
}

@Injectable()
export class GrantsService {
  constructor(
    private prisma: PrismaService,
    private webhooksService: WebhooksService,
  ) {}

  private generateToken(): string {
    return `gnt_${crypto.randomBytes(24).toString('base64url')}`;
  }

  async createGrant(options: CreateGrantOptions) {
    const ttl = Math.min(Math.max(options.ttlSeconds, MIN_TTL_SECONDS), MAX_TTL_SECONDS);
    const expiresAt = new Date(Date.now() + ttl * 1000);
    const token = this.generateToken();

    // Resolve resource name to a Service in this workspace
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
        token,
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
      expiresAt: grant.expiresAt.toISOString(),
    }).catch(() => {});

    return grant;
  }

  async validateGrantToken(token: string) {
    const grant = await this.prisma.grant.findUnique({
      where: { token },
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
    });

    if (!grant) return null;
    if (grant.revokedAt) return null;
    if (grant.expiresAt < new Date()) return null;

    return grant;
  }

  async listGrants(workspaceId: string, includeExpired = false) {
    const where: any = { workspaceId, revokedAt: null };
    if (!includeExpired) {
      where.expiresAt = { gt: new Date() };
    }

    return this.prisma.grant.findMany({
      where,
      include: {
        service: {
          select: { id: true, name: true, targetHost: true, targetPort: true },
        },
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

  async cleanupExpiredGrants() {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days past expiry
    return this.prisma.grant.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });
  }
}
