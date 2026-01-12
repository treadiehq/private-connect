import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface InstallEventDto {
  os: string;
  arch: string;
  version: string;
  source?: string;
}

@Injectable()
export class EventsService {
  constructor(private prisma: PrismaService) {}

  async trackInstall(data: InstallEventDto, ipAddress?: string) {
    // Validate OS
    const validOs = ['darwin', 'linux', 'windows'];
    const os = validOs.includes(data.os?.toLowerCase()) ? data.os.toLowerCase() : 'unknown';
    
    // Validate arch
    const validArch = ['x64', 'arm64', 'x86'];
    const arch = validArch.includes(data.arch?.toLowerCase()) ? data.arch.toLowerCase() : 'unknown';
    
    // Store the event
    await this.prisma.installEvent.create({
      data: {
        os,
        arch,
        version: data.version || 'unknown',
        source: data.source || 'install.sh',
        ipAddress: ipAddress || null,
      },
    });

    return { success: true };
  }

  async getInstallStats() {
    const [total, last24h, last7d, byOs, byArch, bySource, recent] = await Promise.all([
      // Total installs
      this.prisma.installEvent.count(),
      
      // Last 24 hours
      this.prisma.installEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
        },
      }),
      
      // Last 7 days
      this.prisma.installEvent.count({
        where: {
          createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      
      // By OS
      this.prisma.installEvent.groupBy({
        by: ['os'],
        _count: true,
      }),
      
      // By architecture
      this.prisma.installEvent.groupBy({
        by: ['arch'],
        _count: true,
      }),
      
      // By source
      this.prisma.installEvent.groupBy({
        by: ['source'],
        _count: true,
      }),
      
      // Recent installs
      this.prisma.installEvent.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        select: {
          os: true,
          arch: true,
          version: true,
          source: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      total,
      last24h,
      last7d,
      byOs: byOs.reduce((acc: Record<string, number>, item: { os: string; _count: number }) => ({ ...acc, [item.os]: item._count }), {}),
      byArch: byArch.reduce((acc: Record<string, number>, item: { arch: string; _count: number }) => ({ ...acc, [item.arch]: item._count }), {}),
      bySource: bySource.reduce((acc: Record<string, number>, item: { source: string; _count: number }) => ({ ...acc, [item.source]: item._count }), {}),
      recent,
    };
  }
}
