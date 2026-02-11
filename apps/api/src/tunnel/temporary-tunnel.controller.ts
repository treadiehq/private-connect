import { Controller, Post, Get, Delete, All, Param, Body, Req, Res, HttpException, HttpStatus, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { Request, Response } from 'express';
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { DebugService } from '../debug/debug.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

const HUB_URL = process.env.HUB_URL || process.env.API_URL || 'https://api.privateconnect.co';
const TEMP_WORKSPACE_ID = 'temp-tunnel-workspace'; // Special workspace for temporary tunnels
const TEMP_USER_EMAIL = 'system@privateconnect.co'; // System user for temporary workspace

interface CreateTunnelDto {
  tunnelId?: string;
  localHost: string;
  localPort: number;
  ttlMinutes?: number;
  type?: 'http' | 'tcp' | 'udp';
  slug?: string; // Optional slug prefix for subdomain (e.g. "stripe" → "stripe-a1b2")
}

@Controller()
export class TemporaryTunnelController implements OnModuleInit {
  constructor(
    private tempTunnelService: TemporaryTunnelService,
    @Inject(forwardRef(() => DebugService))
    private debugService?: DebugService,
    private prisma?: PrismaService,
  ) {}

  async onModuleInit() {
    // Ensure temporary workspace exists on startup
    await this.ensureTemporaryWorkspace();
    // Clean up any orphaned debug sessions from previous runs
    await this.cleanupOrphanedSessions();
  }

  /**
   * Clean up debug sessions that were orphaned by a server restart
   * (sessions still marked "active" but their tunnels no longer exist)
   */
  private async cleanupOrphanedSessions(): Promise<void> {
    if (!this.prisma) return;

    try {
      // Use withWorkspace to properly scope the cleanup to the temp workspace
      const result = await this.prisma.withWorkspace(TEMP_WORKSPACE_ID, () =>
        this.prisma!.debugSession.updateMany({
          where: {
            workspaceId: TEMP_WORKSPACE_ID,
            status: 'active',
          },
          data: {
            status: 'ended',
            endedAt: new Date(),
          },
        })
      );

      if (result.count > 0) {
        console.log(`[TemporaryTunnelController] Cleaned up ${result.count} orphaned debug sessions from previous run`);
      }
    } catch (err: any) {
      console.warn(`[TemporaryTunnelController] Failed to cleanup orphaned sessions: ${err.message}`);
    }
  }

  /**
   * Ensure the temporary workspace exists for debug sessions
   */
  private async ensureTemporaryWorkspace(): Promise<void> {
    if (!this.prisma) return;

    try {
      // Check if workspace exists
      const existing = await this.prisma.workspace.findUnique({
        where: { id: TEMP_WORKSPACE_ID },
      });

      if (existing) {
        return; // Already exists
      }

      // Check if system user exists, create if not
      let systemUser = await this.prisma.user.findUnique({
        where: { email: TEMP_USER_EMAIL },
      });

      if (!systemUser) {
        systemUser = await this.prisma.user.create({
          data: {
            email: TEMP_USER_EMAIL,
            emailVerified: true,
            isAdmin: false,
          },
        });
      }

      // Create temporary workspace
      await this.prisma.workspace.create({
        data: {
          id: TEMP_WORKSPACE_ID,
          name: 'Temporary Tunnels',
          ownerId: systemUser.id,
          plan: 'PRO', // Give it PRO limits for temporary tunnels
        },
      });
    } catch (err: any) {
      // Log but don't fail - debug sessions will just fail gracefully
      console.warn(`Failed to ensure temporary workspace: ${err.message}`);
    }
  }

  /**
   * Create a temporary tunnel - no auth required
   * Supports both HTTP and TCP tunnels
   */
  @Post('v1/tunnels/temporary')
  async createTunnel(@Body() body: CreateTunnelDto) {
    const tunnelId = body.tunnelId || randomBytes(6).toString('hex');
    const ttlMinutes = Math.min(body.ttlMinutes || 120, 120); // Max 2 hours
    const tunnelType = body.type || 'http';
    
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
    
    if (tunnelType === 'tcp') {
      // Create TCP tunnel with dynamic port
      const tunnel = await this.tempTunnelService.createTcpTunnel(
        tunnelId,
        body.localHost,
        body.localPort,
        ttlMinutes,
      );
      
      // Get the hub host for TCP connection
      const hubHost = new URL(HUB_URL).hostname;
      
      return {
        success: true,
        tunnel: {
          tunnelId: tunnel.tunnelId,
          type: 'tcp',
          tcpHost: hubHost,
          tcpPort: tunnel.tcpPort,
          publicUrl: `tcp://${hubHost}:${tunnel.tcpPort}`,
          wsUrl: `${HUB_URL.replace('http', 'ws')}/temp-tunnel`,
          expiresAt: tunnel.expiresAt.toISOString(),
          ttlMinutes,
        },
      };
    }
    
    if (tunnelType === 'udp') {
      // Create UDP tunnel with dynamic port
      const tunnel = await this.tempTunnelService.createUdpTunnel(
        tunnelId,
        body.localHost,
        body.localPort,
        ttlMinutes,
      );
      
      // Get the hub host for UDP connection
      const hubHost = new URL(HUB_URL).hostname;
      
      return {
        success: true,
        tunnel: {
          tunnelId: tunnel.tunnelId,
          type: 'udp',
          udpHost: hubHost,
          udpPort: tunnel.udpPort,
          publicUrl: `udp://${hubHost}:${tunnel.udpPort}`,
          wsUrl: `${HUB_URL.replace('http', 'ws')}/temp-tunnel`,
          expiresAt: tunnel.expiresAt.toISOString(),
          ttlMinutes,
        },
      };
    }
    
    // Create HTTP tunnel
    const tunnel = this.tempTunnelService.createTunnel(
      tunnelId,
      body.localHost,
      body.localPort,
      ttlMinutes,
      body.slug,
    );
    
    // Generate public subdomain URL (ngrok-style: subdomain.privateconnect.co)
    const baseDomain = process.env.BASE_DOMAIN || 'privateconnect.co';
    const publicUrl = tunnel.subdomain 
      ? `https://${tunnel.subdomain}.${baseDomain}`
      : `${HUB_URL}/t/${tunnel.tunnelId}`;
    
    return {
      success: true,
      tunnel: {
        tunnelId: tunnel.tunnelId,
        type: 'http',
        publicUrl,
        subdomain: tunnel.subdomain,
        wsUrl: `${HUB_URL.replace('http', 'ws')}/temp-tunnel`,
        expiresAt: tunnel.expiresAt.toISOString(),
        ttlMinutes,
      },
    };
  }

  /**
   * List all active tunnels
   */
  @Get('v1/tunnels/temporary')
  async listTunnels() {
    const tunnels = this.tempTunnelService.listTunnels();
    
    return {
      count: tunnels.length,
      tunnels: tunnels.map(t => ({
        tunnelId: t.tunnelId,
        type: t.type,
        subdomain: t.subdomain,
        connected: this.tempTunnelService.isConnected(t.tunnelId),
        requestCount: t.requestCount,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
      })),
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
   * Close/delete a tunnel
   */
  @Delete('v1/tunnels/temporary/:tunnelId')
  async closeTunnel(@Param('tunnelId') tunnelId: string) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found or expired', HttpStatus.NOT_FOUND);
    }
    
    this.tempTunnelService.closeTunnel(tunnelId);
    
    return {
      success: true,
      message: `Tunnel ${tunnelId} closed`,
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

  /**
   * Create a debug session for a temporary tunnel (no auth required)
   */
  @Post('v1/tunnels/temporary/:tunnelId/debug')
  async createDebugSession(
    @Param('tunnelId') tunnelId: string,
    @Body() body: { aiEnabled?: boolean },
  ) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found or expired', HttpStatus.NOT_FOUND);
    }

    if (!this.debugService) {
      throw new HttpException('Debug service not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    // Ensure workspace exists before creating debug session
    await this.ensureTemporaryWorkspace();

    // Create debug session with special temporary workspace
    // Use withWorkspace to set proper RLS context for unauthenticated endpoint
    try {
      const session = await this.prisma!.withWorkspace(TEMP_WORKSPACE_ID, () =>
        this.debugService!.createSession({
          workspaceId: TEMP_WORKSPACE_ID,
          name: `Temporary Tunnel: ${tunnelId}`,
          aiEnabled: body.aiEnabled || false,
          expiresIn: Math.ceil((tunnel.expiresAt.getTime() - Date.now()) / 60000), // Match tunnel expiry
        })
      );

      // Link debug session ID (UUID for packet capture) and token (s-xxxxx for widget URL)
      this.tempTunnelService.linkDebugSession(tunnelId, session.id, session.token);

      const publicUrl = process.env.PUBLIC_URL || 'https://privateconnect.co';
      
      return {
        success: true,
        session: {
          id: session.id,
          token: session.token,
          url: `${publicUrl}/debug/${session.token}`,
          status: session.status,
          aiEnabled: session.aiEnabled,
        },
      };
    } catch (err: any) {
      // If workspace doesn't exist, try to create it and retry once
      if (err.message?.includes('workspace') || err.code === 'P2003') {
        await this.ensureTemporaryWorkspace();
        try {
          const session = await this.prisma!.withWorkspace(TEMP_WORKSPACE_ID, () =>
            this.debugService!.createSession({
              workspaceId: TEMP_WORKSPACE_ID,
              name: `Temporary Tunnel: ${tunnelId}`,
              aiEnabled: body.aiEnabled || false,
              expiresIn: Math.ceil((tunnel.expiresAt.getTime() - Date.now()) / 60000),
            })
          );

          // Link debug session ID (UUID for packet capture) and token (s-xxxxx for widget URL)
          this.tempTunnelService.linkDebugSession(tunnelId, session.id, session.token);

          const publicUrl = process.env.PUBLIC_URL || 'https://privateconnect.co';
          
          return {
            success: true,
            session: {
              id: session.id,
              token: session.token,
              url: `${publicUrl}/debug/${session.token}`,
              status: session.status,
              aiEnabled: session.aiEnabled,
            },
          };
        } catch (retryErr: any) {
          throw new HttpException(
            `Failed to create debug session: ${retryErr.message}`,
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }
      }
      throw new HttpException(`Failed to create debug session: ${err.message}`, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}
