import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { isIpAllowed } from './api-key.guard';

/**
 * Guard that accepts either:
 * 1. API key via x-api-key header (for CLI)
 * 2. Session cookie (for web UI)
 * 
 * Attaches workspace to request if valid
 */
@Injectable()
export class CombinedAuthGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    
    // Try API key first
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      const key = await this.prisma.withoutRls(() =>
        this.prisma.apiKey.findUnique({
          where: { key: apiKey },
          include: { workspace: true },
        })
      );

      if (key && !key.revokedAt) {
        const clientIp = request.ip ||
          request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() ||
          request.connection?.remoteAddress ||
          'unknown';

        if (key.allowedIpRanges?.length > 0 && !isIpAllowed(clientIp, key.allowedIpRanges)) {
          console.warn(`API key ${key.keyPrefix}... rejected: IP ${clientIp} not in allowed ranges`);
          throw new ForbiddenException('Access denied: IP address not allowed');
        }

        this.prisma.withoutRls(() =>
          this.prisma.apiKey.update({
            where: { id: key.id },
            data: { lastUsedAt: new Date(), lastUsedIp: clientIp },
          })
        ).catch(() => {});

        request.workspace = key.workspace;
        request.workspaceId = key.workspace.id;
        request.apiKeyId = key.id;
        return true;
      }
    }

    // Try session cookie
    const token = request.cookies?.session;
    if (token) {
      const session = await this.authService.validateSession(token);
      if (session && session.workspace) {
        request.user = session.user;
        request.workspace = session.workspace;
        request.workspaceId = session.workspace.id;
        return true;
      }
    }

    throw new UnauthorizedException('Not authenticated');
  }
}
