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
} from '@nestjs/common';
import { EnvSharesService } from './env-shares.service';
import { ServicesService } from '../services/services.service';
import { AgentsService } from '../agents/agents.service';
import { z } from 'zod';
import { SecureLogger } from '../common/security';

const CreateEnvShareSchema = z.object({
  name: z.string().max(100).optional(),
  expiresInHours: z.number().min(1).max(168).optional(), // max 7 days
  // Routes can be provided explicitly, or we'll snapshot current services
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
  async createShare(
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const parsed = CreateEnvShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Validate agent
    const agent = await this.agentsService.validateAgent(agentId, apiKey);
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
    });

    this.logger.log(`Environment share created: ${share.code} by agent ${agent.label}`);

    return {
      success: true,
      share: {
        code: share.code,
        name: share.name,
        expiresAt: share.expiresAt,
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
  async joinShare(
    @Param('code') code: string,
    @Body() body: unknown,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const parsed = JoinEnvShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Validate agent
    const agent = await this.agentsService.validateAgent(agentId, apiKey);
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
      routeCount: share.routes.length,
      joinCount: share.joins.length,
      // Don't expose full route details until they join
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
  async listShares(
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const agent = await this.agentsService.validateAgent(agentId, apiKey);
    if (!agent) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const shares = await this.envSharesService.getActiveSharesByAgent(agent.id);

    return {
      shares: shares.map((s) => ({
        code: s.code,
        name: s.name,
        expiresAt: s.expiresAt,
        routeCount: s.routes.length,
        joinCount: s._count.joins,
        createdAt: s.createdAt,
      })),
    };
  }

  /**
   * Revoke a share
   * DELETE /v1/env-shares/:code
   */
  @Delete(':code')
  async revokeShare(
    @Param('code') code: string,
    @Headers('x-api-key') apiKey: string,
    @Headers('x-agent-id') agentId: string,
  ) {
    const agent = await this.agentsService.validateAgent(agentId, apiKey);
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

