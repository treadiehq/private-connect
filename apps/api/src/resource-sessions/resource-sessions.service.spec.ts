import { Test, TestingModule } from '@nestjs/testing';
import { ResourceSessionsService } from './resource-sessions.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ResourceSessionsService', () => {
  let service: ResourceSessionsService;
  let prismaService: any;

  const mockPrismaService = {
    resourceSession: {
      create: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ResourceSessionsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ResourceSessionsService>(ResourceSessionsService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a resource session with all required fields', async () => {
      const input = {
        workspaceId: 'ws-1',
        agentId: 'agent-1',
        resourceName: 'staging-db',
        resourceType: 'postgres',
        endpoint: 'postgres://127.0.0.1:5432',
        protocol: 'tcp',
        localPort: 5432,
        targetHost: 'internal-db',
        targetPort: 5432,
        expiresAt: new Date('2026-03-25T12:00:00Z'),
      };

      const expected = { id: 'sess-1', ...input, status: 'active', createdAt: new Date() };
      prismaService.resourceSession.create.mockResolvedValue(expected);

      const result = await service.create(input);

      expect(result.id).toBe('sess-1');
      expect(prismaService.resourceSession.create).toHaveBeenCalledWith({ data: input });
    });
  });

  describe('close', () => {
    it('should close an active session with status "closed"', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 1 });

      const result = await service.close('sess-1', 'ws-1', 'closed');

      expect(result.count).toBe(1);
      expect(prismaService.resourceSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'sess-1', workspaceId: 'ws-1', status: 'active' },
        data: { status: 'closed', closedAt: expect.any(Date) },
      });
    });

    it('should close with status "expired" when specified', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 1 });

      await service.close('sess-1', 'ws-1', 'expired');

      expect(prismaService.resourceSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'sess-1', workspaceId: 'ws-1', status: 'active' },
        data: { status: 'expired', closedAt: expect.any(Date) },
      });
    });

    it('should default to "closed" when no status is provided', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 1 });

      await service.close('sess-1', 'ws-1');

      expect(prismaService.resourceSession.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'closed' }),
        }),
      );
    });

    it('should return count 0 when session does not exist or is already closed', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.close('nonexistent', 'ws-1');

      expect(result.count).toBe(0);
    });
  });

  describe('listByWorkspace', () => {
    it('should list sessions ordered by creation date', async () => {
      const sessions = [
        { id: 'sess-2', resourceName: 'redis', createdAt: new Date('2026-03-25T11:00:00Z') },
        { id: 'sess-1', resourceName: 'staging-db', createdAt: new Date('2026-03-25T10:00:00Z') },
      ];
      prismaService.resourceSession.findMany.mockResolvedValue(sessions);

      const result = await service.listByWorkspace('ws-1');

      expect(result).toHaveLength(2);
      expect(prismaService.resourceSession.findMany).toHaveBeenCalledWith({
        where: { workspaceId: 'ws-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: { agent: { select: { id: true, label: true, name: true } } },
      });
    });

    it('should filter by status when provided', async () => {
      prismaService.resourceSession.findMany.mockResolvedValue([]);

      await service.listByWorkspace('ws-1', 'active');

      expect(prismaService.resourceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { workspaceId: 'ws-1', status: 'active' },
        }),
      );
    });

    it('should respect custom limit', async () => {
      prismaService.resourceSession.findMany.mockResolvedValue([]);

      await service.listByWorkspace('ws-1', undefined, 10);

      expect(prismaService.resourceSession.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10 }),
      );
    });
  });

  describe('expireStale', () => {
    it('should expire sessions past their TTL', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 3 });

      const result = await service.expireStale();

      expect(result.count).toBe(3);
      expect(prismaService.resourceSession.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiresAt: { lt: expect.any(Date) },
        },
        data: { status: 'expired', closedAt: expect.any(Date) },
      });
    });

    it('should return count 0 when nothing to expire', async () => {
      prismaService.resourceSession.updateMany.mockResolvedValue({ count: 0 });

      const result = await service.expireStale();

      expect(result.count).toBe(0);
    });
  });
});
