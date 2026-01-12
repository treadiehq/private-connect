import { Controller, Post, Get, Body, Req, UseGuards } from '@nestjs/common';
import { EventsService, InstallEventDto } from './events.service';
import { AdminGuard } from '../auth/admin.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Request } from 'express';

@Controller('v1/events')
export class EventsController {
  constructor(private eventsService: EventsService) {}

  /**
   * Track CLI installation
   * POST /v1/events/install
   * 
   * This endpoint is public - no auth required
   * Called from install.sh script
   */
  @Post('install')
  async trackInstall(@Body() data: InstallEventDto, @Req() req: Request) {
    // Get IP from headers (for proxied requests) or socket
    const ipAddress = 
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket?.remoteAddress ||
      null;

    return this.eventsService.trackInstall(data, ipAddress);
  }

  /**
   * Get installation statistics (admin only)
   * GET /v1/events/stats
   */
  @Get('stats')
  @UseGuards(AuthGuard, AdminGuard)
  async getStats() {
    return this.eventsService.getInstallStats();
  }
}
