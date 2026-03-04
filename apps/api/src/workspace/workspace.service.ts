import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

// Plan limits
const PLAN_LIMITS = {
  FREE: {
    maxServices: 3,
    diagnosticHistoryLimit: 20,
    diagnosticHistoryDays: 1,
  },
  PRO: {
    maxServices: 1000,
    diagnosticHistoryLimit: 1000,
    diagnosticHistoryDays: 365,
  },
};

@Injectable()
export class WorkspaceService {
  constructor(private prisma: PrismaService) {}

  async findByApiKey(apiKey: string) {
    const keyHash = createHash('sha256').update(apiKey).digest('hex');
    // Find the API key and return its workspace
    // Use withoutRls() for API key validation - we don't know the workspace yet
    const key = await this.prisma.withoutRls(() =>
      this.prisma.apiKey.findUnique({
        where: { keyHash },
        include: {
          workspace: {
            include: {
              agents: true,
              services: true,
            },
          },
        },
      })
    );

    if (!key || key.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.withoutRls(() =>
      this.prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      })
    );

    return key.workspace;
  }

  async findById(id: string) {
    return this.prisma.workspace.findUnique({
      where: { id },
      include: {
        agents: true,
        services: true,
      },
    });
  }

  async getUsage(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        services: true,
        agents: true,
      },
    });

    if (!workspace) return null;

    const limits = PLAN_LIMITS[workspace.plan as keyof typeof PLAN_LIMITS];
    
    return {
      workspace: {
        id: workspace.id,
        name: workspace.name,
        plan: workspace.plan,
      },
      usage: {
        services: workspace.services.length,
        agents: workspace.agents.length,
      },
      limits: {
        maxServices: limits.maxServices,
        diagnosticHistoryLimit: limits.diagnosticHistoryLimit,
      },
      canAddService: workspace.services.length < limits.maxServices,
    };
  }

  async upgradeToPro(workspaceId: string) {
    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: 'PRO' },
    });
  }

  getPlanLimits(plan: string) {
    return PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS] || PLAN_LIMITS.FREE;
  }
}

