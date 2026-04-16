import { Test, TestingModule } from '@nestjs/testing';
import { HealthMonitorService } from './health-monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { DiagnosticsService } from './diagnostics.service';
import { ServicesService } from './services.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

describe('HealthMonitorService', () => {
  let healthMonitor: HealthMonitorService;
  let webhooksService: { emit: jest.Mock };
  let diagnosticsService: { runDiagnostics: jest.Mock };
  let servicesService: { saveDiagnostic: jest.Mock; findById: jest.Mock };

  const checkedAt = new Date('2026-04-16T12:00:00.000Z');

  beforeEach(async () => {
    webhooksService = { emit: jest.fn().mockResolvedValue(undefined) };
    diagnosticsService = {
      runDiagnostics: jest.fn().mockResolvedValue({
        dnsStatus: 'OK',
        tcpStatus: 'OK',
        tlsStatus: 'OK',
        httpStatus: 'OK',
        message: 'OK',
      }),
    };
    servicesService = {
      saveDiagnostic: jest.fn().mockImplementation(async () => ({
        id: 'diag-1',
        serviceId: 'svc-1',
        createdAt: checkedAt,
      })),
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HealthMonitorService,
        {
          provide: PrismaService,
          useValue: {
            withoutRls: (fn: () => unknown) => fn(),
          },
        },
        { provide: DiagnosticsService, useValue: diagnosticsService },
        { provide: ServicesService, useValue: servicesService },
        { provide: WebhooksService, useValue: webhooksService },
        {
          provide: RealtimeGateway,
          useValue: {
            broadcastServiceUpdate: jest.fn(),
            broadcastDiagnosticResult: jest.fn(),
          },
        },
      ],
    }).compile();

    healthMonitor = module.get(HealthMonitorService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  const baseService = {
    id: 'svc-1',
    workspaceId: 'ws-1',
    name: 'api',
    targetHost: '127.0.0.1',
    targetPort: 3000,
    tunnelPort: 23000,
    protocol: 'http',
    status: 'OK',
  };

  it('emits webhook using persisted service.status, not a parallel local calculation', async () => {
    servicesService.findById.mockResolvedValue({
      ...baseService,
      status: 'FAIL',
      lastCheckedAt: checkedAt,
    });

    await (healthMonitor as unknown as { checkService: (s: typeof baseService) => Promise<void> }).checkService({
      ...baseService,
      status: 'OK',
    });

    expect(webhooksService.emit).toHaveBeenCalledWith(
      'ws-1',
      'service.unhealthy',
      expect.objectContaining({
        newStatus: 'FAIL',
        previousStatus: 'OK',
      }),
    );
  });

  it('does not emit transition webhook when another instance wrote a newer diagnostic', async () => {
    const newerCheck = new Date('2026-04-16T12:05:00.000Z');
    servicesService.findById.mockResolvedValue({
      ...baseService,
      status: 'FAIL',
      lastCheckedAt: newerCheck,
    });

    await (healthMonitor as unknown as { checkService: (s: typeof baseService) => Promise<void> }).checkService({
      ...baseService,
      status: 'OK',
    });

    expect(webhooksService.emit).not.toHaveBeenCalled();
  });
});
