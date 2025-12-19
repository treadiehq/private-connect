import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';
import { Prisma } from '@prisma/client';

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

    try {
      const apiKey = await this.prisma.apiKey.create({
        data: {
          workspaceId,
          name: name.trim(),
          key,
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
        createdAt: true,
        lastUsedAt: true,
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
    const apiKey = await this.prisma.apiKey.findUnique({
      where: { key },
      include: { workspace: true },
    });

    if (!apiKey || apiKey.revokedAt) {
      return null;
    }

    // Update last used timestamp
    await this.prisma.apiKey.update({
      where: { id: apiKey.id },
      data: { lastUsedAt: new Date() },
    });

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
}

