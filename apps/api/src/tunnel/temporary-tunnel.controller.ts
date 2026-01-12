import { Controller, Post, Get, All, Param, Body, Req, Res, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { randomBytes } from 'crypto';

const HUB_URL = process.env.HUB_URL || process.env.API_URL || 'https://api.privateconnect.co';

interface CreateTunnelDto {
  tunnelId?: string;
  localHost: string;
  localPort: number;
  ttlMinutes?: number;
}

@Controller()
export class TemporaryTunnelController {
  constructor(private tempTunnelService: TemporaryTunnelService) {}

  /**
   * Create a temporary tunnel - no auth required
   */
  @Post('v1/tunnels/temporary')
  async createTunnel(@Body() body: CreateTunnelDto) {
    const tunnelId = body.tunnelId || randomBytes(6).toString('hex');
    const ttlMinutes = Math.min(body.ttlMinutes || 120, 120); // Max 2 hours
    
    // Validate
    if (!body.localHost || !body.localPort) {
      throw new HttpException('localHost and localPort required', HttpStatus.BAD_REQUEST);
    }
    
    if (body.localPort < 1 || body.localPort > 65535) {
      throw new HttpException('Invalid port', HttpStatus.BAD_REQUEST);
    }
    
    // Check if tunnel ID already exists
    if (this.tempTunnelService.getTunnel(tunnelId)) {
      throw new HttpException('Tunnel ID already exists', HttpStatus.CONFLICT);
    }
    
    const tunnel = this.tempTunnelService.createTunnel(
      tunnelId,
      body.localHost,
      body.localPort,
      ttlMinutes,
    );
    
    return {
      success: true,
      tunnel: {
        tunnelId: tunnel.tunnelId,
        publicUrl: `${HUB_URL}/t/${tunnel.tunnelId}`,
        wsUrl: `${HUB_URL.replace('http', 'ws')}/temp-tunnel`,
        expiresAt: tunnel.expiresAt.toISOString(),
        ttlMinutes,
      },
    };
  }

  /**
   * Get tunnel status
   */
  @Get('v1/tunnels/temporary/:tunnelId')
  async getTunnelStatus(@Param('tunnelId') tunnelId: string) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found or expired', HttpStatus.NOT_FOUND);
    }
    
    return {
      tunnelId: tunnel.tunnelId,
      connected: this.tempTunnelService.isConnected(tunnelId),
      requestCount: tunnel.requestCount,
      createdAt: tunnel.createdAt.toISOString(),
      expiresAt: tunnel.expiresAt.toISOString(),
    };
  }

  /**
   * Proxy all requests to /t/:tunnelId/* through the tunnel
   */
  @All('t/:tunnelId')
  @All('t/:tunnelId/*')
  async proxyRequest(
    @Param('tunnelId') tunnelId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      return res.status(404).json({
        error: 'Tunnel not found',
        message: 'This tunnel has expired or does not exist',
      });
    }
    
    if (!this.tempTunnelService.isConnected(tunnelId)) {
      return res.status(503).json({
        error: 'Tunnel disconnected',
        message: 'The tunnel client is not connected',
      });
    }
    
    // Extract path after /t/:tunnelId
    const fullPath = req.path;
    const targetPath = fullPath.replace(`/t/${tunnelId}`, '') || '/';
    
    // Build headers (exclude hop-by-hop headers)
    const headers: Record<string, string> = {};
    const hopByHopHeaders = ['connection', 'keep-alive', 'transfer-encoding', 'upgrade', 'proxy-connection'];
    for (const [key, value] of Object.entries(req.headers)) {
      if (!hopByHopHeaders.includes(key.toLowerCase()) && typeof value === 'string') {
        headers[key] = value;
      }
    }
    
    // Add forwarding headers
    headers['x-forwarded-for'] = req.ip || 'unknown';
    headers['x-forwarded-proto'] = req.protocol;
    headers['x-forwarded-host'] = req.get('host') || '';
    
    // Get request body
    let body = '';
    if (req.body) {
      body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }
    
    try {
      const response = await this.tempTunnelService.forwardRequest(tunnelId, {
        method: req.method,
        path: targetPath + (req.url.includes('?') ? '?' + req.url.split('?')[1] : ''),
        headers,
        body,
      });
      
      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (!hopByHopHeaders.includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      
      res.status(response.status).send(response.body);
    } catch (err: any) {
      if (err.message === 'Request timeout') {
        return res.status(504).json({
          error: 'Gateway Timeout',
          message: 'The local service did not respond in time',
        });
      }
      
      return res.status(502).json({
        error: 'Bad Gateway',
        message: err.message,
      });
    }
  }
}
