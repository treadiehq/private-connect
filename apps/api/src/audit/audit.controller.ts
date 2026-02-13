import { Controller, Get, Param, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiSecurity, ApiQuery } from '@nestjs/swagger';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { AuditService } from './audit.service';

@ApiTags('Audit')
@Controller('v1/audit')
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get audit log',
    description: 'Returns aggregated audit events from all sources (agent activity, share access, sessions, diagnostics).',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of events (default: 100)' })
  @ApiQuery({ name: 'agentId', required: false, description: 'Filter by agent ID' })
  @ApiQuery({ name: 'serviceId', required: false, description: 'Filter by service/tunnel ID' })
  @ApiQuery({ name: 'type', required: false, enum: ['agent', 'share', 'session', 'diagnostic'], description: 'Filter by event type' })
  @ApiQuery({ name: 'since', required: false, description: 'Only events after this ISO timestamp' })
  @ApiResponse({
    status: 200,
    description: 'List of audit events',
    schema: {
      type: 'object',
      properties: {
        events: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              type: { type: 'string', enum: ['agent', 'share', 'session', 'diagnostic'] },
              event: { type: 'string' },
              timestamp: { type: 'string', format: 'date-time' },
              agentId: { type: 'string' },
              agentLabel: { type: 'string' },
              serviceId: { type: 'string' },
              serviceName: { type: 'string' },
              ipAddress: { type: 'string' },
              details: { type: 'object' },
            },
          },
        },
      },
    },
  })
  async getAuditLog(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('agentId') agentId?: string,
    @Query('serviceId') serviceId?: string,
    @Query('type') type?: 'agent' | 'share' | 'session' | 'diagnostic',
    @Query('since') since?: string,
  ) {
    const workspace = req.workspace;
    const events = await this.auditService.getAuditLog(workspace.id, {
      limit: limit ? parseInt(limit, 10) : undefined,
      agentId,
      serviceId,
      type,
      since: since ? new Date(since) : undefined,
    });

    return { events };
  }

  @Get('stats')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get audit statistics',
    description: 'Returns aggregated statistics for the last 30 days.',
  })
  @ApiResponse({
    status: 200,
    description: 'Audit statistics',
    schema: {
      type: 'object',
      properties: {
        totalEvents: { type: 'number' },
        eventsByType: {
          type: 'object',
          properties: {
            agent: { type: 'number' },
            share: { type: 'number' },
            session: { type: 'number' },
            diagnostic: { type: 'number' },
          },
        },
        eventsByDay: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              date: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        topAgents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              agentId: { type: 'string' },
              label: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
        topServices: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              serviceId: { type: 'string' },
              name: { type: 'string' },
              count: { type: 'number' },
            },
          },
        },
      },
    },
  })
  async getStats(@Req() req: any) {
    const workspace = req.workspace;
    return this.auditService.getStats(workspace.id);
  }

  @Get('agents/:id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get agent audit log',
    description: 'Returns audit events for a specific agent.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of events (default: 50)' })
  @ApiResponse({ status: 200, description: 'Agent audit events' })
  async getAgentAudit(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const events = await this.auditService.getAgentAudit(
      workspace.id,
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { events };
  }

  @Get('tunnels/:id')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({
    summary: 'Get tunnel audit log',
    description: 'Returns audit events for a specific tunnel/service.',
  })
  @ApiQuery({ name: 'limit', required: false, description: 'Max number of events (default: 50)' })
  @ApiResponse({ status: 200, description: 'Tunnel audit events' })
  async getTunnelAudit(
    @Param('id') id: string,
    @Query('limit') limit: string,
    @Req() req: any,
  ) {
    const workspace = req.workspace;
    const events = await this.auditService.getServiceAudit(
      workspace.id,
      id,
      limit ? parseInt(limit, 10) : undefined,
    );
    return { events };
  }
}
