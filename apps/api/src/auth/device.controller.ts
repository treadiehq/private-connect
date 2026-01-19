import { Controller, Post, Get, Body, Query, Req, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiQuery, ApiBearerAuth } from '@nestjs/swagger';
import { DeviceService } from './device.service';
import { AuthGuard } from './auth.guard';
import { z } from 'zod';

const CreateDeviceCodeSchema = z.object({
  label: z.string().optional(),
  agentName: z.string().optional(),
});

const VerifyDeviceCodeSchema = z.object({
  userCode: z.string().min(1),
});

@ApiTags('Auth')
@Controller('v1/device')
export class DeviceController {
  constructor(private deviceService: DeviceService) {}

  @Post('code')
  @ApiOperation({ summary: 'Create device code', description: 'Creates a device code for CLI authentication flow.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        label: { type: 'string', example: 'prod-server' },
        agentName: { type: 'string', example: 'web-server-1' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device code created' })
  async createDeviceCode(@Body() body: unknown) {
    const parsed = CreateDeviceCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    const { label, agentName } = parsed.data;
    const result = await this.deviceService.createDeviceCode(label, agentName);

    return result;
  }

  @Get('token')
  @ApiOperation({ summary: 'Check device code', description: 'CLI polls this to check if user has authorized the device.' })
  @ApiQuery({ name: 'device_code', required: true, description: 'The device code to check' })
  @ApiResponse({ status: 200, description: 'Authorization status' })
  @ApiResponse({ status: 400, description: 'Expired or invalid code' })
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

  @Post('verify')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Verify device code', description: 'Web UI calls this to authorize a device after user logs in.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['userCode'],
      properties: {
        userCode: { type: 'string', example: 'ABCD-1234' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Device authorized' })
  @ApiResponse({ status: 400, description: 'Invalid code' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  async verifyDeviceCode(
    @Body() body: unknown,
    @Req() request: any,
  ) {
    const parsed = VerifyDeviceCodeSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Extract authenticated user and workspace from the session (populated by AuthGuard)
    const userId = request.user?.id;
    const workspaceId = request.workspace?.id;

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

