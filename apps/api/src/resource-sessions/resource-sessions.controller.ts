import { Controller, Post, Patch, Get, Body, Param, Query, Req, UseGuards, HttpException, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { z } from 'zod';
import { ResourceSessionsService } from './resource-sessions.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { AgentsService } from '../agents/agents.service';

const RESOURCE_TYPES = ['postgres', 'mysql', 'redis', 'http', 'generic-tcp'] as const;
const SESSION_STATUSES = ['active', 'closed', 'expired'] as const;

const CreateSessionSchema = z.object({
  agentId: z.string().uuid(),
  resourceName: z.string().min(1).max(100),
  resourceType: z.enum(RESOURCE_TYPES),
  endpoint: z.string().min(1),
  protocol: z.enum(['tcp', 'http']),
  localPort: z.number().int().min(1).max(65535),
  targetHost: z.string().min(1),
  targetPort: z.number().int().min(1).max(65535),
  expiresAt: z.string().datetime(),
});

const CloseSessionSchema = z.object({
  status: z.enum(['closed', 'expired']).optional().default('closed'),
});

const ListQuerySchema = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
});

@ApiTags('Resource Sessions')
@Controller('v1/resource-sessions')
export class ResourceSessionsController {
  constructor(
    private resourceSessionsService: ResourceSessionsService,
    private agentsService: AgentsService,
  ) {}

  @Post()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Register a resource session' })
  async create(@Body() body: unknown, @Req() req: any) {
    const parsed = CreateSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException('Invalid request body', HttpStatus.BAD_REQUEST);
    }

    const { agentId, expiresAt, ...rest } = parsed.data;

    const agent = await this.agentsService.findById(agentId);
    if (!agent || agent.workspaceId !== req.workspaceId) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    const session = await this.resourceSessionsService.create({
      workspaceId: req.workspaceId,
      agentId,
      expiresAt: new Date(expiresAt),
      ...rest,
    });

    return { ok: true, session: { id: session.id } };
  }

  @Patch(':id/close')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Close a resource session' })
  async close(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = CloseSessionSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException('Invalid request body', HttpStatus.BAD_REQUEST);
    }
    const result = await this.resourceSessionsService.close(id, req.workspaceId, parsed.data.status);

    if (result.count === 0) {
      throw new HttpException('Session not found or already closed', HttpStatus.NOT_FOUND);
    }

    return { ok: true };
  }

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @SkipThrottle()
  @ApiOperation({ summary: 'List resource sessions' })
  async list(@Query('status') status: string | undefined, @Req() req: any) {
    const parsed = ListQuerySchema.safeParse({ status });
    if (!parsed.success) {
      throw new HttpException('Invalid status filter', HttpStatus.BAD_REQUEST);
    }
    await this.resourceSessionsService.expireStale();
    const sessions = await this.resourceSessionsService.listByWorkspace(req.workspaceId, parsed.data.status);
    return { ok: true, sessions };
  }
}
