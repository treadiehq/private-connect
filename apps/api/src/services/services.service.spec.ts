import { Test, TestingModule } from '@nestjs/testing';
import { ServicesService } from './services.service';
import { PrismaService } from '../prisma/prisma.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { HttpException } from '@nestjs/common';

describe('ServicesService', () => {
  let service: ServicesService;
  let prismaService: any;
  let workspaceService: any;

  const mockPrismaService = {
    service: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
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

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServicesService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TunnelService, useValue: mockTunnelService },
        { provide: WorkspaceService, useValue: mockWorkspaceService },
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
    it('should prevent duplicate service names within workspace', async () => {
      // Setup: workspace at limit, no existing service with this name
      workspaceService.getUsage.mockResolvedValue({
        canAddService: false,
        workspace: { plan: 'FREE' },
      });
      prismaService.service.findUnique.mockResolvedValue(null);

      // Should throw when at limit and not updating existing
      await expect(
        service.register('workspace-1', 'agent-1', 'test-service', 'localhost', 8080, 'auto')
      ).rejects.toThrow(HttpException);
    });

    it('should allow updating existing service even at limit', async () => {
      // Setup: workspace at limit, but service already exists
      workspaceService.getUsage.mockResolvedValue({
        canAddService: false,
        workspace: { plan: 'FREE' },
      });
      prismaService.service.findUnique.mockResolvedValue({
        id: 'existing-service',
        name: 'test-service',
      });
      prismaService.service.upsert.mockResolvedValue({
        id: 'existing-service',
        name: 'test-service',
        tunnelPort: 23000,
      });

      // Should succeed - updating existing service
      const result = await service.register(
        'workspace-1', 'agent-1', 'test-service', 'localhost', 8080, 'auto'
      );
      
      expect(result).toBeDefined();
      expect(prismaService.service.upsert).toHaveBeenCalled();
    });

    it('should register new service when under limit', async () => {
      workspaceService.getUsage.mockResolvedValue({
        canAddService: true,
        workspace: { plan: 'FREE' },
      });
      prismaService.service.upsert.mockResolvedValue({
        id: 'new-service',
        name: 'test-service',
        tunnelPort: 23001,
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
    });

    it('should persist diagnostic from hub perspective when no source agent', async () => {
      prismaService.diagnosticResult.create.mockResolvedValue({
        id: 'diag-2',
        serviceId: 'service-1',
        sourceAgentId: null,
        sourceLabel: null,
        perspective: 'hub',
        dnsStatus: 'OK',
        tcpStatus: 'OK',
        message: 'OK',
      });
      prismaService.service.update.mockResolvedValue({});

      const result = await service.saveDiagnostic(
        'service-1',
        { dnsStatus: 'OK', tcpStatus: 'OK', message: 'OK' }
      );

      expect(result.sourceAgentId).toBeNull();
      expect(result.perspective).toBe('hub');
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

