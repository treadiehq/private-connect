import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Headers,
  HttpException,
  HttpStatus,
  Req,
  Res,
  All,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { SharesService } from './shares.service';
import { ServicesService } from '../services/services.service';
import { AuthService } from '../auth/auth.service';
import * as http from 'http';
import * as https from 'https';
import { z } from 'zod';

const CreateShareSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never']).optional(),
  allowedPaths: z.array(z.string()).optional(),
  allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])).optional(),
  rateLimitPerMin: z.number().min(1).max(1000).optional(),
});

@Controller()
export class SharesController {
  constructor(
    private sharesService: SharesService,
    private servicesService: ServicesService,
    private authService: AuthService,
  ) {}

  /**
   * Create a share for a service
   * POST /v1/services/:serviceId/shares
   */
  @Post('v1/services/:serviceId/shares')
  async createShare(
    @Param('serviceId') serviceId: string,
    @Body() body: unknown,
    @Headers('authorization') authHeader: string,
  ) {
    const parsed = CreateShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Validate auth and get user
    const session = await this.authService.validateSession(
      authHeader?.replace('Bearer ', ''),
    );
    if (!session) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Verify service exists and belongs to user's workspace
    const service = await this.servicesService.findById(serviceId);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Calculate expiry
    let expiresAt: Date | undefined;
    if (parsed.data.expiresIn && parsed.data.expiresIn !== 'never') {
      const now = new Date();
      const durations: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000,
      };
      expiresAt = new Date(now.getTime() + durations[parsed.data.expiresIn]);
    }

    const share = await this.sharesService.createShare({
      serviceId,
      name: parsed.data.name,
      description: parsed.data.description,
      expiresAt,
      allowedPaths: parsed.data.allowedPaths,
      allowedMethods: parsed.data.allowedMethods,
      rateLimitPerMin: parsed.data.rateLimitPerMin,
      createdBy: session.user.id,
    });

    return {
      success: true,
      share: {
        id: share.id,
        token: share.token,
        name: share.name,
        expiresAt: share.expiresAt,
        shareUrl: `/shared/${share.token}`,
      },
    };
  }

  /**
   * List shares for a service
   * GET /v1/services/:serviceId/shares
   */
  @Get('v1/services/:serviceId/shares')
  async listShares(
    @Param('serviceId') serviceId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const session = await this.authService.validateSession(
      authHeader?.replace('Bearer ', ''),
    );
    if (!session) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const shares = await this.sharesService.getSharesForService(serviceId);

    return {
      shares: shares.map((s: { id: string; name: string; description: string | null; expiresAt: Date | null; revokedAt: Date | null; createdAt: Date; lastAccessedAt: Date | null; accessCount: number; token: string }) => ({
        id: s.id,
        name: s.name,
        description: s.description,
        expiresAt: s.expiresAt,
        revokedAt: s.revokedAt,
        createdAt: s.createdAt,
        lastAccessedAt: s.lastAccessedAt,
        accessCount: s.accessCount,
        isActive: !s.revokedAt && (!s.expiresAt || s.expiresAt > new Date()),
        shareUrl: `/shared/${s.token}`,
        // Don't expose full token in list - only prefix
        tokenPreview: `${s.token.slice(0, 12)}...`,
      })),
    };
  }

  /**
   * Revoke a share
   * DELETE /v1/shares/:shareId
   */
  @Delete('v1/shares/:shareId')
  async revokeShare(
    @Param('shareId') shareId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const session = await this.authService.validateSession(
      authHeader?.replace('Bearer ', ''),
    );
    if (!session) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    await this.sharesService.revokeShare(shareId);
    return { success: true };
  }

  /**
   * Get access logs for a share
   * GET /v1/shares/:shareId/logs
   */
  @Get('v1/shares/:shareId/logs')
  async getAccessLogs(
    @Param('shareId') shareId: string,
    @Headers('authorization') authHeader: string,
  ) {
    const session = await this.authService.validateSession(
      authHeader?.replace('Bearer ', ''),
    );
    if (!session) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    const logs = await this.sharesService.getAccessLogs(shareId);
    return { logs };
  }

  /**
   * Public proxy endpoint for shared access
   * ALL /shared/:token/*
   */
  @All('shared/:token')
  @All('shared/:token/*')
  async proxySharedRequest(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const startTime = Date.now();

    // Validate share
    const path = req.path.replace(`/shared/${token}`, '') || '/';
    const validation = await this.sharesService.validateShare(token, path, req.method);

    if (!validation.valid || !validation.share) {
      res.status(403).json({ error: validation.reason || 'Access denied' });
      return;
    }

    const share = validation.share;
    const service = share.service;

    if (!service.tunnelPort && !service.isExternal) {
      res.status(503).json({ error: 'Service not available (no tunnel)' });
      return;
    }

    // Determine target
    const targetHost = service.isExternal ? service.targetHost : '127.0.0.1';
    const targetPort = service.isExternal ? service.targetPort : service.tunnelPort!;
    const useHttps = service.protocol === 'https' || service.targetPort === 443;

    // Proxy the request
    const protocol = useHttps ? https : http;
    
    const proxyReq = protocol.request(
      {
        hostname: targetHost,
        port: targetPort,
        path: path,
        method: req.method,
        headers: {
          ...req.headers,
          host: `${targetHost}:${targetPort}`,
          'x-forwarded-for': req.ip,
          'x-shared-access': 'true',
          'x-share-name': share.name,
        },
        rejectUnauthorized: false,
      },
      (proxyRes) => {
        const latencyMs = Date.now() - startTime;

        // Log the access
        this.sharesService.logAccess(share.id, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          path,
          method: req.method,
          statusCode: proxyRes.statusCode,
          latencyMs,
        });

        // Forward response
        res.status(proxyRes.statusCode || 200);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('error', (error) => {
      const latencyMs = Date.now() - startTime;
      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path,
        method: req.method,
        statusCode: 502,
        latencyMs,
      });

      res.status(502).json({ error: 'Failed to connect to service', details: error.message });
    });

    // Forward request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  }
}

