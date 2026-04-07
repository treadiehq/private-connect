import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { isAdminEmail } from '../common/admin';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  /**
   * Get all users with their workspaces and usage stats
   */
  async getAllUsers() {
    const users = await this.prisma.user.findMany({
      include: {
        workspaces: {
          include: {
            _count: {
              select: {
                agents: true,
                services: true,
                apiKeys: true,
              },
            },
          },
        },
        _count: {
          select: {
            authSessions: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return users.map((user) => ({
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      isAdmin: user.isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      activeSessions: user._count.authSessions,
      workspaces: user.workspaces.map((ws) => ({
        id: ws.id,
        name: ws.name,
        plan: ws.plan,
        createdAt: ws.createdAt,
        agentCount: ws._count.agents,
        serviceCount: ws._count.services,
        apiKeyCount: ws._count.apiKeys,
      })),
    }));
  }

  /**
   * Get all workspaces with owner info and usage stats
   */
  async getAllWorkspaces() {
    const workspaces = await this.prisma.workspace.findMany({
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            isAdmin: true,
          },
        },
        _count: {
          select: {
            agents: true,
            services: true,
            apiKeys: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return workspaces.map((ws) => ({
      id: ws.id,
      name: ws.name,
      plan: ws.plan,
      createdAt: ws.createdAt,
      owner: ws.owner,
      agentCount: ws._count.agents,
      serviceCount: ws._count.services,
      apiKeyCount: ws._count.apiKeys,
    }));
  }

  /**
   * Get detailed stats for admin dashboard
   */
  async getStats() {
    const [
      userCount,
      workspaceCount,
      agentCount,
      serviceCount,
      onlineAgentCount,
      proWorkspaceCount,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.workspace.count(),
      this.prisma.agent.count(),
      this.prisma.service.count(),
      this.prisma.agent.count({ where: { isOnline: true } }),
      this.prisma.workspace.count({ where: { plan: 'PRO' } }),
    ]);

    return {
      users: userCount,
      workspaces: workspaceCount,
      agents: agentCount,
      services: serviceCount,
      onlineAgents: onlineAgentCount,
      proWorkspaces: proWorkspaceCount,
      freeWorkspaces: workspaceCount - proWorkspaceCount,
    };
  }

  /**
   * Upgrade a workspace to PRO plan
   */
  async upgradeWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.plan === 'PRO') {
      throw new BadRequestException('Workspace is already on PRO plan');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: 'PRO' },
    });
  }

  /**
   * Downgrade a workspace to FREE plan
   */
  async downgradeWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.plan === 'FREE') {
      throw new BadRequestException('Workspace is already on FREE plan');
    }

    return this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { plan: 'FREE' },
    });
  }

  /**
   * Get detailed info about a specific user
   */
  async getUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        workspaces: {
          include: {
            agents: {
              select: {
                id: true,
                name: true,
                label: true,
                isOnline: true,
                lastSeenAt: true,
                createdAt: true,
              },
            },
            services: {
              select: {
                id: true,
                name: true,
                targetHost: true,
                targetPort: true,
                status: true,
                isExternal: true,
                createdAt: true,
              },
            },
            apiKeys: {
              select: {
                id: true,
                name: true,
                keyPrefix: true,
                createdAt: true,
                lastUsedAt: true,
                revokedAt: true,
              },
            },
          },
        },
        authSessions: {
          select: {
            id: true,
            createdAt: true,
            lastUsedAt: true,
            expiresAt: true,
            userAgent: true,
            ipAddress: true,
          },
          orderBy: { lastUsedAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return user;
  }

  /**
   * Get detailed info about a specific workspace
   */
  async getWorkspace(workspaceId: string) {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        owner: {
          select: {
            id: true,
            email: true,
            emailVerified: true,
            isAdmin: true,
            createdAt: true,
          },
        },
        agents: {
          include: {
            _count: {
              select: {
                services: true,
              },
            },
          },
        },
        services: {
          include: {
            agent: {
              select: {
                id: true,
                name: true,
                label: true,
              },
            },
            _count: {
              select: {
                diagnostics: true,
                shares: true,
              },
            },
          },
        },
        apiKeys: true,
      },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    return workspace;
  }

  /**
   * Toggle admin status for a user
   */
  async toggleAdmin(userId: string, isAdmin: boolean) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { isAdmin },
    });
  }

  /**
   * Delete a user and all their data
   */
  async deleteUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (isAdminEmail(user.email)) {
      throw new BadRequestException('Cannot delete admin users');
    }

    // Cascade delete handles workspaces, agents, services, etc.
    await this.prisma.user.delete({
      where: { id: userId },
    });

    return { success: true, message: 'User deleted successfully' };
  }
}
