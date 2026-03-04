import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes, createHash } from 'crypto';
import { Prisma } from '@prisma/client';

function hashApiKey(key: string): string {
  return createHash('sha256').update(key).digest('hex');
}

@Injectable()
export class ApiKeysService {
  constructor(private prisma: PrismaService) {}

  // Create a new API key for a workspace
  async createApiKey(workspaceId: string, name: string): Promise<{
    id: string;
    name: string;
    key: string; // Full key - only shown once
    keyPrefix: string;
    createdAt: Date;
  }> {
    const key = `pc_${randomBytes(24).toString('hex')}`;
    const keyPrefix = key.slice(0, 11); // "pc_" + first 8 chars
    const keyHash = hashApiKey(key);

    try {
      const apiKey = await this.prisma.apiKey.create({
        data: {
          workspaceId,
          name: name.trim(),
          keyHash,
          keyPrefix,
        },
      });

      return {
        id: apiKey.id,
        name: apiKey.name,
        key, // Return full key only on creation
        keyPrefix: apiKey.keyPrefix,
        createdAt: apiKey.createdAt,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('An API key with this name already exists');
      }
      throw error;
    }
  }

  // List all API keys for a workspace (without full key)
  async listApiKeys(workspaceId: string) {
    const keys = await this.prisma.apiKey.findMany({
      where: { 
        workspaceId,
        revokedAt: null, // Only show active keys
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        allowedIpRanges: true,
        createdAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
      },
    });

    return keys;
  }

  // Revoke an API key
  async revokeApiKey(workspaceId: string, keyId: string): Promise<void> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.workspaceId !== workspaceId) {
      throw new ForbiddenException('API key does not belong to this workspace');
    }

    if (apiKey.revokedAt) {
      throw new ForbiddenException('API key is already revoked');
    }

    await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { revokedAt: new Date() },
    });
  }

  // Validate an API key and return the workspace
  async validateApiKey(key: string) {
    const keyHash = hashApiKey(key);
    // Use withoutRls() for API key validation - we don't know the workspace yet
    const apiKey = await this.prisma.withoutRls(() =>
      this.prisma.apiKey.findUnique({
        where: { keyHash },
        include: { workspace: true },
      })
    );

    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.withoutRls(() =>
      this.prisma.apiKey.update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
    );

    return apiKey.workspace;
  }

  // Count active API keys for a workspace
  async countActiveKeys(workspaceId: string): Promise<number> {
    return this.prisma.apiKey.count({
      where: {
        workspaceId,
        revokedAt: null,
      },
    });
  }

  // Get a single API key by ID (for details view)
  async getApiKey(workspaceId: string, keyId: string) {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        allowedIpRanges: true,
        createdAt: true,
        lastUsedAt: true,
        lastUsedIp: true,
      },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    // Verify ownership via workspace check
    const fullKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });
    
    if (fullKey?.workspaceId !== workspaceId) {
      throw new ForbiddenException('API key does not belong to this workspace');
    }

    return apiKey;
  }

  // Update IP restrictions for an API key
  async updateIpRestrictions(
    workspaceId: string, 
    keyId: string, 
    ipRanges: string[]
  ): Promise<{ id: string; allowedIpRanges: string[] }> {
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { id: keyId },
    });

    if (!apiKey) {
      throw new NotFoundException('API key not found');
    }

    if (apiKey.workspaceId !== workspaceId) {
      throw new ForbiddenException('API key does not belong to this workspace');
    }

    if (apiKey.revokedAt) {
      throw new ForbiddenException('Cannot update revoked API key');
    }

    // Validate CIDR format and mask range
    const cidrRegex = /^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/;
    for (const range of ipRanges) {
      if (!cidrRegex.test(range)) {
        throw new ForbiddenException(`Invalid CIDR format: ${range}`);
      }
      
      // Validate mask value is in valid range for IPv4
      const [, maskStr] = range.split('/');
      if (maskStr) {
        const mask = parseInt(maskStr, 10);
        if (isNaN(mask) || mask < 0 || mask > 32) {
          throw new ForbiddenException(`Invalid CIDR mask: ${range}. Mask must be between 0 and 32`);
        }
      }
    }

    const updated = await this.prisma.apiKey.update({
      where: { id: keyId },
      data: { allowedIpRanges: ipRanges },
      select: {
        id: true,
        allowedIpRanges: true,
      },
    });

    return updated;
  }
}

