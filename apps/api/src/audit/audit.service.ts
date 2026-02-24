import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEvent {
  id: string;
  type: 'agent' | 'share' | 'session' | 'diagnostic';
  event: string;
  timestamp: Date;
  agentId?: string;
  agentLabel?: string;
  clientType?: string;
  serviceId?: string;
  serviceName?: string;
  tunnelId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, unknown>;
}

export interface AuditStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  eventsByDay: { date: string; count: number }[];
  topAgents: { agentId: string; label: string; count: number }[];
  topServices: { serviceId: string; name: string; count: number }[];
}

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get aggregated audit events
   */
  async getAuditLog(
    workspaceId: string,
    options?: {
      limit?: number;
      agentId?: string;
      serviceId?: string;
      type?: 'agent' | 'share' | 'session' | 'diagnostic';
      since?: Date;
    },
  ): Promise<AuditEvent[]> {
    const limit = options?.limit || 100;
    const events: AuditEvent[] = [];

    // Fetch from multiple sources in parallel
    const [agentLogs, shareAccessLogs, sessions, diagnostics] = await Promise.all([
      // Agent token audit logs
      (!options?.type || options.type === 'agent') ? this.prisma.agentTokenAuditLog.findMany({
        where: {
          agent: { workspaceId },
          ...(options?.agentId && { agentId: options.agentId }),
          ...(options?.since && { createdAt: { gte: options.since } }),
        },
        include: {
          agent: { select: { id: true, label: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }) : [],

      // Share access logs
      (!options?.type || options.type === 'share') ? this.prisma.shareAccessLog.findMany({
        where: {
          share: { service: { workspaceId } },
          ...(options?.serviceId && { share: { serviceId: options.serviceId } }),
          ...(options?.since && { accessedAt: { gte: options.since } }),
        },
        include: {
          share: {
            include: {
              service: { select: { id: true, name: true } },
            },
          },
        },
        orderBy: { accessedAt: 'desc' },
        take: limit,
      }) : [],

      // Sessions (reach checks)
      (!options?.type || options.type === 'session') ? this.prisma.session.findMany({
        where: {
          service: { workspaceId },
          ...(options?.agentId && { sourceAgentId: options.agentId }),
          ...(options?.serviceId && { serviceId: options.serviceId }),
          ...(options?.since && { startedAt: { gte: options.since } }),
        },
        include: {
          service: { select: { id: true, name: true } },
          sourceAgent: { select: { id: true, label: true, name: true } },
        },
        orderBy: { startedAt: 'desc' },
        take: limit,
      }) : [],

      // Diagnostics
      (!options?.type || options.type === 'diagnostic') ? this.prisma.diagnosticResult.findMany({
        where: {
          service: { workspaceId },
          ...(options?.agentId && { sourceAgentId: options.agentId }),
          ...(options?.serviceId && { serviceId: options.serviceId }),
          ...(options?.since && { createdAt: { gte: options.since } }),
        },
        include: {
          service: { select: { id: true, name: true } },
          sourceAgent: { select: { id: true, label: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      }) : [],
    ]);

    // Transform agent logs
    for (const log of agentLogs) {
      events.push({
        id: log.id,
        type: 'agent',
        event: log.event,
        timestamp: log.createdAt,
        agentId: log.agentId,
        agentLabel: log.agent.label,
        clientType: log.clientType || undefined,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        details: log.details ? JSON.parse(log.details) : undefined,
      });
    }

    // Transform share access logs
    for (const log of shareAccessLogs) {
      events.push({
        id: log.id,
        type: 'share',
        event: 'ACCESSED',
        timestamp: log.accessedAt,
        serviceId: log.share.serviceId,
        serviceName: log.share.service.name,
        ipAddress: log.ipAddress || undefined,
        userAgent: log.userAgent || undefined,
        details: {
          path: log.path,
          method: log.method,
          statusCode: log.statusCode,
          latencyMs: log.latencyMs,
          shareName: log.share.service.name,
        },
      });
    }

    // Transform sessions
    for (const session of sessions) {
      events.push({
        id: session.id,
        type: 'session',
        event: session.outcome ? `REACH_${session.outcome.toUpperCase()}` : 'REACH_STARTED',
        timestamp: session.startedAt,
        agentId: session.sourceAgentId,
        agentLabel: session.sourceAgent.label,
        serviceId: session.serviceId,
        serviceName: session.service.name,
        details: {
          outcome: session.outcome,
          endedAt: session.endedAt,
        },
      });
    }

    // Transform diagnostics
    for (const diag of diagnostics) {
      events.push({
        id: diag.id,
        type: 'diagnostic',
        event: `CHECK_${diag.tcpStatus}`,
        timestamp: diag.createdAt,
        agentId: diag.sourceAgentId || undefined,
        agentLabel: diag.sourceAgent?.label,
        serviceId: diag.serviceId,
        serviceName: diag.service.name,
        details: {
          dnsStatus: diag.dnsStatus,
          tcpStatus: diag.tcpStatus,
          tlsStatus: diag.tlsStatus,
          httpStatus: diag.httpStatus,
          latencyMs: diag.latencyMs,
          perspective: diag.perspective,
        },
      });
    }

    // Sort by timestamp and limit
    events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return events.slice(0, limit);
  }

  /**
   * Get audit statistics
   */
  async getStats(workspaceId: string): Promise<AuditStats> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [agentLogCount, shareAccessCount, sessionCount, diagnosticCount] = await Promise.all([
      this.prisma.agentTokenAuditLog.count({
        where: { agent: { workspaceId }, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.shareAccessLog.count({
        where: { share: { service: { workspaceId } }, accessedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.session.count({
        where: { service: { workspaceId }, startedAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.diagnosticResult.count({
        where: { service: { workspaceId }, createdAt: { gte: thirtyDaysAgo } },
      }),
    ]);

    // Get top agents by activity
    const topAgents = await this.prisma.agentTokenAuditLog.groupBy({
      by: ['agentId'],
      where: { agent: { workspaceId }, createdAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { agentId: 'desc' } },
      take: 5,
    });

    const topAgentsWithLabels = await Promise.all(
      topAgents.map(async (ta) => {
        const agent = await this.prisma.agent.findUnique({
          where: { id: ta.agentId },
          select: { label: true },
        });
        return {
          agentId: ta.agentId,
          label: agent?.label || 'unknown',
          count: ta._count,
        };
      }),
    );

    // Get top services by access
    const topServices = await this.prisma.shareAccessLog.groupBy({
      by: ['shareId'],
      where: { share: { service: { workspaceId } }, accessedAt: { gte: thirtyDaysAgo } },
      _count: true,
      orderBy: { _count: { shareId: 'desc' } },
      take: 5,
    });

    const topServicesWithNames = await Promise.all(
      topServices.map(async (ts) => {
        const share = await this.prisma.serviceShare.findUnique({
          where: { id: ts.shareId },
          include: { service: { select: { id: true, name: true } } },
        });
        return {
          serviceId: share?.service.id || 'unknown',
          name: share?.service.name || 'unknown',
          count: ts._count,
        };
      }),
    );

    // Events by day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const eventsByDay: { date: string; count: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const startOfDay = new Date(dateStr);
      const endOfDay = new Date(dateStr);
      endOfDay.setDate(endOfDay.getDate() + 1);

      const count = await this.prisma.agentTokenAuditLog.count({
        where: {
          agent: { workspaceId },
          createdAt: { gte: startOfDay, lt: endOfDay },
        },
      });

      eventsByDay.push({ date: dateStr, count });
    }

    return {
      totalEvents: agentLogCount + shareAccessCount + sessionCount + diagnosticCount,
      eventsByType: {
        agent: agentLogCount,
        share: shareAccessCount,
        session: sessionCount,
        diagnostic: diagnosticCount,
      },
      eventsByDay: eventsByDay.reverse(),
      topAgents: topAgentsWithLabels,
      topServices: topServicesWithNames,
    };
  }

  /**
   * Get audit events for a specific agent
   */
  async getAgentAudit(workspaceId: string, agentId: string, limit = 50): Promise<AuditEvent[]> {
    return this.getAuditLog(workspaceId, { agentId, limit });
  }

  /**
   * Get audit events for a specific service/tunnel
   */
  async getServiceAudit(workspaceId: string, serviceId: string, limit = 50): Promise<AuditEvent[]> {
    return this.getAuditLog(workspaceId, { serviceId, limit });
  }
}
