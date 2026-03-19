import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiSecurity,
  ApiBody,
  ApiParam,
  ApiHeader,
} from '@nestjs/swagger';
import { EnvSharesService } from './env-shares.service';
import { ServicesService } from '../services/services.service';
import { AgentsService } from '../agents/agents.service';
import { z } from 'zod';
import { SecureLogger } from '../common/security';

/**
 * Extract client IP from request, checking multiple sources
 */
function getClientIp(req: Request): string {
  return (
    req.ip ||
    (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
    req.connection?.remoteAddress ||
    'unknown'
  );
}

const CreateEnvShareSchema = z.object({
  name: z.string().max(100).optional(),
  expiresInHours: z.number().min(1).max(168).optional(), // max 7 days
  requireDeviceApproval: z.boolean().optional(), // if true, host must approve each device before join
  routes: z.array(z.object({
    serviceName: z.string(),
    serviceId: z.string().optional(),
    targetHost: z.string(),
    targetPort: z.number(),
    localPort: z.number().optional(),
    protocol: z.string().default('auto'),
  })).optional(),
});

const JoinEnvShareSchema = z.object({
  agentLabel: z.string().optional(),
});

@ApiTags('Environment Shares')
@Controller('v1/env-shares')
export class EnvSharesController {
  private readonly logger = new SecureLogger('EnvSharesController');

  constructor(
    private envSharesService: EnvSharesService,
    private servicesService: ServicesService,
    private agentsService: AgentsService,
  ) {}

  /**
   * Create a new environment share
   * POST /v1/env-shares
   */
  @Post()
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Agent making the request.' })
  @ApiOperation({
    summary: 'Create environment share',
    description: "Creates a share for the agent's workspace routes (or uses a provided route list).",
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', maxLength: 100 },
        expiresInHours: { type: 'number', minimum: 1, maximum: 168 },
        requireDeviceApproval: { type: 'boolean' },
        routes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serviceName: { type: 'string' },
              serviceId: { type: 'string' },
              targetHost: { type: 'string' },
              targetPort: { type: 'number' },
              localPort: { type: 'number' },
              protocol: { type: 'string', default: 'auto' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Share created.' })
  @ApiResponse({ status: 400, description: 'Invalid body or no services to share.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  async createShare(
    @Req() req: Request,
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const parsed = CreateEnvShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Validate agent (including IP restrictions)
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Get routes - either from request or snapshot current services
    let routes = parsed.data.routes;
    
    if (!routes || routes.length === 0) {
      // Snapshot current services for this workspace
      const services = await this.servicesService.findAll(agent.workspaceId);
      routes = services
        .filter((s: { status: string; tunnelPort: number | null }) => s.status === 'ONLINE' || s.tunnelPort)
        .map((s: { id: string; name: string; targetHost: string; targetPort: number; tunnelPort: number | null; protocol: string }) => ({
          serviceName: s.name,
          serviceId: s.id,
          targetHost: s.targetHost,
          targetPort: s.targetPort,
          localPort: s.tunnelPort || s.targetPort,
          protocol: s.protocol,
        }));
    }

    if (!routes || routes.length === 0) {
      throw new HttpException(
        'No services to share. Expose some services first.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const share = await this.envSharesService.createShare({
      agentId: agent.id,
      workspaceId: agent.workspaceId,
      routes,
      name: parsed.data.name,
      expiresInHours: parsed.data.expiresInHours,
      requireDeviceApproval: parsed.data.requireDeviceApproval,
    });

    this.logger.log(`Environment share created: ${share.code} by agent ${agent.label}`);

    return {
      success: true,
      share: {
        code: share.code,
        name: share.name,
        expiresAt: share.expiresAt,
        requireDeviceApproval: share.requireDeviceApproval,
        routes: share.routes.map((r) => ({
          serviceName: r.serviceName,
          targetHost: r.targetHost,
          targetPort: r.targetPort,
          localPort: r.localPort,
          protocol: r.protocol,
        })),
      },
    };
  }

  /**
   * Join a shared environment
   * POST /v1/env-shares/:code/join
   */
  @Post(':code/join')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Agent joining the share.' })
  @ApiOperation({
    summary: 'Join shared environment',
    description: 'Joins an active share in the same workspace; may enter pending approval if required.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        agentLabel: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Joined successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  @ApiResponse({ status: 403, description: 'Host approval required before joining.' })
  @ApiResponse({ status: 404, description: 'Share not found or not in this workspace.' })
  async joinShare(
    @Req() req: Request,
    @Param('code') code: string,
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const parsed = JoinEnvShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Validate agent (including IP restrictions)
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Validate share
    const validation = await this.envSharesService.validateShare(code);
    if (!validation.valid || !validation.share) {
      throw new HttpException(
        validation.reason || 'Invalid share',
        HttpStatus.NOT_FOUND,
      );
    }

    const share = validation.share;

    // Validate workspace isolation - agents can only join shares from their own workspace
    if (agent.workspaceId !== share.workspaceId) {
      throw new HttpException(
        'Share not found',  // Use generic message to avoid leaking share existence
        HttpStatus.NOT_FOUND,
      );
    }

    // Device allowlisting: if share requires approval, check allowlist
    if (share.requireDeviceApproval) {
      const allowed = await this.envSharesService.isAgentAllowed(share.id, agent.id);
      if (!allowed) {
        await this.envSharesService.addPendingJoin(
          share.id,
          agent.id,
          parsed.data.agentLabel || agent.label,
        );
        throw new HttpException(
          {
            code: 'PENDING_APPROVAL',
            message: 'This share requires host approval. The host has been notified; try again after they approve your device.',
          },
          HttpStatus.FORBIDDEN,
        );
      }
    }

    // Record the join
    await this.envSharesService.recordJoin(
      share.id,
      agent.id,
      parsed.data.agentLabel || agent.label,
    );

    this.logger.log(`Agent ${agent.label} joined environment share: ${code}`);

    return {
      success: true,
      share: {
        code: share.code,
        name: share.name,
        expiresAt: share.expiresAt,
        routes: share.routes.map((r) => ({
          serviceName: r.serviceName,
          serviceId: r.serviceId,
          targetHost: r.targetHost,
          targetPort: r.targetPort,
          localPort: r.localPort,
          protocol: r.protocol,
        })),
      },
    };
  }

  /**
   * Get share details (for preview before joining)
   * GET /v1/env-shares/:code
   */
  @Get(':code')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiOperation({
    summary: 'Get share details',
    description: 'Returns non-sensitive share metadata for preview (no authentication).',
  })
  @ApiResponse({ status: 200, description: 'Share details.' })
  @ApiResponse({ status: 404, description: 'Share not found or expired.' })
  async getShare(@Param('code') code: string) {
    const validation = await this.envSharesService.validateShare(code);
    if (!validation.valid || !validation.share) {
      throw new HttpException(
        validation.reason || 'Share not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const share = validation.share;

    return {
      code: share.code,
      name: share.name,
      expiresAt: share.expiresAt,
      requireDeviceApproval: share.requireDeviceApproval,
      routeCount: share.routes.length,
      joinCount: share.joins.length,
      pendingCount: (share as { _count?: { pendingJoins: number } })._count?.pendingJoins ?? 0,
      routes: share.routes.map((r) => ({
        serviceName: r.serviceName,
        protocol: r.protocol,
      })),
    };
  }

  /**
   * List active shares created by the agent
   * GET /v1/env-shares
   */
  @Get()
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Agent whose shares are listed.' })
  @ApiOperation({
    summary: 'List active shares',
    description: 'Lists non-revoked shares created by the authenticated agent.',
  })
  @ApiResponse({ status: 200, description: 'List of shares.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  async listShares(
    @Req() req: Request,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    // Validate agent (including IP restrictions)
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const shares = await this.envSharesService.getActiveSharesByAgent(agent.id);

    return {
      shares: shares.map((s) => ({
        code: s.code,
        name: s.name,
        expiresAt: s.expiresAt,
        requireDeviceApproval: s.requireDeviceApproval,
        routeCount: s.routes.length,
        joinCount: s._count.joins,
        pendingCount: s._count.pendingJoins,
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * List pending join requests (host only)
   * GET /v1/env-shares/:code/pending
   */
  @Get(':code/pending')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Share creator (host) agent.' })
  @ApiOperation({
    summary: 'List pending join requests',
    description: 'Returns pending devices for this share (creator only).',
  })
  @ApiResponse({ status: 200, description: 'Pending join requests.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  @ApiResponse({ status: 403, description: 'Caller is not the share creator.' })
  @ApiResponse({ status: 404, description: 'Share not found.' })
  async listPending(
    @Req() req: Request,
    @Param('code') code: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const validation = await this.envSharesService.validateShare(code);
    if (!validation.valid || !validation.share) {
      throw new HttpException(validation.reason || 'Share not found', HttpStatus.NOT_FOUND);
    }
    const share = validation.share;
    if (share.createdById !== agent.id) {
      throw new HttpException('Only the share creator can list pending joins', HttpStatus.FORBIDDEN);
    }

    const pending = await this.envSharesService.getPendingJoins(share.id);
    return {
      pending: pending.map((p) => ({
        agentId: p.agentId,
        agentLabel: p.agentLabel,
        requestedAt: p.requestedAt,
      })),
    };
  }

  /**
   * Approve a device to join (host only)
   * POST /v1/env-shares/:code/approve
   */
  @Post(':code/approve')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Share creator (host) agent.' })
  @ApiOperation({
    summary: 'Approve pending device',
    description: 'Allows a pending agent to join the share (creator only).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string', description: 'Agent to approve.' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device approved.' })
  @ApiResponse({ status: 400, description: 'Invalid body or approval failed.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  @ApiResponse({ status: 403, description: 'Caller is not the share creator.' })
  @ApiResponse({ status: 404, description: 'Share not found.' })
  async approveDevice(
    @Req() req: Request,
    @Param('code') code: string,
    @Body() body: { agentId: string },
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const validation = await this.envSharesService.validateShare(code);
    if (!validation.valid || !validation.share) {
      throw new HttpException(validation.reason || 'Share not found', HttpStatus.NOT_FOUND);
    }
    const share = validation.share;
    if (share.createdById !== agent.id) {
      throw new HttpException('Only the share creator can approve devices', HttpStatus.FORBIDDEN);
    }

    if (!body?.agentId) {
      throw new HttpException('agentId required', HttpStatus.BAD_REQUEST);
    }

    const ok = await this.envSharesService.approveDevice(share.id, body.agentId, agent.id);
    if (!ok) {
      throw new HttpException('Failed to approve', HttpStatus.BAD_REQUEST);
    }
    this.logger.log(`Share ${code}: device ${body.agentId} approved by ${agent.label}`);
    return { success: true, message: 'Device approved. They can join now.' };
  }

  /**
   * Deny a pending device (host only)
   * POST /v1/env-shares/:code/deny
   */
  @Post(':code/deny')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Share creator (host) agent.' })
  @ApiOperation({
    summary: 'Deny pending device',
    description: 'Removes a pending join request (creator only).',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['agentId'],
      properties: {
        agentId: { type: 'string', description: 'Agent to deny.' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device denied.' })
  @ApiResponse({ status: 400, description: 'Invalid body.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  @ApiResponse({ status: 403, description: 'Caller is not the share creator.' })
  @ApiResponse({ status: 404, description: 'Share not found.' })
  async denyDevice(
    @Req() req: Request,
    @Param('code') code: string,
    @Body() body: { agentId: string },
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const validation = await this.envSharesService.validateShare(code);
    if (!validation.valid || !validation.share) {
      throw new HttpException(validation.reason || 'Share not found', HttpStatus.NOT_FOUND);
    }
    const share = validation.share;
    if (share.createdById !== agent.id) {
      throw new HttpException('Only the share creator can deny devices', HttpStatus.FORBIDDEN);
    }

    if (!body?.agentId) {
      throw new HttpException('agentId required', HttpStatus.BAD_REQUEST);
    }

    await this.envSharesService.denyDevice(share.id, body.agentId);
    return { success: true, message: 'Device denied.' };
  }

  /**
   * Revoke a share
   * DELETE /v1/env-shares/:code
   */
  @Delete(':code')
  @ApiParam({ name: 'code', description: 'Share code.' })
  @ApiSecurity('api-key')
  @ApiHeader({ name: 'x-agent-id', required: true, description: 'Agent revoking the share.' })
  @ApiOperation({
    summary: 'Revoke share',
    description: 'Invalidates a share so it can no longer be used (creator only).',
  })
  @ApiResponse({ status: 200, description: 'Share revoked.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid API key / agent.' })
  @ApiResponse({ status: 403, description: 'Caller cannot revoke this share.' })
  async revokeShare(
    @Req() req: Request,
    @Param('code') code: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    // Validate agent (including IP restrictions)
    const clientIp = getClientIp(req);
    const agent = await this.agentsService.validateAgent(agentId, apiKey, clientIp);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const result = await this.envSharesService.revokeShare(code, agent.id);
    if (!result.success) {
      throw new HttpException(
        result.reason || 'Failed to revoke',
        HttpStatus.FORBIDDEN,
      );
    }

    return { success: true };
  }
}

