import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { HttpException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;
  let prismaService: any;
  let workspaceService: any;

  const mockPrismaService = {
    service: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    agent: {
      findUnique: jest.fn(),
    },
    diagnosticResult: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockTunnelService = {};

  const mockWorkspaceService = {
    getUsage: jest.fn(),
    getPlanLimits: jest.fn(),
  };

  const mockWebhooksService = {
    emit: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TunnelService, useValue: mockTunnelService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
        { provide: WebhooksService, useValue: mockWebhooksService },
      ],
    }).compile();

    service = module.get<ServicesService>(ServicesService);
    prismaService = module.get(PrismaService);
    workspaceService = module.get(WorkspaceService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    beforeEach(() => {
      prismaService.agent.findUnique.mockResolvedValue({
        workspaceId: 'workspace-1',
      });
    });

    it('should prevent duplicate service names within workspace', async () => {
      prismaService.service.findUnique.mockResolvedValue(null);
      workspaceService.getUsage.mockResolvedValue({
        canAddService: false,
        workspace: { plan: 'FREE' },
      });

      await expect(
        service.register('workspace-1', 'agent-1', 'test-service', 'localhost', 8080, 'auto')
      ).rejects.toThrow(HttpException);
    });

    it('should allow updating existing service even at limit', async () => {
      prismaService.service.findUnique.mockResolvedValue({
        id: 'existing-service',
        name: 'test-service',
        tunnelPort: 23000,
      });
      prismaService.service.upsert.mockResolvedValue({
        id: 'existing-service',
        name: 'test-service',
        targetHost: 'localhost',
        targetPort: 8080,
        tunnelPort: 23000,
        protocol: 'auto',
        agentId: 'agent-1',
        createdAt: new Date(),
        agent: { label: 'default' },
      });

      const result = await service.register(
        'workspace-1', 'agent-1', 'test-service', 'localhost', 8080, 'auto'
      );
      
      expect(result).toBeDefined();
      expect(prismaService.service.upsert).toHaveBeenCalled();
    });

    it('should register new service when under limit', async () => {
      prismaService.service.findUnique.mockResolvedValue(null);
      workspaceService.getUsage.mockResolvedValue({
        canAddService: true,
        workspace: { plan: 'FREE' },
      });
      prismaService.service.upsert.mockResolvedValue({
        id: 'new-service',
        name: 'test-service',
        targetHost: 'localhost',
        targetPort: 8080,
        tunnelPort: 23001,
        protocol: 'auto',
        agentId: 'agent-1',
        createdAt: new Date(),
        agent: { label: 'default' },
      });

      const result = await service.register(
        'workspace-1', 'agent-1', 'test-service', 'localhost', 8080, 'auto'
      );

      expect(result.id).toBe('new-service');
      expect(result.tunnelPort).toBe(23001);
    });
  });

  describe('saveDiagnostic', () => {
    it('should persist diagnostic with source agent info', async () => {
      const createdAt = new Date('2026-04-16T12:00:00.000Z');
      prismaService.diagnosticResult.create.mockResolvedValue({
        id: 'diag-1',
        serviceId: 'service-1',
        sourceAgentId: 'agent-1',
        sourceLabel: 'aws-prod',
        perspective: 'agent',
        dnsStatus: 'OK',
        tcpStatus: 'OK',
        message: 'OK',
        shareToken: 'abc123',
        createdAt,
      });
      prismaService.service.update.mockResolvedValue({});

      const result = await service.saveDiagnostic(
        'service-1',
        { dnsStatus: 'OK', tcpStatus: 'OK', message: 'OK' },
        'agent-1',
        'aws-prod'
      );

      expect(result.sourceAgentId).toBe('agent-1');
      expect(result.sourceLabel).toBe('aws-prod');
      expect(result.perspective).toBe('agent');
      expect(result.shareToken).toBeDefined();
      expect(prismaService.service.update).toHaveBeenCalledWith({
        where: { id: 'service-1' },
        data: { status: 'OK', lastCheckedAt: createdAt },
      });
    });

    it('should persist diagnostic from hub perspective when no source agent', async () => {
      const createdAt = new Date('2026-04-16T12:00:00.000Z');
      prismaService.diagnosticResult.create.mockResolvedValue({
        id: 'diag-2',
        serviceId: 'service-1',
        sourceAgentId: null,
        sourceLabel: null,
        perspective: 'hub',
        dnsStatus: 'OK',
        tcpStatus: 'OK',
        message: 'OK',
        createdAt,
      });
      prismaService.service.update.mockResolvedValue({});

      const result = await service.saveDiagnostic(
        'service-1',
        { dnsStatus: 'OK', tcpStatus: 'OK', message: 'OK' }
      );

      expect(result.sourceAgentId).toBeNull();
      expect(result.perspective).toBe('hub');
      expect(prismaService.service.update).toHaveBeenCalledWith({
        where: { id: 'service-1' },
        data: { status: 'OK', lastCheckedAt: createdAt },
      });
    });
  });

  describe('getDiagnosticHistory', () => {
    it('should respect plan limits for history', async () => {
      workspaceService.getUsage.mockResolvedValue({
        workspace: { plan: 'FREE' },
      });
      workspaceService.getPlanLimits.mockReturnValue({
        diagnosticHistoryLimit: 20,
      });
      prismaService.diagnosticResult.findMany.mockResolvedValue([]);

      await service.getDiagnosticHistory('service-1', 100, 'workspace-1');

      // Should cap at plan limit (20) even though 100 was requested
      expect(prismaService.diagnosticResult.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 20 })
      );
    });
  });
});

