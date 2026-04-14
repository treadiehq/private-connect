import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticsService } from './diagnostics.service';
import { ServicesService } from './services.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { SecureLogger } from '../common/security';

const TICK_MS = 10_000;
const MAX_CONCURRENCY = parseInt(process.env.HEALTH_CHECK_MAX_CONCURRENCY || '5', 10);
const GLOBAL_ENABLED = process.env.HEALTH_CHECK_ENABLED !== 'false';
const MIN_INTERVAL_SECONDS = 30;

@Injectable()
export class HealthMonitorService implements OnModuleDestroy {
  private readonly logger = new SecureLogger(HealthMonitorService.name);
  private readonly inProgress = new Set<string>();
  private running = 0;
  private destroyed = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly diagnosticsService: DiagnosticsService,
    private readonly servicesService: ServicesService,
    private readonly webhooksService: WebhooksService,
    private readonly realtimeGateway: RealtimeGateway,
  ) {}

  onModuleDestroy() {
    this.destroyed = true;
  }

  @Interval(TICK_MS)
  async tick() {
    if (!GLOBAL_ENABLED || this.destroyed) return;

    try {
      const services = await this.findServicesDueForCheck();
      for (const service of services) {
        if (this.destroyed) break;
        if (this.running >= MAX_CONCURRENCY) break;
        if (this.inProgress.has(service.id)) continue;

        this.inProgress.add(service.id);
        this.running++;
        this.checkService(service).finally(() => {
          this.inProgress.delete(service.id);
          this.running--;
        });
      }
    } catch (err) {
      this.logger.error(`Health monitor tick failed: ${(err as Error).message}`);
    }
  }

  private async findServicesDueForCheck() {
    return this.prisma.withoutRls(() =>
      this.prisma.service.findMany({
        where: {
          healthCheckEnabled: true,
          tunnelPort: { not: null },
          isExternal: false,
          agent: { isOnline: true },
          OR: [
            { lastCheckedAt: null },
            {
              lastCheckedAt: {
                lt: new Date(Date.now() - MIN_INTERVAL_SECONDS * 1000),
              },
            },
          ],
        },
        include: {
          agent: { select: { id: true, label: true, name: true } },
        },
        orderBy: { lastCheckedAt: { sort: 'asc', nulls: 'first' } },
      }),
    ).then(services =>
      services.filter(s => {
        const interval = Math.max(s.healthCheckInterval, MIN_INTERVAL_SECONDS);
        if (!s.lastCheckedAt) return true;
        return Date.now() - s.lastCheckedAt.getTime() >= interval * 1000;
      }),
    );
  }

  private async checkService(service: {
    id: string;
    workspaceId: string;
    name: string;
    targetHost: string;
    targetPort: number;
    tunnelPort: number | null;
    protocol: string;
    status: string;
  }) {
    try {
      if (!service.tunnelPort) return;

      const previousStatus = service.status;

      const result = await this.diagnosticsService.runDiagnostics(
        service.tunnelPort,
        service.targetHost,
        service.targetPort,
        service.protocol,
      );

      const diagnostic = await this.prisma.withoutRls(() =>
        this.servicesService.saveDiagnostic(service.id, result),
      );

      const newStatus = result.tcpStatus !== 'OK' || result.tlsStatus === 'FAIL' || result.httpStatus === 'FAIL'
        ? 'FAIL'
        : 'OK';

      const updatedService = await this.prisma.withoutRls(() =>
        this.servicesService.findById(service.id),
      );
      if (updatedService) {
        this.realtimeGateway.broadcastServiceUpdate(updatedService);
        this.realtimeGateway.broadcastDiagnosticResult(diagnostic, service.workspaceId);
      }

      const transitioned = previousStatus !== newStatus && previousStatus !== 'UNKNOWN';
      if (transitioned) {
        const event = newStatus === 'FAIL' ? 'service.unhealthy' as const : 'service.healthy' as const;
        this.logger.log(`Service ${service.name} transitioned ${previousStatus} -> ${newStatus}`);

        this.webhooksService.emit(service.workspaceId, event, {
          serviceId: service.id,
          serviceName: service.name,
          previousStatus,
          newStatus,
          tcpStatus: result.tcpStatus,
          latencyMs: result.latencyMs ?? null,
          message: result.message,
          timestamp: new Date().toISOString(),
        }).catch(err => this.logger.error(`Webhook emit failed: ${(err as Error).message}`));
      }
    } catch (err) {
      this.logger.error(`Health check failed for service ${service.id}: ${(err as Error).message}`);
    }
  }
}
