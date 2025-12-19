import { Injectable } from '@nestjs/common';
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
    // Find the API key and return its workspace
    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: {
        workspace: {
      include: {
        agents: true,
        services: true,
          },
        },
      },
    });

    if (!key || key.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    });

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

  // Note: ensureDefaultWorkspace is deprecated - workspaces are now created during user registration
  async ensureDefaultWorkspace() {
    const existing = await this.prisma.workspace.findFirst();
    if (existing) return existing;
    
    // This should not be called in the new auth flow
    throw new Error('Cannot create workspace without an owner. Use auth/register instead.');
  }
}

