import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { createHash } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

/**
 * Check if an IP address matches a CIDR range
 * Supports IPv4 only for now
 */
function ipMatchesCidr(ip: string, cidr: string): boolean {
  // Handle IPv6-mapped IPv4 addresses (::ffff:127.0.0.1)
  const normalizedIp = ip.replace(/^::ffff:/, '');
  
  // Parse CIDR
  const [range, bits] = cidr.split('/');
  const mask = bits ? parseInt(bits, 10) : 32;
  
  // Validate mask is in valid range for IPv4
  if (isNaN(mask) || mask < 0 || mask > 32) {
    return false; // Invalid CIDR mask
  }
  
  // Convert IP addresses to numbers
  const ipToNumber = (addr: string): number => {
    const parts = addr.split('.').map(Number);
    if (parts.length !== 4 || parts.some(p => isNaN(p) || p < 0 || p > 255)) {
      return -1; // Invalid IP
    }
    return (parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3];
  };
  
  const ipNum = ipToNumber(normalizedIp);
  const rangeNum = ipToNumber(range);
  
  if (ipNum === -1 || rangeNum === -1) {
    return false; // Invalid IP format
  }
  
  // Create mask and compare
  const maskNum = mask === 0 ? 0 : (~0 << (32 - mask)) >>> 0;
  return (ipNum & maskNum) === (rangeNum & maskNum);
}

/**
 * Check if an IP matches any of the allowed CIDR ranges
 */
function isIpAllowed(ip: string, allowedRanges: string[]): boolean {
  if (!allowedRanges || allowedRanges.length === 0) {
    return true; // No restrictions = allow all
  }
  return allowedRanges.some(cidr => ipMatchesCidr(ip, cidr));
}

/**
 * Guard that validates API key from x-api-key header
 * Attaches workspace to request if valid
 * Enforces IP restrictions if configured
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

    // Use withoutRls() because we don't know the workspace yet - we're authenticating
    const key = await this.prisma.withoutRls(() =>
      this.prisma.apiKey.findUnique({
        where: { keyHash: hashApiKey(apiKey) },
        include: { workspace: true },
      })
    );

    if (!key || key.revokedAt) {
      throw new UnauthorizedException('Invalid API key');
    }

    // Get client IP
    const clientIp = request.ip || 
      request.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || 
      request.connection?.remoteAddress ||
      'unknown';

    // Check IP restrictions
    if (key.allowedIpRanges && key.allowedIpRanges.length > 0) {
      if (!isIpAllowed(clientIp, key.allowedIpRanges)) {
        // Log the rejected attempt
        console.warn(`API key ${key.keyPrefix}... rejected: IP ${clientIp} not in allowed ranges`);
        throw new ForbiddenException('Access denied: IP address not allowed');
      }
    }

    // Update last used timestamp and IP (fire and forget)
    // Use withoutRls() for the update as well
    this.prisma.withoutRls(() =>
      this.prisma.apiKey.update({
        where: { id: key.id },
        data: { 
          lastUsedAt: new Date(),
          lastUsedIp: clientIp,
        },
      })
    ).catch(() => {});

    // Attach workspace to request for use in controllers
    request.workspace = key.workspace;
    request.workspaceId = key.workspace.id;
    request.apiKeyId = key.id;

    return true;
  }
}

// Export utilities for testing
export { ipMatchesCidr, isIpAllowed };
