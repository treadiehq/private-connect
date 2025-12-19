import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionsService {
  constructor(private prisma: PrismaService) {}

  async createSession(serviceId: string, sourceAgentId: string) {
    return this.prisma.session.create({
      data: {
        serviceId,
        sourceAgentId,
      },
    });
  }

  async endSession(sessionId: string, outcome: 'success' | 'failure' | 'timeout') {
    return this.prisma.session.update({
      where: { id: sessionId },
      data: {
        endedAt: new Date(),
        outcome,
      },
    });
  }

  async getSessionsByService(serviceId: string, limit: number = 50) {
    return this.prisma.session.findMany({
      where: { serviceId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        sourceAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });
  }

  async getSessionsByAgent(agentId: string, limit: number = 50) {
    return this.prisma.session.findMany({
      where: { sourceAgentId: agentId },
      orderBy: { startedAt: 'desc' },
      take: limit,
      include: {
        service: {
          select: { id: true, name: true },
        },
      },
    });
  }
}

