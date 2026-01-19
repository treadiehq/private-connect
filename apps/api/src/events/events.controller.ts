import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { EventsService, InstallEventDto } from './events.service';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

@ApiTags('Events')
@Controller('v1/events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  @Post('install')
  @ApiOperation({ summary: 'Track install', description: 'Tracks CLI installation events. No authentication required.' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        os: { type: 'string', example: 'darwin' },
        arch: { type: 'string', example: 'arm64' },
        version: { type: 'string', example: '0.3.9' },
        source: { type: 'string', example: 'install.sh' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Install tracked' })
  async trackInstall(@Body() data: InstallEventDto, @Req() req: Request) {
    // Get IP from headers (for proxied requests) or socket
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      undefined;

    return this.eventsService.trackInstall(data, ipAddress);
  }

  @Get('stats')
  @UseGuards(AuthGuard, AdminGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get install stats', description: 'Returns installation statistics. Requires admin privileges.' })
  @ApiResponse({ status: 200, description: 'Installation statistics' })
  @ApiResponse({ status: 403, description: 'Forbidden - admin only' })
  async getStats() {
    return this.eventsService.getInstallStats();
  }
}
