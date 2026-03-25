import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { TunnelService } from '../tunnel/tunnel.service';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('Status')
@Controller()
export class StatusController {
  private readonly startTime = Date.now();

  constructor(
    private tunnelService: TunnelService,
    private prisma: PrismaService,
  ) {}

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ 
    summary: 'Health check', 
    description: 'Basic health check endpoint. No authentication required.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
        database: { type: 'string', enum: ['connected', 'disconnected', 'unknown'] },
      },
    },
  })
  async health() {
    let dbStatus: string;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      database: dbStatus,
    };
  }

  @Get('v1/status')
  @SkipThrottle()
  @ApiOperation({ 
    summary: 'Detailed system status', 
    description: 'Returns detailed status including connected agents, active services, and hub statistics. No authentication required.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'System status',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', example: 'ok' },
        timestamp: { type: 'string', format: 'date-time' },
        uptime: { type: 'number', description: 'Uptime in seconds' },
        database: { type: 'string', enum: ['connected', 'disconnected', 'unknown'] },
        hub: {
          type: 'object',
          properties: {
            connectedAgents: { type: 'number' },
            activeServices: { type: 'number' },
            pendingConnections: { type: 'number' },
            activeBridges: { type: 'number' },
          },
        },
        totals: {
          type: 'object',
          properties: {
            agents: { type: 'number' },
            onlineAgents: { type: 'number' },
            services: { type: 'number' },
          },
        },
      },
    },
  })
  async status() {
    const stats = this.tunnelService.getStats();
    
    let dbStatus: string;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      dbStatus = 'connected';
    } catch {
      dbStatus = 'disconnected';
    }

    // Get counts from database
    const [agentCount, serviceCount, onlineAgents] = await Promise.all([
      this.prisma.agent.count(),
      this.prisma.service.count(),
      this.prisma.agent.count({ where: { isOnline: true } }),
    ]);

    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      database: dbStatus,
      hub: {
        connectedAgents: stats.connectedAgents,
        activeServices: stats.activeServices,
        pendingConnections: stats.pendingConnections,
        activeBridges: stats.activeBridges,
      },
      totals: {
        agents: agentCount,
        onlineAgents,
        services: serviceCount,
      },
    };
  }
}
