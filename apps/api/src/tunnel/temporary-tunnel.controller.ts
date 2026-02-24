import { Controller, Post, Get, Delete, All, Param, Body, Req, Res, HttpException, HttpStatus, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import { Request, Response } from 'express';
import * as net from 'net';
import { TemporaryTunnelService } from './temporary-tunnel.service';
import { DebugService } from '../debug/debug.service';
import { PrismaService } from '../prisma/prisma.service';
import { randomBytes } from 'crypto';

const HUB_URL = process.env.HUB_URL || process.env.API_URL || 'https://api.privateconnect.co';
const PUBLIC_URL = process.env.PUBLIC_URL || 'https://privateconnect.co';
const TEMP_WORKSPACE_ID = 'temp-tunnel-workspace';
const TEMP_USER_EMAIL = 'system@privateconnect.co';

const DB_PORTS: Record<number, string> = {
  5432: 'PostgreSQL',
  3306: 'MySQL',
  27017: 'MongoDB',
  6379: 'Redis',
  9200: 'Elasticsearch',
  5984: 'CouchDB',
  8529: 'ArangoDB',
  7687: 'Neo4j',
  9042: 'Cassandra',
};

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
      await this.prisma.withoutRls(async () => {
        const existing = await this.prisma!.workspace.findUnique({
          where: { id: TEMP_WORKSPACE_ID },
        });

        if (existing) {
          return;
        }

        let systemUser = await this.prisma!.user.findUnique({
          where: { email: TEMP_USER_EMAIL },
        });

        if (!systemUser) {
          systemUser = await this.prisma!.user.create({
            data: {
              email: TEMP_USER_EMAIL,
              emailVerified: true,
              isAdmin: false,
            },
          });
        }

        await this.prisma!.workspace.create({
          data: {
            id: TEMP_WORKSPACE_ID,
            name: 'Temporary Tunnels',
            ownerId: systemUser.id,
            plan: 'PRO',
          },
        });
      });
    } catch (err: any) {
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
      const tunnel = await this.tempTunnelService.createTcpTunnel(
        tunnelId,
        body.localHost,
        body.localPort,
        ttlMinutes,
      );
      
      const hubHost = new URL(HUB_URL).hostname;
      const isDbPort = body.localPort in DB_PORTS;
      
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
          ...(isDbPort && { webUrl: `${PUBLIC_URL}/tunnel/${tunnelId}` }),
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
   * Get tunnel info for the web viewer (no auth required)
   */
  @Get('v1/tunnels/temporary/:tunnelId/info')
  async getTunnelInfo(@Param('tunnelId') tunnelId: string) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found or expired', HttpStatus.NOT_FOUND);
    }
    
    const dbType = DB_PORTS[tunnel.localPort];
    
    return {
      tunnelId: tunnel.tunnelId,
      type: tunnel.type,
      localPort: tunnel.localPort,
      connected: this.tempTunnelService.isConnected(tunnelId),
      expiresAt: tunnel.expiresAt.toISOString(),
      serviceType: dbType ? 'database' : (tunnel.localPort === 22 ? 'ssh' : 'other'),
      databaseType: dbType || null,
    };
  }

  /**
   * Execute a SQL query through a temporary TCP tunnel (no auth required)
   */
  @Post('v1/tunnels/temporary/:tunnelId/query')
  async executeQuery(
    @Param('tunnelId') tunnelId: string,
    @Body() body: { query?: string },
  ) {
    const tunnel = this.tempTunnelService.getTunnel(tunnelId);
    
    if (!tunnel) {
      throw new HttpException('Tunnel not found or expired', HttpStatus.NOT_FOUND);
    }
    
    if (!this.tempTunnelService.isConnected(tunnelId)) {
      throw new HttpException('Tunnel not connected', HttpStatus.SERVICE_UNAVAILABLE);
    }
    
    if (tunnel.type !== 'tcp' || !tunnel.tcpPort) {
      throw new HttpException('Query execution requires a TCP tunnel', HttpStatus.BAD_REQUEST);
    }
    
    if (!(tunnel.localPort in DB_PORTS)) {
      throw new HttpException('Query execution is only supported for database ports', HttpStatus.BAD_REQUEST);
    }
    
    if (!body.query || body.query.length === 0 || body.query.length > 10000) {
      throw new HttpException('Invalid query', HttpStatus.BAD_REQUEST);
    }
    
    if (tunnel.localPort === 5432) {
      try {
        const result = await this.executePostgresQuery('127.0.0.1', tunnel.tcpPort, body.query);
        return result;
      } catch (err: any) {
        throw new HttpException(err.message, HttpStatus.INTERNAL_SERVER_ERROR);
      }
    }
    
    throw new HttpException(
      `Query execution for ${DB_PORTS[tunnel.localPort]} is not yet implemented`,
      HttpStatus.NOT_IMPLEMENTED,
    );
  }

  private executePostgresQuery(
    host: string,
    port: number,
    query: string,
  ): Promise<{ columns: string[]; rows: any[]; rowCount: number }> {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = Buffer.alloc(0);
      let columns: string[] = [];
      const rows: any[] = [];
      let rowCount = 0;

      socket.setTimeout(10000);
      socket.on('timeout', () => { socket.destroy(); reject(new Error('Connection timeout')); });
      socket.on('error', (err: Error) => { reject(err); });

      socket.on('data', (data: Buffer) => {
        buffer = Buffer.concat([buffer, data]);

        while (buffer.length >= 5) {
          const msgType = String.fromCharCode(buffer[0]);
          const msgLen = buffer.readInt32BE(1);
          if (buffer.length < msgLen + 1) break;

          const msgData = buffer.slice(5, msgLen + 1);
          buffer = buffer.slice(msgLen + 1);

          switch (msgType) {
            case 'R':
              if (msgData.readInt32BE(0) === 0) {
                const queryBuf = Buffer.from(query + '\0', 'utf8');
                const qMsg = Buffer.alloc(5 + queryBuf.length);
                qMsg[0] = 0x51;
                qMsg.writeInt32BE(4 + queryBuf.length, 1);
                queryBuf.copy(qMsg, 5);
                socket.write(qMsg);
              }
              break;
            case 'T': {
              const numFields = msgData.readInt16BE(0);
              let offset = 2;
              columns = [];
              for (let i = 0; i < numFields; i++) {
                const nameEnd = msgData.indexOf(0, offset);
                columns.push(msgData.slice(offset, nameEnd).toString('utf8'));
                offset = nameEnd + 19;
              }
              break;
            }
            case 'D': {
              const numCols = msgData.readInt16BE(0);
              let dOffset = 2;
              const row: any = {};
              for (let i = 0; i < numCols; i++) {
                const len = msgData.readInt32BE(dOffset);
                dOffset += 4;
                if (len === -1) {
                  row[columns[i]] = null;
                } else {
                  row[columns[i]] = msgData.slice(dOffset, dOffset + len).toString('utf8');
                  dOffset += len;
                }
              }
              rows.push(row);
              break;
            }
            case 'C': {
              const tag = msgData.toString('utf8').split('\0')[0];
              const match = tag.match(/\d+$/);
              rowCount = match ? parseInt(match[0], 10) : rows.length;
              break;
            }
            case 'Z':
              socket.end();
              resolve({ columns, rows, rowCount });
              break;
            case 'E': {
              const parts: Record<string, string> = {};
              let off = 0;
              while (off < msgData.length && msgData[off] !== 0) {
                const code = String.fromCharCode(msgData[off]);
                off++;
                const end = msgData.indexOf(0, off);
                parts[code] = msgData.slice(off, end).toString('utf8');
                off = end + 1;
              }
              socket.end();
              reject(new Error(parts['M'] || parts['S'] || 'Unknown error'));
              break;
            }
          }
        }
      });

      socket.connect(port, host, () => {
        const startup = Buffer.alloc(1024);
        let pos = 0;
        pos += 4;
        startup.writeInt32BE(196608, pos);
        pos += 4;
        pos += startup.write('user\0', pos);
        pos += startup.write('postgres\0', pos);
        pos += startup.write('database\0', pos);
        pos += startup.write('postgres\0', pos);
        startup[pos++] = 0;
        startup.writeInt32BE(pos, 0);
        socket.write(startup.slice(0, pos));
      });
    });
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
