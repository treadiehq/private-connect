import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';

interface CreateGroupInput {
  workspaceId: string;
  name: string;
  metadata?: Record<string, unknown>;
  services?: Array<{
    agentId: string;
    name: string;
    targetHost: string;
    targetPort: number;
    protocol?: string;
    isPublic?: boolean;
  }>;
}

interface AddServiceInput {
  agentId: string;
  name: string;
  targetHost: string;
  targetPort: number;
  protocol?: string;
  isPublic?: boolean;
}

@Injectable()
export class GroupsService {
  constructor(
    private prisma: PrismaService,
    private servicesService: ServicesService,
  ) {}

  async create(input: CreateGroupInput) {
    const { workspaceId, name, metadata, services } = input;

    const existing = await this.prisma.serviceGroup.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });
    if (existing) {
      throw new HttpException(
        `Group "${name}" already exists in this workspace`,
        HttpStatus.CONFLICT,
      );
    }

    const group = await this.prisma.serviceGroup.create({
      data: {
        workspaceId,
        name,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    const createdServices = [];
    if (services?.length) {
      for (const svc of services) {
        const fullName = `${name}.${svc.name}`;
        const service = await this.servicesService.register(
          workspaceId,
          svc.agentId,
          fullName,
          svc.targetHost,
          svc.targetPort,
          svc.protocol || 'auto',
          svc.isPublic || false,
        );

        await this.prisma.service.update({
          where: { id: service.id },
          data: { groupId: group.id },
        });

        createdServices.push(service);
      }
    }

    return { ...group, services: createdServices };
  }

  async list(workspaceId: string) {
    return this.prisma.serviceGroup.findMany({
      where: { workspaceId },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            targetHost: true,
            targetPort: true,
            protocol: true,
            status: true,
            isPublic: true,
            publicSubdomain: true,
          },
        },
        _count: { select: { services: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async get(id: string, workspaceId: string) {
    const group = await this.prisma.serviceGroup.findUnique({
      where: { id },
      include: {
        services: {
          select: {
            id: true,
            name: true,
            targetHost: true,
            targetPort: true,
            tunnelPort: true,
            protocol: true,
            status: true,
            isPublic: true,
            publicSubdomain: true,
            agentId: true,
          },
        },
      },
    });

    if (!group || group.workspaceId !== workspaceId) {
      throw new HttpException('Group not found', HttpStatus.NOT_FOUND);
    }

    return group;
  }

  async addService(groupId: string, workspaceId: string, input: AddServiceInput) {
    const group = await this.get(groupId, workspaceId);

    const fullName = `${group.name}.${input.name}`;
    const service = await this.servicesService.register(
      workspaceId,
      input.agentId,
      fullName,
      input.targetHost,
      input.targetPort,
      input.protocol || 'auto',
      input.isPublic || false,
    );

    await this.prisma.service.update({
      where: { id: service.id },
      data: { groupId },
    });

    return service;
  }

  async delete(id: string, workspaceId: string) {
    const group = await this.get(id, workspaceId);

    for (const svc of group.services) {
      if (svc.tunnelPort) {
        this.servicesService.releasePort(svc.tunnelPort);
      }
    }

    await this.prisma.serviceGroup.delete({ where: { id } });
    return { success: true, deletedServices: group.services.length };
  }
}
