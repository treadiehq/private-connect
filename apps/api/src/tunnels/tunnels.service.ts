import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ServicesService } from '../services/services.service';
import { SharesService } from '../shares/shares.service';

export interface CreateTunnelDto {
  target: string | { host: string; port: number };
  name?: string;
  protocol?: 'auto' | 'tcp' | 'udp' | 'http' | 'https';
  agentId: string;
  isPublic?: boolean;
}

export interface UpdateTunnelDto {
  name?: string;
  status?: 'active' | 'paused';
  metadata?: Record<string, unknown>;
}

export interface TunnelResponse {
  id: string;
  name: string;
  status: string;
  targetHost: string;
  targetPort: number;
  tunnelPort: number | null;
  protocol: string;
  isPublic: boolean;
  publicUrl: string | null;
  agentId: string | null;
  agentLabel: string | null;
  agentOnline: boolean;
  createdAt: Date;
  lastCheckedAt: Date | null;
}

@Injectable()
export class TunnelsService {
  constructor(
    private prisma: PrismaService,
    private servicesService: ServicesService,
    private sharesService: SharesService,
  ) {}

  /**
   * List all tunnels (active services with tunnelPort or exposed by agents)
   */
  async findAll(workspaceId: string): Promise<TunnelResponse[]> {
    const services = await this.prisma.service.findMany({
      where: { 
        workspaceId,
        OR: [
          { tunnelPort: { not: null } },
          { agentId: { not: null } },
        ],
      },
      include: {
        agent: {
          select: {
            id: true,
            label: true,
            name: true,
            isOnline: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return services.map(s => this.toTunnelResponse(s));
  }

  /**
   * Get a specific tunnel
   */
  async findById(id: string, workspaceId: string): Promise<TunnelResponse | null> {
    const service = await this.prisma.service.findFirst({
      where: { id, workspaceId },
      include: {
        agent: {
          select: {
            id: true,
            label: true,
            name: true,
            isOnline: true,
          },
        },
      },
    });

    if (!service) return null;
    return this.toTunnelResponse(service);
  }

  /**
   * Create a tunnel (expose equivalent)
   */
  async create(workspaceId: string, dto: CreateTunnelDto): Promise<TunnelResponse> {
    // Parse target
    let targetHost: string;
    let targetPort: number;

    if (typeof dto.target === 'string') {
      const parts = dto.target.split(':');
      if (parts.length === 2) {
        targetHost = parts[0];
        targetPort = parseInt(parts[1], 10);
      } else {
        throw new HttpException('Invalid target format. Use host:port', HttpStatus.BAD_REQUEST);
      }
    } else {
      targetHost = dto.target.host;
      targetPort = dto.target.port;
    }

    // Auto-generate name if not provided
    const name = dto.name || this.autoGenerateName(targetPort);

    // Create the service via existing service
    const service = await this.servicesService.register(
      workspaceId,
      dto.agentId,
      name,
      targetHost,
      targetPort,
      dto.protocol || 'auto',
      dto.isPublic || false,
    );

    // Fetch with agent info
    const fullService = await this.prisma.service.findUnique({
      where: { id: service.id },
      include: {
        agent: {
          select: {
            id: true,
            label: true,
            name: true,
            isOnline: true,
          },
        },
      },
    });

    return this.toTunnelResponse(fullService!);
  }

  /**
   * Update a tunnel
   */
  async update(id: string, workspaceId: string, dto: UpdateTunnelDto): Promise<TunnelResponse> {
    const service = await this.prisma.service.findFirst({
      where: { id, workspaceId },
    });

    if (!service) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }

    const updated = await this.prisma.service.update({
      where: { id },
      data: {
        name: dto.name ?? service.name,
        status: dto.status ?? service.status,
      },
      include: {
        agent: {
          select: {
            id: true,
            label: true,
            name: true,
            isOnline: true,
          },
        },
      },
    });

    return this.toTunnelResponse(updated);
  }

  /**
   * Delete a tunnel
   */
  async delete(id: string, workspaceId: string): Promise<void> {
    await this.servicesService.delete(id, workspaceId);
  }

  /**
   * Create a share for a tunnel
   */
  async createShare(
    id: string,
    workspaceId: string,
    userId: string,
    options: {
      name: string;
      description?: string;
      expiresIn?: '1h' | '24h' | '7d' | '30d' | 'never';
      allowedMethods?: string[];
      rateLimitPerMin?: number;
    },
  ): Promise<{ token: string; shareUrl: string }> {
    const service = await this.prisma.service.findFirst({
      where: { id, workspaceId },
    });

    if (!service) {
      throw new HttpException('Tunnel not found', HttpStatus.NOT_FOUND);
    }

    // Calculate expiry
    let expiresAt: Date | undefined;
    if (options.expiresIn && options.expiresIn !== 'never') {
      const now = new Date();
      const durations: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      expiresAt = new Date(now.getTime() + durations[options.expiresIn]);
    }

    const share = await this.sharesService.createShare({
      serviceId: id,
      name: options.name,
      description: options.description,
      expiresAt,
      allowedMethods: options.allowedMethods,
      rateLimitPerMin: options.rateLimitPerMin,
      createdBy: userId,
    });

    const linkBaseUrl = process.env.LINK_BASE_URL || '';
    return {
      token: share.token,
      shareUrl: `${linkBaseUrl}/shared/${share.token}`,
    };
  }

  /**
   * Auto-generate a name from port
   */
  private autoGenerateName(port: number): string {
    const portNames: Record<number, string> = {
      5432: 'postgres',
      3306: 'mysql',
      6379: 'redis',
      27017: 'mongodb',
      9200: 'elasticsearch',
      3000: 'web',
      8080: 'api',
      443: 'https',
      80: 'http',
    };
    return portNames[port] || `service-${port}`;
  }

  /**
   * Transform service to tunnel response
   */
  private toTunnelResponse(service: any): TunnelResponse {
    return {
      id: service.id,
      name: service.name,
      status: service.status,
      targetHost: service.targetHost,
      targetPort: service.targetPort,
      tunnelPort: service.tunnelPort,
      protocol: service.protocol,
      isPublic: service.isPublic,
      publicUrl: service.publicSubdomain
        ? `https://${service.publicSubdomain}.privateconnect.co`
        : null,
      agentId: service.agentId,
      agentLabel: service.agent?.label || null,
      agentOnline: service.agent?.isOnline || false,
      createdAt: service.createdAt,
      lastCheckedAt: service.lastCheckedAt,
    };
  }
}
