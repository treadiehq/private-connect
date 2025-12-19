import { Test, TestingModule } from '@nestjs/testing';
import { WorkspaceService } from './workspace.service';
import { PrismaService } from '../prisma/prisma.service';

describe('WorkspaceService', () => {
  let service: WorkspaceService;
  let prismaService: any;

  const mockPrismaService = {
    workspace: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkspaceService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<WorkspaceService>(WorkspaceService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPlanLimits', () => {
    it('should return FREE plan limits', () => {
      const limits = service.getPlanLimits('FREE');
      
      expect(limits.maxServices).toBe(3);
      expect(limits.diagnosticHistoryLimit).toBe(20);
      expect(limits.diagnosticHistoryDays).toBe(1);
    });

    it('should return PRO plan limits', () => {
      const limits = service.getPlanLimits('PRO');
      
      expect(limits.maxServices).toBe(1000);
      expect(limits.diagnosticHistoryLimit).toBe(1000);
      expect(limits.diagnosticHistoryDays).toBe(365);
    });

    it('should default to FREE for unknown plans', () => {
      const limits = service.getPlanLimits('UNKNOWN');
      
      expect(limits.maxServices).toBe(3);
    });
  });

  describe('getUsage', () => {
    it('should calculate canAddService correctly', async () => {
      prismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Test Workspace',
        plan: 'FREE',
        services: [{ id: '1' }, { id: '2' }], // 2 services
        agents: [{ id: 'a1' }],
      });

      const usage = await service.getUsage('workspace-1');

      expect(usage?.canAddService).toBe(true); // 2 < 3 (FREE limit)
      expect(usage?.usage.services).toBe(2);
      expect(usage?.limits.maxServices).toBe(3);
    });

    it('should return false for canAddService when at limit', async () => {
      prismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Test Workspace',
        plan: 'FREE',
        services: [{ id: '1' }, { id: '2' }, { id: '3' }], // 3 services (at limit)
        agents: [],
      });

      const usage = await service.getUsage('workspace-1');

      expect(usage?.canAddService).toBe(false);
    });

    it('should allow more services for PRO plan', async () => {
      prismaService.workspace.findUnique.mockResolvedValue({
        id: 'workspace-1',
        name: 'Test Workspace',
        plan: 'PRO',
        services: Array(100).fill({ id: 'x' }), // 100 services
        agents: [],
      });

      const usage = await service.getUsage('workspace-1');

      expect(usage?.canAddService).toBe(true); // 100 < 1000 (PRO limit)
    });
  });

  describe('upgradeToPro', () => {
    it('should update workspace plan to PRO', async () => {
      prismaService.workspace.update.mockResolvedValue({
        id: 'workspace-1',
        plan: 'PRO',
      });

      const result = await service.upgradeToPro('workspace-1');

      expect(result.plan).toBe('PRO');
      expect(prismaService.workspace.update).toHaveBeenCalledWith({
        where: { id: 'workspace-1' },
        data: { plan: 'PRO' },
      });
    });
  });
});

