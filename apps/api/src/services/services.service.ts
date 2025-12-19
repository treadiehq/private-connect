import { Injectable, Inject, forwardRef, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { randomBytes } from 'crypto';

// Port allocation range for tunnels
const TUNNEL_PORT_MIN = 23000;
const TUNNEL_PORT_MAX = 23999;

@Injectable()
export class ServicesService {
  private usedPorts = new Set<number>();

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TunnelService))
    private tunnelService: TunnelService,
    @Inject(forwardRef(() => WorkspaceService))
    private workspaceService: WorkspaceService,
  ) {
    this.loadUsedPorts();
  }

  private async loadUsedPorts() {
    const services = await this.prisma.service.findMany({
      where: { tunnelPort: { not: null } },
    });
    services.forEach(s => {
      if (s.tunnelPort) this.usedPorts.add(s.tunnelPort);
    });
  }

  private allocatePort(): number {
    for (let port = TUNNEL_PORT_MIN; port <= TUNNEL_PORT_MAX; port++) {
      if (!this.usedPorts.has(port)) {
        this.usedPorts.add(port);
        return port;
      }
    }
    throw new Error('No available tunnel ports');
  }

  releasePort(port: number) {
    this.usedPorts.delete(port);
  }

  async register(
    workspaceId: string,
    agentId: string,
    name: string,
    targetHost: string,
    targetPort: number,
    protocol: string = 'auto',
  ) {
    // Check plan limits
    const usage = await this.workspaceService.getUsage(workspaceId);
    if (!usage?.canAddService) {
      // Check if this is an update (existing service)
      const existing = await this.prisma.service.findUnique({
        where: { workspaceId_name: { workspaceId, name } },
      });
      if (!existing) {
        throw new HttpException(
          `Service limit reached. Upgrade to PRO for more services.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const tunnelPort = this.allocatePort();
    
    const service = await this.prisma.service.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {
        targetHost,
        targetPort,
        tunnelPort,
        protocol,
        status: 'UNKNOWN',
        agentId,
      },
      create: {
        workspaceId,
        agentId,
        name,
        targetHost,
        targetPort,
        tunnelPort,
        protocol,
        status: 'UNKNOWN',
      },
      include: { agent: true },
    });

    return service;
  }

  async registerExternal(
    workspaceId: string,
    name: string,
    targetHost: string,
    targetPort: number,
    protocol: string = 'auto',
  ) {
    // Check plan limits
    const usage = await this.workspaceService.getUsage(workspaceId);
    if (!usage?.canAddService) {
      // Check if this is an update (existing service)
      const existing = await this.prisma.service.findUnique({
        where: { workspaceId_name: { workspaceId, name } },
      });
      if (!existing) {
        throw new HttpException(
          `Service limit reached. Upgrade to PRO for more services.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    // External services don't get a tunnel port - they're reached directly
    const service = await this.prisma.service.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {
        targetHost,
        targetPort,
        protocol,
        status: 'UNKNOWN',
        isExternal: true,
        agentId: null,
        tunnelPort: null,
      },
      create: {
        workspaceId,
        name,
        targetHost,
        targetPort,
        protocol,
        status: 'UNKNOWN',
        isExternal: true,
        // No agentId or tunnelPort for external services
      },
    });

    return service;
  }

  async findAll(workspaceId?: string) {
    const where = workspaceId ? { workspaceId } : {};
    
    return this.prisma.service.findMany({
      where,
      include: { 
        agent: true,
        diagnostics: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.service.findUnique({
      where: { id },
      include: { 
        agent: true,
        diagnostics: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            sourceAgent: {
              select: { id: true, label: true, name: true },
            },
          },
        },
      },
    });
  }

  async findByName(workspaceId: string, name: string) {
    return this.prisma.service.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
      include: { agent: true },
    });
  }

  async updateStatus(id: string, status: 'OK' | 'FAIL' | 'UNKNOWN') {
    return this.prisma.service.update({
      where: { id },
      data: { 
        status,
        lastCheckedAt: new Date(),
      },
    });
  }

  async saveDiagnostic(
    serviceId: string,
    result: {
      dnsStatus: string;
      tcpStatus: string;
      tlsStatus?: string;
      tlsDetails?: object;
      httpStatus?: string;
      httpDetails?: object;
      latencyMs?: number;
      message: string;
      raw?: string;
    },
    sourceAgentId?: string,
    sourceLabel?: string,
  ) {
    // Generate share token
    const shareToken = randomBytes(16).toString('hex');
    
    const diagnostic = await this.prisma.diagnosticResult.create({
      data: {
        serviceId,
        sourceAgentId,
        sourceLabel,
        perspective: sourceAgentId ? 'agent' : 'hub',
        dnsStatus: result.dnsStatus,
        tcpStatus: result.tcpStatus,
        tlsStatus: result.tlsStatus || null,
        tlsDetails: result.tlsDetails ? JSON.stringify(result.tlsDetails) : null,
        httpStatus: result.httpStatus || null,
        httpDetails: result.httpDetails ? JSON.stringify(result.httpDetails) : null,
        latencyMs: result.latencyMs || null,
        message: result.message,
        raw: result.raw || null,
        shareToken,
      },
      include: {
        sourceAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });

    // Update service status based on all checks
    let status: 'OK' | 'FAIL' = 'OK';
    if (result.tcpStatus !== 'OK') status = 'FAIL';
    else if (result.tlsStatus === 'FAIL') status = 'FAIL';
    else if (result.httpStatus === 'FAIL') status = 'FAIL';
    
    await this.updateStatus(serviceId, status);

    return diagnostic;
  }

  async getDiagnosticHistory(serviceId: string, limit: number = 50, workspaceId?: string) {
    // Get workspace plan limits if workspaceId provided
    if (workspaceId) {
      const usage = await this.workspaceService.getUsage(workspaceId);
      if (usage) {
        const limits = this.workspaceService.getPlanLimits(usage.workspace.plan);
        limit = Math.min(limit, limits.diagnosticHistoryLimit);
      }
    }

    return this.prisma.diagnosticResult.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        sourceAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });
  }

  async getDiagnosticById(id: string) {
    return this.prisma.diagnosticResult.findUnique({
      where: { id },
      include: {
        service: {
          include: { agent: true },
        },
        sourceAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });
  }

  async getDiagnosticByShareToken(shareToken: string) {
    return this.prisma.diagnosticResult.findUnique({
      where: { shareToken },
      include: {
        service: {
          select: { id: true, name: true, targetHost: true, targetPort: true },
        },
        sourceAgent: {
          select: { id: true, label: true, name: true },
        },
      },
    });
  }
}
