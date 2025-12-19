import { Controller, Post, Get, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { DeviceService } from './device.service';
import { z } from 'zod';

const CreateDeviceCodeSchema = z.object({
  label: z.string().optional(),
  agentName: z.string().optional(),
});

const VerifyDeviceCodeSchema = z.object({
  userCode: z.string().min(1),
});

@Controller('v1/device')
export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  /**
   * Step 1: CLI calls this to get a device code
   * POST /v1/device/code
   */
  @Post('code')
  async createDeviceCode(@Body() body: unknown) {
    const parsed = CreateDeviceCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { label, agentName } = parsed.data;
    const result = await this.deviceService.createDeviceCode(label, agentName);

    return result;
  }

  /**
   * Step 2: CLI polls this to check if user has authorized
   * GET /v1/device/token?device_code=xxx
   */
  @Get('token')
  async checkDeviceCode(@Query('device_code') deviceCode: string) {
    if (!deviceCode) {
      throw new HttpException('device_code required', HttpStatus.BAD_REQUEST);
    }

    const result = await this.deviceService.checkDeviceCode(deviceCode);

    // Use OAuth2-style response codes
    if (result.status === 'pending') {
      // Still waiting - client should keep polling
      return {
        error: 'authorization_pending',
        error_description: 'The authorization request is still pending',
      };
    }

    if (result.status === 'expired') {
      throw new HttpException({
        error: 'expired_token',
        error_description: 'The device code has expired',
      }, HttpStatus.BAD_REQUEST);
    }

    // Success - authorized
    return {
      api_key: result.apiKey,
      workspace_id: result.workspaceId,
      workspace_name: result.workspaceName,
      user_email: result.userEmail,
    };
  }

  /**
   * Step 3: Web UI calls this after user logs in to verify the device
   * POST /v1/device/verify
   */
  @Post('verify')
  async verifyDeviceCode(
    @Body() body: unknown,
    @Query('user_id') userId: string,
    @Query('workspace_id') workspaceId: string,
  ) {
    const parsed = VerifyDeviceCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    if (!userId || !workspaceId) {
      throw new HttpException('Must be authenticated', HttpStatus.UNAUTHORIZED);
    }

    const { userCode } = parsed.data;
    const result = await this.deviceService.verifyDeviceCode(userCode, userId, workspaceId);

    if (!result.success) {
      throw new HttpException(result.error || 'Verification failed', HttpStatus.BAD_REQUEST);
    }

    return { success: true, message: 'Device authorized' };
  }
}

