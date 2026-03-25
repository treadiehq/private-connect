import { Controller, Post, Get, Delete, Body, Param, Query, UseGuards, Req, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiSecurity } from '@nestjs/swagger';
import { GrantsService } from './grants.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { z } from 'zod';

const GRANT_ENDPOINT_BASE = process.env.GRANT_ENDPOINT_BASE || 'agent.privateconnect.co';

function parseTtl(ttl: string): number {
  const match = ttl.match(/^(\d+)(s|m|h|d)$/);
  if (!match) throw new Error(`Invalid TTL format: "${ttl}". Use: 60s, 5m, 1h, 1d`);

  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    case 'd': return value * 86400;
    default: throw new Error(`Invalid TTL unit: ${unit}`);
  }
}

const CreateGrantSchema = z.object({
  agentLabel: z.string().min(1).max(100),
  resourceType: z.enum(['db', 'api', 'path']),
  resourceName: z.string().min(1).max(200),
  scope: z.enum(['read-only', 'full']).optional(),
  ttl: z.string().min(1).max(10).optional(),
});

@ApiTags('Grants')
@Controller('v1/grants')
export class GrantsController {
  constructor(private grantsService: GrantsService) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Create grant',
    description: 'Create a scoped access grant for an AI agent. Omit ttl for a persistent grant that never expires.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentLabel', 'resourceType', 'resourceName'],
      properties: {
        agentLabel: { type: 'string', example: 'claude' },
        resourceType: { type: 'string', enum: ['db', 'api', 'path'], example: 'db' },
        resourceName: { type: 'string', example: 'postgres' },
        scope: { type: 'string', enum: ['read-only', 'full'], default: 'read-only' },
        ttl: { type: 'string', example: '5m', description: 'Duration: 60s, 5m, 1h, 1d. Omit for persistent.' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Grant created' })
  @ApiResponse({ status: 400, description: 'Invalid request' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createGrant(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateGrantSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { agentLabel, resourceType, resourceName, scope, ttl } = parsed.data;

    let ttlSeconds: number | undefined;
    if (ttl) {
      try {
        ttlSeconds = parseTtl(ttl);
      } catch (err: any) {
        throw new HttpException(err.message, HttpStatus.BAD_REQUEST);
      }
    }

    const grant = await this.grantsService.createGrant({
      workspaceId: req.workspace.id,
      agentLabel,
      resourceType,
      resourceName,
      scope,
      ttlSeconds,
    });

    const endpoint = `${grant.resourceName}.${GRANT_ENDPOINT_BASE}`;
    const persistent = grant.expiresAt === null;
    const expiresInMinutes = persistent
      ? null
      : Math.round((grant.expiresAt!.getTime() - Date.now()) / 60000);

    return {
      success: true,
      grant: {
        id: grant.id,
        agentLabel: grant.agentLabel,
        resourceType: grant.resourceType,
        resourceName: grant.resourceName,
        scope: grant.scope,
        persistent,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        expiresInMinutes,
        token: grant.rawToken,
        tokenPrefix: grant.tokenPrefix,
        endpoint,
      },
    };
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'List grants', description: 'List active grants for the workspace.' })
  @ApiResponse({ status: 200, description: 'List of grants' })
  async listGrants(
    @Req() req: any,
    @Query('includeExpired') includeExpired?: string,
    @Query('serviceId') serviceId?: string,
  ) {
    const grants = serviceId
      ? await this.grantsService.listGrantsForService(serviceId, req.workspace.id, includeExpired === 'true')
      : await this.grantsService.listGrants(req.workspace.id, includeExpired === 'true');

    return {
      success: true,
      grants: grants.map((g: any) => ({
        id: g.id,
        agentLabel: g.agentLabel,
        resourceType: g.resourceType,
        resourceName: g.resourceName,
        scope: g.scope,
        tokenPrefix: g.tokenPrefix,
        persistent: g.expiresAt === null,
        expiresAt: g.expiresAt?.toISOString() ?? null,
        expired: g.expiresAt ? g.expiresAt < new Date() : false,
        endpoint: `${g.resourceName}.${GRANT_ENDPOINT_BASE}`,
        service: g.service ? { id: g.service.id, name: g.service.name } : null,
        accessLogCount: g._count?.accessLogs ?? 0,
        createdAt: g.createdAt.toISOString(),
      })),
    };
  }

  @Delete(':id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Revoke grant', description: 'Revoke an active grant.' })
  @ApiResponse({ status: 200, description: 'Grant revoked' })
  @ApiResponse({ status: 404, description: 'Grant not found' })
  async revokeGrant(@Param('id') id: string, @Req() req: any) {
    await this.grantsService.revokeGrant(id, req.workspace.id);
    return { success: true, message: 'Grant revoked' };
  }

  @Post('validate')
  @ApiOperation({
    summary: 'Validate grant token',
    description: 'Validate a grant token and return grant details. Used by proxies to check access.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['token'],
      properties: {
        token: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Grant valid' })
  @ApiResponse({ status: 403, description: 'Grant invalid or expired' })
  async validateToken(@Body() body: { token: string }) {
    if (!body.token) {
      throw new HttpException('Token is required', HttpStatus.BAD_REQUEST);
    }

    const grant = await this.grantsService.validateGrantToken(body.token);
    if (!grant) {
      throw new HttpException('Grant invalid, expired, or revoked', HttpStatus.FORBIDDEN);
    }

    return {
      valid: true,
      grant: {
        id: grant.id,
        agentLabel: grant.agentLabel,
        resourceType: grant.resourceType,
        resourceName: grant.resourceName,
        scope: grant.scope,
        persistent: grant.expiresAt === null,
        expiresAt: grant.expiresAt?.toISOString() ?? null,
        service: grant.service ? { id: grant.service.id, name: grant.service.name } : null,
      },
    };
  }

  @Get(':id/logs')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Get access logs', description: 'Get access logs for a specific grant.' })
  @ApiResponse({ status: 200, description: 'Access logs' })
  async getAccessLogs(
    @Param('id') id: string,
    @Req() req: any,
    @Query('limit') limit?: string,
  ) {
    const logs = await this.grantsService.getAccessLogs(id, req.workspace.id, limit ? parseInt(limit, 10) : 50);

    return {
      success: true,
      logs: logs.map(l => ({
        id: l.id,
        requestType: l.requestType,
        requestSummary: l.requestSummary,
        responseStatus: l.responseStatus,
        allowed: l.allowed,
        ipAddress: l.ipAddress,
        latencyMs: l.latencyMs,
        createdAt: l.createdAt.toISOString(),
      })),
    };
  }
}
