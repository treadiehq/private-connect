import { Controller, Get } from '@nestjs/common';
import { TunnelService } from '../tunnel/tunnel.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller()
export class StatusController {
  private readonly startTime = Date.now();

  constructor(
    private tunnelService: TunnelService,
    private prisma: PrismaService,
  ) {}

  /**
   * Public health check - no auth required
   */
  @Get('health')
  async health() {
    let dbStatus = 'unknown';
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

  /**
   * Detailed status with connection stats - no auth required
   * Useful for monitoring and CLI status command
   */
  @Get('v1/status')
  async status() {
    const stats = this.tunnelService.getStats();
    
    let dbStatus = 'unknown';
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
