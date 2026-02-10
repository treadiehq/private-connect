import { Injectable, Inject, forwardRef, HttpException, HttpStatus, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { WorkspaceService } from '../workspace/workspace.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { randomBytes } from 'crypto';

// Port allocation range for tunnels
const TUNNEL_PORT_MIN = 23000;
const TUNNEL_PORT_MAX = 23999;

// Public URL base
const PUBLIC_URL_BASE = process.env.PUBLIC_URL_BASE || 'https://privateconnect.co';

@Injectable()
export class ServicesService implements OnModuleInit {
  private usedPorts = new Set<number>();

  constructor(
    private prisma: PrismaService,
    @Inject(forwardRef(() => TunnelService))
    private tunnelService: TunnelService,
    @Inject(forwardRef(() => WorkspaceService))
    private workspaceService: WorkspaceService,
    private webhooksService: WebhooksService,
  ) {
    // Constructor should only perform dependency injection
  }

  async onModuleInit() {
    await this.loadUsedPorts();
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

  private generateSubdomain(): string {
    // Generate a short, URL-safe random subdomain (8 chars)
    return randomBytes(4).toString('hex');
  }

  getPublicUrl(subdomain: string): string {
    return `${PUBLIC_URL_BASE}/w/${subdomain}`;
  }

  // Validate service name
  validateName(name: string): { valid: boolean; error?: string } {
    if (!name || name.trim().length === 0) {
      return { valid: false, error: 'Name is required' };
    }
    if (name.length < 1) {
      return { valid: false, error: 'Name must be at least 1 character' };
    }
    if (name.length > 100) {
      return { valid: false, error: 'Name must be 100 characters or less' };
    }
    // Only allow URL-safe characters
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      return { valid: false, error: 'Name can only contain letters, numbers, hyphens, and underscores' };
    }
    return { valid: true };
  }

  // Check if a name is available in the workspace
  async isNameAvailable(workspaceId: string, name: string, excludeServiceId?: string): Promise<boolean> {
    const existing = await this.prisma.service.findFirst({
      where: {
        workspaceId,
        name: name.toLowerCase(),
        id: excludeServiceId ? { not: excludeServiceId } : undefined,
      },
    });
    return !existing;
  }

  // Rename a service
  async rename(
    serviceId: string,
    workspaceId: string,
    newName: string,
  ): Promise<{ success: boolean; error?: string; service?: any }> {
    // Find the service
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { agent: true },
    });

    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    if (service.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden' };
    }

    // Validate the new name
    const validation = this.validateName(newName);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const normalizedName = newName.toLowerCase();

    // Check if name is already taken (by another service)
    const isAvailable = await this.isNameAvailable(workspaceId, normalizedName, serviceId);
    if (!isAvailable) {
      return { success: false, error: 'A service with this name already exists' };
    }

    // Update the service
    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: { name: normalizedName },
      include: { agent: true },
    });

    return { success: true, service: updated };
  }

  // Reserved subdomains that can't be used
  private readonly RESERVED_SUBDOMAINS = new Set([
    'www', 'api', 'app', 'admin', 'dashboard', 'hub', 'docs', 'blog',
    'help', 'support', 'status', 'mail', 'ftp', 'ssh', 'git', 'cdn',
    'static', 'assets', 'media', 'images', 'files', 'download', 'upload',
    'auth', 'login', 'logout', 'signup', 'register', 'account', 'settings',
    'billing', 'pricing', 'about', 'contact', 'terms', 'privacy', 'legal',
  ]);

  validateSubdomain(subdomain: string): { valid: boolean; error?: string } {
    // Length check: 3-32 characters
    if (subdomain.length < 3) {
      return { valid: false, error: 'Subdomain must be at least 3 characters' };
    }
    if (subdomain.length > 32) {
      return { valid: false, error: 'Subdomain must be 32 characters or less' };
    }

    // Only lowercase alphanumeric and hyphens
    if (!/^[a-z0-9-]+$/.test(subdomain)) {
      return { valid: false, error: 'Subdomain can only contain lowercase letters, numbers, and hyphens' };
    }

    // Can't start or end with hyphen
    if (subdomain.startsWith('-') || subdomain.endsWith('-')) {
      return { valid: false, error: 'Subdomain cannot start or end with a hyphen' };
    }

    // No consecutive hyphens
    if (subdomain.includes('--')) {
      return { valid: false, error: 'Subdomain cannot contain consecutive hyphens' };
    }

    // Check reserved
    if (this.RESERVED_SUBDOMAINS.has(subdomain)) {
      return { valid: false, error: 'This subdomain is reserved' };
    }

    return { valid: true };
  }

  async isSubdomainAvailable(subdomain: string, excludeServiceId?: string): Promise<boolean> {
    const existing = await this.prisma.service.findUnique({
      where: { publicSubdomain: subdomain },
    });
    
    // Available if no existing, or if it's the same service
    return !existing || existing.id === excludeServiceId;
  }

  async setCustomSubdomain(
    serviceId: string,
    workspaceId: string,
    subdomain: string | null,
  ): Promise<{ success: boolean; error?: string; service?: any }> {
    // Verify service belongs to workspace
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return { success: false, error: 'Service not found' };
    }

    if (service.workspaceId !== workspaceId) {
      return { success: false, error: 'Forbidden' };
    }

    // If clearing subdomain
    if (!subdomain) {
      const updated = await this.prisma.service.update({
        where: { id: serviceId },
        data: { 
          publicSubdomain: null,
          isPublic: false,
        },
        include: { agent: true },
      });
      return { success: true, service: updated };
    }

    // Validate subdomain
    const validation = this.validateSubdomain(subdomain);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Check availability
    const available = await this.isSubdomainAvailable(subdomain, serviceId);
    if (!available) {
      return { success: false, error: 'This subdomain is already taken' };
    }

    // Update service
    const updated = await this.prisma.service.update({
      where: { id: serviceId },
      data: {
        publicSubdomain: subdomain,
        isPublic: true,
      },
      include: { agent: true },
    });

    return { success: true, service: updated };
  }

  async findBySubdomain(subdomain: string) {
    return this.prisma.service.findUnique({
      where: { publicSubdomain: subdomain },
      include: { agent: true },
    });
  }

  async register(
    workspaceId: string,
    agentId: string,
    name: string,
    targetHost: string,
    targetPort: number,
    protocol: string = 'auto',
    isPublic: boolean = false,
  ) {
    // Check if service already exists (for port reuse and limit checking)
    const existing = await this.prisma.service.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });

    const isNewService = !existing;

    // Check plan limits only if creating a new service
    if (isNewService) {
      const usage = await this.workspaceService.getUsage(workspaceId);
      if (!usage?.canAddService) {
        throw new HttpException(
          `Service limit reached. Upgrade to PRO for more services.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    const agent = await this.prisma.agent.findUnique({
      where: { id: agentId },
      select: { workspaceId: true },
    });

    if (!agent) {
      throw new HttpException('Agent not found', HttpStatus.NOT_FOUND);
    }

    if (agent.workspaceId !== workspaceId) {
      throw new HttpException('Forbidden: Agent belongs to another workspace', HttpStatus.FORBIDDEN);
    }

    // Reuse existing port if updating, otherwise allocate new port
    // This prevents port leaks when services are updated
    const tunnelPort = existing?.tunnelPort || this.allocatePort();
    
    // Generate public subdomain if requested (keep existing if already set)
    const publicSubdomain = isPublic 
      ? (existing?.publicSubdomain || this.generateSubdomain()) 
      : null;
    
    const service = await this.prisma.service.upsert({
      where: { workspaceId_name: { workspaceId, name } },
      update: {
        targetHost,
        targetPort,
        tunnelPort,
        protocol,
        status: 'UNKNOWN',
        agentId,
        isPublic,
        publicSubdomain: isPublic ? publicSubdomain : null,
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
        isPublic,
        publicSubdomain,
      },
      include: { agent: true },
    });

    // Emit webhook for new service/tunnel creation
    if (isNewService) {
      this.webhooksService.emit(workspaceId, 'tunnel.created', {
        serviceId: service.id,
        serviceName: service.name,
        targetHost: service.targetHost,
        targetPort: service.targetPort,
        tunnelPort: service.tunnelPort,
        protocol: service.protocol,
        agentId: service.agentId,
        agentLabel: service.agent?.label,
        createdAt: service.createdAt.toISOString(),
      }).catch(() => {}); // Fire and forget
    }

    return service;
  }

  async registerExternal(
    workspaceId: string,
    name: string,
    targetHost: string,
    targetPort: number,
    protocol: string = 'auto',
  ) {
    const existing = await this.prisma.service.findUnique({
      where: { workspaceId_name: { workspaceId, name } },
    });

    // Check plan limits
    const usage = await this.workspaceService.getUsage(workspaceId);
    if (!usage?.canAddService) {
      // Check if this is an update (existing service)
      if (!existing) {
        throw new HttpException(
          `Service limit reached. Upgrade to PRO for more services.`,
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

    if (existing?.tunnelPort) {
      this.releasePort(existing.tunnelPort);
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

  async delete(serviceId: string, workspaceId: string) {
    // Verify service belongs to workspace
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: { agent: { select: { label: true } } },
    });

    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    if (service.workspaceId !== workspaceId) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    // Release tunnel port if allocated
    if (service.tunnelPort) {
      this.releasePort(service.tunnelPort);
    }

    // Delete service (cascade will handle diagnostics, sessions, shares)
    await this.prisma.service.delete({
      where: { id: serviceId },
    });

    // Emit webhook for tunnel deletion
    this.webhooksService.emit(workspaceId, 'tunnel.deleted', {
      serviceId: service.id,
      serviceName: service.name,
      agentId: service.agentId,
      agentLabel: service.agent?.label,
      deletedAt: new Date().toISOString(),
    }).catch(() => {}); // Fire and forget

    return { success: true };
  }
}
