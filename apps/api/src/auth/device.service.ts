import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

// User code format: XXXX-XXXX (easy to type)
function generateUserCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for clarity
  let code = '';
  for (let i = 0; i < 8; i++) {
    if (i === 4) code += '-';
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export interface DeviceCodeResponse {
  deviceCode: string;      // Secret, used for polling
  userCode: string;        // Shown to user (ABCD-1234)
  verificationUrl: string; // URL to visit
  expiresIn: number;       // Seconds until expiry
  interval: number;        // Polling interval in seconds
}

export interface DeviceTokenResponse {
  status: 'pending' | 'authorized' | 'expired';
  apiKey?: string;
  workspaceId?: string;
  workspaceName?: string;
  userEmail?: string;
}

@Injectable()
export class DeviceService {
  constructor(private prisma: PrismaService) {}

  /**
   * Create a new device code for authorization
   */
  async createDeviceCode(label?: string, agentName?: string): Promise<DeviceCodeResponse> {
    const deviceCode = randomBytes(32).toString('hex');
    const userCode = generateUserCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    await this.prisma.deviceCode.create({
      data: {
        deviceCode,
        userCode,
        expiresAt,
        label,
        agentName,
      },
    });

    const baseUrl = process.env.WEB_URL || 'http://localhost:3000';

    return {
      deviceCode,
      userCode,
      verificationUrl: `${baseUrl}/device`,
      expiresIn: 900, // 15 minutes in seconds
      interval: 5,    // Poll every 5 seconds
    };
  }

  /**
   * Poll for device authorization status
   */
  async checkDeviceCode(deviceCode: string): Promise<DeviceTokenResponse> {
    const device = await this.prisma.deviceCode.findUnique({
      where: { deviceCode },
    });

    if (!device) {
      return { status: 'expired' };
    }

    if (device.expiresAt < new Date()) {
      // Clean up expired code
      await this.prisma.deviceCode.delete({ where: { id: device.id } }).catch(() => {});
      return { status: 'expired' };
    }

    if (device.verifiedAt && device.apiKey && device.workspaceId) {
      // Get workspace info
      const workspace = await this.prisma.workspace.findUnique({
        where: { id: device.workspaceId },
        include: { owner: true },
      });

      // Clean up used code
      await this.prisma.deviceCode.delete({ where: { id: device.id } }).catch(() => {});

      return {
        status: 'authorized',
        apiKey: device.apiKey,
        workspaceId: device.workspaceId,
        workspaceName: workspace?.name,
        userEmail: workspace?.owner.email,
      };
    }

    return { status: 'pending' };
  }

  /**
   * Verify a device code (called when user logs in via browser)
   */
  async verifyDeviceCode(
    userCode: string,
    userId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    // Normalize user code: remove dashes, uppercase, then re-add dash in correct position
    const normalizedCode = userCode.replace(/-/g, '').toUpperCase();
    
    // Validate length (should be exactly 8 alphanumeric characters after removing dash)
    if (normalizedCode.length !== 8) {
      return { success: false, error: 'Invalid code format' };
    }

    // Format code with dash in correct position to match stored format (XXXX-XXXX)
    const formattedCode = `${normalizedCode.slice(0, 4)}-${normalizedCode.slice(4)}`;

    // Use exact match with properly formatted code - no fuzzy search to avoid collisions
    const targetDevice = await this.prisma.deviceCode.findUnique({
      where: { userCode: formattedCode },
    });

    if (!targetDevice) {
      return { success: false, error: 'Invalid code' };
    }

    if (targetDevice.expiresAt < new Date()) {
      return { success: false, error: 'Code expired' };
    }

    if (targetDevice.verifiedAt) {
      return { success: false, error: 'Code already used' };
    }

    // Get workspace and create API key for the agent
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      return { success: false, error: 'Workspace not found' };
    }

    // Generate API key for this agent
    const apiKey = `pc_${randomBytes(24).toString('hex')}`;
    const keyPrefix = apiKey.substring(0, 11);
    const keyName = targetDevice.agentName || targetDevice.label || 'CLI Agent';

    // Create API key record
    await this.prisma.apiKey.create({
      data: {
        workspaceId,
        name: `${keyName} (device auth)`,
        key: apiKey,
        keyPrefix,
      },
    });

    // Mark device code as verified
    await this.prisma.deviceCode.update({
      where: { id: targetDevice.id },
      data: {
        verifiedAt: new Date(),
        userId,
        workspaceId,
        apiKey,
      },
    });

    return { success: true };
  }

  /**
   * Find pending device code by user code (for display in UI)
   */
  async findByUserCode(userCode: string) {
    return this.prisma.deviceCode.findUnique({
      where: { userCode: userCode.toUpperCase() },
    });
  }

  /**
   * Clean up expired device codes
   */
  async cleanupExpired() {
    await this.prisma.deviceCode.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
  }
}

