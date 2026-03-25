import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ResourceSessionsService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    workspaceId: string;
    agentId: string;
    resourceName: string;
    resourceType: string;
    endpoint: string;
    protocol: string;
    localPort: number;
    targetHost: string;
    targetPort: number;
    expiresAt: Date;
  }) {
    return this.prisma.resourceSession.create({ data });
  }

  async close(id: string, workspaceId: string, status: 'closed' | 'expired' = 'closed') {
    return this.prisma.resourceSession.updateMany({
      where: { id, workspaceId, status: 'active' },
      data: { status, closedAt: new Date() },
    });
  }

  async listByWorkspace(workspaceId: string, status?: string, limit = 50) {
    return this.prisma.resourceSession.findMany({
      where: {
        workspaceId,
        ...(status && { status }),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        agent: { select: { id: true, label: true, name: true } },
      },
    });
  }

  async expireStale() {
    return this.prisma.resourceSession.updateMany({
      where: {
        status: 'active',
        expiresAt: { lt: new Date() },
      },
      data: { status: 'expired', closedAt: new Date() },
    });
  }
}
