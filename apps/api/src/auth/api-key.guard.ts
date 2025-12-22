import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Guard that validates API key from x-api-key header
 * Attaches workspace to request if valid
 */
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    const key = await this.prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { workspace: true },
    });

    if (!key || key.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Update last used timestamp (fire and forget)
    this.prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {});

    // Attach workspace to request for use in controllers
    request.workspace = key.workspace;

    return true;
  }
}

