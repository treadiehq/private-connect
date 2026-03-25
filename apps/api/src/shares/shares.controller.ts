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
  UseGuards,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth, ApiSecurity } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { SharesService } from './shares.service';
import { ServicesService } from '../services/services.service';
import { AuthService } from '../auth/auth.service';
import { TemporaryTunnelService } from '../tunnel/temporary-tunnel.service';
import { TunnelService } from '../tunnel/tunnel.service';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { DebugService } from '../debug/debug.service';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { z } from 'zod';
import { SecureLogger } from '../common/security';
import { classifyNetworkError, NetworkErrorType, NETWORK_CONFIG } from '../common/network';
import type { Readable } from 'stream';

const QuerySchema = z.object({
  query: z.string().min(1).max(10000),
});

const CreateShareSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  expiresIn: z.enum(['1h', '24h', '7d', '30d', 'never']).optional(),
  allowedPaths: z.array(z.string()).optional(),
  allowedMethods: z.array(z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])).optional(),
  rateLimitPerMin: z.number().min(1).max(1000).optional(),
});

@ApiTags('Shares')
@Controller()
export class SharesController {
  private readonly logger = new SecureLogger('SharesController');

  constructor(
    private sharesService: SharesService,
    private servicesService: ServicesService,
    private authService: AuthService,
    @Inject(forwardRef(() => TemporaryTunnelService))
    private tempTunnelService: TemporaryTunnelService,
    @Inject(forwardRef(() => TunnelService))
    private tunnelService: TunnelService,
    @Inject(forwardRef(() => DebugService))
    private debugService: DebugService,
  ) {}

  /**
   * Collect the full request body into a Buffer with a size limit.
   * Rejects with 413 if the body exceeds MAX_REQUEST_BODY_SIZE.
   */
  private async collectRequestBody(stream: Readable): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let totalSize = 0;

    for await (const chunk of stream) {
      totalSize += chunk.length;
      if (totalSize > NETWORK_CONFIG.MAX_REQUEST_BODY_SIZE) {
        throw new HttpException(
          `Request body exceeds maximum size (${NETWORK_CONFIG.MAX_REQUEST_BODY_SIZE} bytes)`,
          HttpStatus.PAYLOAD_TOO_LARGE,
        );
      }
      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  /**
   * Filter incoming request headers for proxying.
   * Preserves multi-value headers by joining them.
   */
  private filterRequestHeaders(
    headers: Record<string, string | string[] | undefined>,
    extraHeaders?: Record<string, string>,
  ): Record<string, string> {
    const filtered: Record<string, string> = {};
    const skip = new Set(['host', 'connection', 'keep-alive']);

    for (const [key, value] of Object.entries(headers)) {
      if (skip.has(key.toLowerCase()) || value === undefined) continue;
      filtered[key] = Array.isArray(value) ? value.join(', ') : value;
    }

    if (extraHeaders) {
      Object.assign(filtered, extraHeaders);
    }

    return filtered;
  }

  @Post('v1/services/:serviceId/shares')
  @UseGuards(CombinedAuthGuard)
  @ApiSecurity('api-key')
  @ApiOperation({ summary: 'Create share', description: 'Creates a shareable link for a service.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: { type: 'string', example: 'contractor-access' },
        description: { type: 'string' },
        expiresIn: { type: 'string', enum: ['1h', '24h', '7d', '30d', 'never'] },
        allowedPaths: { type: 'array', items: { type: 'string' } },
        allowedMethods: { type: 'array', items: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] } },
        rateLimitPerMin: { type: 'number', minimum: 1, maximum: 1000 },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Share created' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Service not found' })
  async createShare(
    @Param('serviceId') serviceId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const parsed = CreateShareSchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException(parsed.error.message, HttpStatus.BAD_REQUEST);
    }

    // Get workspace from ApiKeyGuard
    const workspace = req.workspace;
    if (!workspace) {
      throw new HttpException('Unauthorized', HttpStatus.UNAUTHORIZED);
    }

    // Verify service exists and belongs to user's workspace
    const service = await this.servicesService.findById(serviceId);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }

    // Verify service belongs to user's workspace
    if (service.workspaceId !== workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
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
      // Track which API key created this share for audit purposes
      createdBy: req.apiKeyId ? `apikey:${req.apiKeyId}` : undefined,
    });

    // Use LINK_BASE_URL env var, or fall back to relative path
    const linkBaseUrl = process.env.LINK_BASE_URL || '';
    
    return {
      success: true,
      share: {
        id: share.id,
        token: share.token,
        name: share.name,
        expiresAt: share.expiresAt,
        shareUrl: `${linkBaseUrl}/shared/${share.token}`,
      },
    };
  }

  @Get('v1/services/:serviceId/shares')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'List shares', description: 'Returns all shares for a service.' })
  @ApiResponse({ status: 200, description: 'List of shares' })
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

    // Verify service exists and belongs to user's workspace
    const service = await this.servicesService.findById(serviceId);
    if (!service) {
      throw new HttpException('Service not found', HttpStatus.NOT_FOUND);
    }
    if (!session.workspace || service.workspaceId !== session.workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
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

  @Delete('v1/shares/:shareId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Revoke share', description: 'Revokes a share, making it no longer usable.' })
  @ApiResponse({ status: 200, description: 'Share revoked' })
  @ApiResponse({ status: 404, description: 'Share not found' })
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

    // Verify share exists and belongs to user's workspace
    const share = await this.sharesService.getShareById(shareId);
    if (!share) {
      throw new HttpException('Share not found', HttpStatus.NOT_FOUND);
    }
    if (!session.workspace || share.service.workspaceId !== session.workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    await this.sharesService.revokeShare(shareId);
    return { success: true };
  }

  @Get('v1/shares/:shareId/logs')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get access logs', description: 'Returns access logs for a share.' })
  @ApiResponse({ status: 200, description: 'Access logs' })
  @ApiResponse({ status: 404, description: 'Share not found' })
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

    // Verify share exists and belongs to user's workspace
    const share = await this.sharesService.getShareById(shareId);
    if (!share) {
      throw new HttpException('Share not found', HttpStatus.NOT_FOUND);
    }
    if (!session.workspace || share.service.workspaceId !== session.workspace.id) {
      throw new HttpException('Forbidden', HttpStatus.FORBIDDEN);
    }

    const logs = await this.sharesService.getAccessLogs(shareId);
    return { logs };
  }

  /**
   * Redirect /share/:token to the web app
   * Legacy route for backwards compatibility
   */
  @Get('share/:token')
  @ApiOperation({ summary: 'Redirect to share page', description: 'Redirects to the web app share page.' })
  async redirectToSharePage(@Param('token') token: string, @Res() res: Response) {
    const webAppUrl = process.env.WEB_URL || 'https://app.privateconnect.co';
    res.redirect(302, `${webAppUrl}/share/${token}`);
  }

  @Get('v1/shared/:token/info')
  @ApiOperation({ summary: 'Get share info', description: 'Returns public info about a share. No authentication required.' })
  @ApiResponse({ status: 200, description: 'Share info' })
  @ApiResponse({ status: 404, description: 'Share not found or expired' })
  async getShareInfo(@Param('token') token: string) {
    const validation = await this.sharesService.validateShare(token);
    
    if (!validation.valid || !validation.share) {
      throw new HttpException(
        validation.reason || 'Share not found',
        HttpStatus.NOT_FOUND,
      );
    }

    const share = validation.share;
    return {
      name: share.name,
      description: share.description,
      expiresAt: share.expiresAt,
      workspaceName: share.service.workspace?.name || 'Unknown',
      service: {
        name: share.service.name,
        targetHost: share.service.targetHost,
        targetPort: share.service.targetPort,
        protocol: share.service.protocol,
      },
    };
  }

  @Post('api/shared/:token/query')
  @UseGuards(ThrottlerGuard)
  @Throttle({ short: { limit: 30, ttl: 60000 } }) // 30 queries per minute
  @ApiOperation({ summary: 'Execute query', description: 'Executes a SQL query through the shared database connection.' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['query'],
      properties: {
        query: { type: 'string', example: 'SELECT * FROM users LIMIT 10' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Query result' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  async executeQuery(
    @Param('token') token: string,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    // Validate query body
    const parsed = QuerySchema.safeParse(body);
    if (!parsed.success) {
      throw new HttpException('Invalid query', HttpStatus.BAD_REQUEST);
    }

    // Validate share
    const validation = await this.sharesService.validateShare(token);
    if (!validation.valid || !validation.share) {
      throw new HttpException(
        validation.reason || 'Access denied',
        HttpStatus.FORBIDDEN,
      );
    }

    const share = validation.share;
    const service = share.service;

    // Only allow database ports
    const dbPorts = [5432, 3306, 27017, 6379];
    if (!dbPorts.includes(service.targetPort)) {
      throw new HttpException(
        'Query execution is only supported for database services',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!service.tunnelPort && !service.isExternal) {
      throw new HttpException('Service not available', HttpStatus.SERVICE_UNAVAILABLE);
    }

    const startTime = Date.now();
    const targetHost = service.isExternal ? service.targetHost : '127.0.0.1';
    const targetPort = service.isExternal ? service.targetPort : service.tunnelPort!;

    try {
      // For PostgreSQL, we use the simple query protocol
      if (service.targetPort === 5432) {
        const result = await this.executePostgresQuery(
          targetHost,
          targetPort,
          parsed.data.query,
        );

        // Log the access
        this.sharesService.logAccess(share.id, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          path: '/query',
          method: 'POST',
          statusCode: 200,
          latencyMs: Date.now() - startTime,
        });

        return result;
      }

      // For other databases, return a message
      throw new HttpException(
        `Query execution for port ${service.targetPort} is not yet implemented`,
        HttpStatus.NOT_IMPLEMENTED,
      );
    } catch (error: any) {
      this.logger.error(`Query execution failed: ${error.message}`);
      
      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path: '/query',
        method: 'POST',
        statusCode: 500,
        latencyMs: Date.now() - startTime,
      });

      if (error instanceof HttpException) throw error;
      throw new HttpException(error.message, HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  /**
   * Execute a PostgreSQL query using the wire protocol
   */
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
      let readyForQuery = false;

      socket.setTimeout(10000);

      socket.on('timeout', () => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      });

      socket.on('error', (err) => {
        reject(err);
      });

      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        
        while (buffer.length >= 5) {
          const msgType = String.fromCharCode(buffer[0]);
          const msgLen = buffer.readInt32BE(1);
          
          if (buffer.length < msgLen + 1) break;
          
          const msgData = buffer.slice(5, msgLen + 1);
          buffer = buffer.slice(msgLen + 1);
          
          switch (msgType) {
            case 'R': // Authentication
              if (msgData.readInt32BE(0) === 0) {
                // Auth OK, send query
                const queryBuf = Buffer.from(query + '\0', 'utf8');
                const qMsg = Buffer.alloc(5 + queryBuf.length);
                qMsg[0] = 0x51; // 'Q'
                qMsg.writeInt32BE(4 + queryBuf.length, 1);
                queryBuf.copy(qMsg, 5);
                socket.write(qMsg);
              }
              break;
              
            case 'T': { // RowDescription
              const numFields = msgData.readInt16BE(0);
              let offset = 2;
              columns = [];
              for (let i = 0; i < numFields; i++) {
                const nameEnd = msgData.indexOf(0, offset);
                columns.push(msgData.slice(offset, nameEnd).toString('utf8'));
                offset = nameEnd + 19; // Skip to next field
              }
              break;
            }
              
            case 'D': { // DataRow
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
              
            case 'C': { // CommandComplete
              const tag = msgData.toString('utf8').split('\0')[0];
              const match = tag.match(/\d+$/);
              rowCount = match ? parseInt(match[0], 10) : rows.length;
              break;
            }
              
            case 'Z': // ReadyForQuery
              readyForQuery = true;
              socket.end();
              resolve({ columns, rows, rowCount });
              break;
              
            case 'E': { // ErrorResponse
              const errMsg = this.parsePostgresError(msgData);
              socket.end();
              reject(new Error(errMsg));
              break;
            }
          }
        }
      });

      socket.connect(port, host, () => {
        // Send startup message (no auth, trust)
        const startup = Buffer.alloc(1024);
        let pos = 0;
        pos += 4; // Length placeholder
        startup.writeInt32BE(196608, pos); // Protocol version 3.0
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

  private parsePostgresError(data: Buffer): string {
    const parts: Record<string, string> = {};
    let offset = 0;
    while (offset < data.length && data[offset] !== 0) {
      const code = String.fromCharCode(data[offset]);
      offset++;
      const end = data.indexOf(0, offset);
      parts[code] = data.slice(offset, end).toString('utf8');
      offset = end + 1;
    }
    return parts['M'] || parts['S'] || 'Unknown error';
  }

  @All('shared/:token')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 
    short: { limit: 100, ttl: 1000 },   // 100 req/second for asset loading
    medium: { limit: 5000, ttl: 60000 }, // 5000 req/minute
    long: { limit: 50000, ttl: 3600000 } // 50000 req/hour - web apps load many assets
  })
  @ApiOperation({ summary: 'Proxy shared request (root)', description: 'Proxies HTTP requests through a shared service connection.' })
  @ApiResponse({ status: 200, description: 'Proxied response' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 502, description: 'Service unavailable' })
  async proxySharedRequestRoot(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxySharedRequest(token, req, res);
  }

  @All('shared/:token/*')
  @UseGuards(ThrottlerGuard)
  @Throttle({ 
    short: { limit: 100, ttl: 1000 },   // 100 req/second for asset loading
    medium: { limit: 5000, ttl: 60000 }, // 5000 req/minute
    long: { limit: 50000, ttl: 3600000 } // 50000 req/hour - web apps load many assets
  })
  @ApiOperation({ summary: 'Proxy shared request (path)', description: 'Proxies HTTP requests through a shared service connection.' })
  @ApiResponse({ status: 200, description: 'Proxied response' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 502, description: 'Service unavailable' })
  async proxySharedRequestPath(
    @Param('token') token: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxySharedRequest(token, req, res);
  }

  private async proxySharedRequest(
    token: string,
    req: Request,
    res: Response,
  ) {
    const startTime = Date.now();

    // Validate share
    const path = req.path.replace(`/shared/${token}`, '') || '/';
    const validation = await this.sharesService.validateShare(token, path, req.method);

    if (!validation.valid || !validation.share) {
      // Fallback 1: Check if this is a temporary tunnel subdomain
      const tempTunnel = this.tempTunnelService.getTunnelBySubdomain(token);
      if (tempTunnel) {
        return this.proxyTemporaryTunnel(tempTunnel, path, req, res);
      }

      // Fallback 2: Check if this is a public subdomain (custom URL)
      const publicService = await this.servicesService.findBySubdomain(token);
      if (publicService && publicService.isPublic && publicService.agentId) {
        return this.proxyPublicSubdomain(publicService, path, req, res, startTime);
      }
      
      res.status(403).json({ error: validation.reason || 'Access denied' });
      return;
    }

    const share = validation.share;
    const service = share.service;

    // For non-external services, use WebSocket forwarding through the agent
    if (!service.isExternal && service.agentId) {
      return this.proxyViaWebSocket(share, service, path, req, res, startTime);
    }

    // For external services, proxy directly
    if (!service.isExternal && !service.tunnelPort) {
      res.status(503).json({ error: 'Service not available (no tunnel)' });
      return;
    }

    const targetHost = service.targetHost;
    const targetPort = service.targetPort;
    const useHttps = service.protocol === 'https' || service.targetPort === 443;

    const protocol = useHttps ? https : http;
    const rejectUnauthorized = useHttps;
    
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
        timeout: NETWORK_CONFIG.PROXY_REQUEST_TIMEOUT_MS,
        rejectUnauthorized,
      },
      (proxyRes) => {
        const latencyMs = Date.now() - startTime;

        this.sharesService.logAccess(share.id, {
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          path,
          method: req.method,
          statusCode: proxyRes.statusCode,
          latencyMs,
        });

        res.status(proxyRes.statusCode || 200);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (value) res.setHeader(key, value);
        });
        proxyRes.pipe(res);
      },
    );

    proxyReq.on('timeout', () => {
      proxyReq.destroy();
      const latencyMs = Date.now() - startTime;
      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path,
        method: req.method,
        statusCode: 504,
        latencyMs,
      });
      
      res.status(504).json({ 
        error: 'Gateway timeout', 
        message: 'The service did not respond in time',
      });
    });

    proxyReq.on('error', (error) => {
      const err = error as Error & { code?: string };
      const errorType = classifyNetworkError(err);
      const latencyMs = Date.now() - startTime;
      
      this.logger.error(`Share proxy error for ${share.name}: ${err.message} (type: ${errorType})`);
      
      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path,
        method: req.method,
        statusCode: 502,
        latencyMs,
      });

      if (errorType === NetworkErrorType.TLS_ERROR) {
        res.status(502).json({ 
          error: 'TLS error', 
          message: 'Certificate validation failed when connecting to service',
          hint: 'The service may have an invalid or self-signed certificate',
        });
      } else if (errorType === NetworkErrorType.BLOCKED) {
        res.status(502).json({ 
          error: 'Connection blocked', 
          message: 'The connection to the service was blocked',
          hint: 'Check firewall rules and network configuration',
        });
      } else {
        res.status(502).json({ 
          error: 'Failed to connect to service', 
          message: err.message,
        });
      }
    });

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  }

  /**
   * Proxy a share request through the agent's WebSocket connection.
   * This is more reliable than the TCP tunnel port approach because
   * it doesn't depend on a TCP listener being active on the hub.
   */
  private async proxyViaWebSocket(
    share: any,
    service: any,
    path: string,
    req: Request,
    res: Response,
    startTime: number,
  ) {
    if (!this.tunnelService.isAgentConnected(service.agentId)) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'The agent exposing this service is currently offline',
      });
      return;
    }

    // Check for active debug session on this service
    const debugSessionId = this.debugService.getSessionForService(service.id);
    const connectionId = debugSessionId
      ? `share-${share.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : '';

    try {
      const requestBody = await this.collectRequestBody(req);

      const requestHeaders = this.filterRequestHeaders(req.headers, {
        'x-forwarded-for': req.ip || '',
        'x-shared-access': 'true',
        'x-share-name': share.name,
      });

      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      const requestPath = (path || '/') + queryString;

      if (debugSessionId) {
        const headerStr = Object.entries(requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n');
        const reqPayload = `${req.method} ${requestPath} HTTP/1.1\r\n${headerStr}\r\n\r\n`;
        const debugBuf = Buffer.concat([Buffer.from(reqPayload), requestBody.slice(0, 10000)]);
        this.debugService.capturePacket({
          sessionId: debugSessionId,
          connectionId,
          direction: 'inbound',
          payload: debugBuf,
          timestamp: new Date(),
        }).catch(err => this.logger.warn(`Failed to capture request: ${err.message}`));
      }

      const response = await this.tunnelService.forwardHttpRequest(
        service.agentId,
        service.id,
        {
          method: req.method,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody,
        },
      );

      if (debugSessionId) {
        const resHeader = `HTTP/1.1 ${response.status}\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`;
        const debugBuf = Buffer.concat([Buffer.from(resHeader), response.body.slice(0, 10000)]);
        this.debugService.capturePacket({
          sessionId: debugSessionId,
          connectionId,
          direction: 'outbound',
          payload: debugBuf,
          timestamp: new Date(),
        }).catch(err => this.logger.warn(`Failed to capture response: ${err.message}`));
      }

      const latencyMs = Date.now() - startTime;

      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path,
        method: req.method,
        statusCode: response.status,
        latencyMs,
      });

      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

      // Inject branding banner into HTML responses
      const contentType = response.headers['content-type'] || '';

      if (contentType.includes('text/html')) {
        let htmlBody = response.body.toString('utf-8');
        const banner = `
<div id="pc-banner" style="position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:999999;display:flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(17,17,17,0.95);backdrop-filter:blur(8px);border-radius:999px;border:1px solid rgba(255,255,255,0.1);font-family:-apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 4px 24px rgba(0,0,0,0.4);">
  <span style="width:6px;height:6px;border-radius:50%;background:#34d399;animation:pc-pulse 2s infinite;"></span>
  <span style="font-size:12px;color:#d1d5db;">${share.name}</span>
  <span style="width:1px;height:12px;background:rgba(255,255,255,0.2);"></span>
  <a href="https://privateconnect.co" target="_blank" style="font-size:12px;color:#60a5fa;text-decoration:none;">Private Connect</a>
  <button onclick="document.getElementById('pc-banner').remove()" style="background:none;border:none;padding:0;margin-left:4px;cursor:pointer;color:#6b7280;font-size:14px;">&times;</button>
</div>
<style>@keyframes pc-pulse{0%,100%{opacity:1}50%{opacity:0.5}}</style>
`;
        if (htmlBody.includes('</body>')) {
          htmlBody = htmlBody.replace('</body>', banner + '</body>');
        } else {
          htmlBody += banner;
        }
        res.status(response.status).send(htmlBody);
      } else {
        res.status(response.status).send(response.body);
      }
    } catch (err: any) {
      const latencyMs = Date.now() - startTime;
      this.logger.error(`WebSocket proxy error for ${share.name}: ${err.message}`);

      this.sharesService.logAccess(share.id, {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        path,
        method: req.method,
        statusCode: 502,
        latencyMs,
      });

      if (err.message === 'Agent not connected') {
        res.status(503).json({
          error: 'Service unavailable',
          message: 'The agent exposing this service is currently offline',
        });
      } else if (err.message === 'Request timeout') {
        res.status(504).json({
          error: 'Gateway timeout',
          message: 'The service did not respond in time',
        });
      } else {
        res.status(502).json({
          error: 'Failed to connect to service',
          message: err.message,
        });
      }
    }
  }

  /**
   * Proxy a request for a service with a public subdomain (custom URL).
   * Uses the same WebSocket forwarding as share proxying.
   */
  private async proxyPublicSubdomain(
    service: any,
    path: string,
    req: Request,
    res: Response,
    startTime: number,
  ) {
    if (!this.tunnelService.isAgentConnected(service.agentId)) {
      res.status(503).json({
        error: 'Service unavailable',
        message: 'The agent exposing this service is currently offline',
      });
      return;
    }

    const debugSessionId = this.debugService.getSessionForService(service.id);
    const connectionId = debugSessionId
      ? `public-${service.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
      : '';

    try {
      const requestBody = await this.collectRequestBody(req);

      const requestHeaders = this.filterRequestHeaders(req.headers, {
        'x-forwarded-for': req.ip || '',
      });

      const queryString = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
      const requestPath = (path || '/') + queryString;

      if (debugSessionId) {
        const headerStr = Object.entries(requestHeaders).map(([k, v]) => `${k}: ${v}`).join('\r\n');
        const reqPayload = `${req.method} ${requestPath} HTTP/1.1\r\n${headerStr}\r\n\r\n`;
        const debugBuf = Buffer.concat([Buffer.from(reqPayload), requestBody.slice(0, 10000)]);
        this.debugService.capturePacket({
          sessionId: debugSessionId,
          connectionId,
          direction: 'inbound',
          payload: debugBuf,
          timestamp: new Date(),
        }).catch(err => this.logger.warn(`Failed to capture request: ${err.message}`));
      }

      const response = await this.tunnelService.forwardHttpRequest(
        service.agentId,
        service.id,
        {
          method: req.method,
          path: requestPath,
          headers: requestHeaders,
          body: requestBody,
        },
      );

      if (debugSessionId) {
        const resHeader = `HTTP/1.1 ${response.status}\r\n${Object.entries(response.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n')}\r\n\r\n`;
        const debugBuf = Buffer.concat([Buffer.from(resHeader), response.body.slice(0, 10000)]);
        this.debugService.capturePacket({
          sessionId: debugSessionId,
          connectionId,
          direction: 'outbound',
          payload: debugBuf,
          timestamp: new Date(),
        }).catch(err => this.logger.warn(`Failed to capture response: ${err.message}`));
      }

      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }

      const contentType = response.headers['content-type'] || '';
      if (contentType.includes('text/html')) {
        res.status(response.status).send(response.body.toString('utf-8'));
      } else {
        res.status(response.status).send(response.body);
      }
    } catch (err: any) {
      this.logger.error(`Public subdomain proxy error for ${service.publicSubdomain}: ${err.message}`);
      if (err.message === 'Agent not connected') {
        res.status(503).json({ error: 'Service unavailable', message: 'The agent exposing this service is currently offline' });
      } else if (err.message === 'Request timeout') {
        res.status(504).json({ error: 'Gateway timeout', message: 'The service did not respond in time' });
      } else {
        res.status(502).json({ error: 'Failed to connect to service', message: err.message });
      }
    }
  }

  /**
   * Proxy request through a temporary tunnel (fallback for subdomain shares)
   */
  private async proxyTemporaryTunnel(
    tunnel: any,
    path: string,
    req: Request,
    res: Response,
  ) {
    if (!tunnel.socket?.connected) {
      return res.status(503).json({ 
        error: 'Tunnel disconnected',
        message: 'The tunnel client is not connected',
      });
    }

    try {
      const requestBody = await this.collectRequestBody(req);
      const requestHeaders = this.filterRequestHeaders(req.headers);
      const requestPath = path + (req.url.includes('?') ? '?' + req.url.split('?')[1] : '');

      const response = await this.tempTunnelService.forwardRequest(tunnel.tunnelId, {
        method: req.method,
        path: requestPath,
        headers: requestHeaders,
        body: requestBody,
      });

      // Set response headers
      for (const [key, value] of Object.entries(response.headers)) {
        if (value && !['transfer-encoding', 'connection', 'content-length'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      
      // Inject widget into HTML responses
      const contentType = response.headers['content-type'] || '';
      let responseBody = response.body;
      
      if (contentType.includes('text/html') && typeof responseBody === 'string') {
        const debugSessionId = this.tempTunnelService.getDebugSessionId(tunnel.tunnelId);
        const widget = this.generateTunnelWidget(tunnel.subdomain, debugSessionId);
        responseBody = this.injectWidgetIntoHtml(responseBody, widget);
      }
      
      res.status(response.status).send(responseBody);
    } catch (err: any) {
      this.logger.error(`Temporary tunnel proxy error: ${err.message}`);
      res.status(502).json({ 
        error: 'Bad gateway',
        message: 'Failed to forward request through tunnel',
      });
    }
  }

  /**
   * Generate the Private Connect floating widget HTML
   * Injected into HTML responses for temporary tunnels
   */
  private generateTunnelWidget(subdomain: string, debugSessionId?: string): string {
    const inspectorUrl = debugSessionId 
      ? `https://app.privateconnect.co/debug/${debugSessionId}` 
      : 'https://privateconnect.co';
    
    return `
<!-- Private Connect Tunnel Widget -->
<div id="pc-tunnel-widget" style="
  position: fixed;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 9999px;
  border: 1px solid rgba(107, 114, 128, 0.3);
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  font-size: 12px;
">
  <div style="display: flex; align-items: center; gap: 8px;">
    <div style="width: 8px; height: 8px; border-radius: 50%; background: #6ee7b7; animation: pc-pulse 2s infinite;"></div>
    <span style="color: #d1d5db;">${subdomain}</span>
  </div>
  <div style="width: 1px; height: 16px; background: rgba(107, 114, 128, 0.3);"></div>
  <a href="${inspectorUrl}" target="_blank" style="color: #93c5fd; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#bfdbfe'" onmouseout="this.style.color='#93c5fd'">
    Inspector
  </a>
  <div style="width: 1px; height: 16px; background: rgba(107, 114, 128, 0.3);"></div>
  <a href="https://privateconnect.co" target="_blank" style="color: #6b7280; text-decoration: none; transition: color 0.15s;" onmouseover="this.style.color='#9ca3af'" onmouseout="this.style.color='#6b7280'">
    Private Connect
  </a>
  <button onclick="this.parentElement.remove()" style="margin-left: 4px; background: none; border: none; cursor: pointer; color: #6b7280; padding: 0; display: flex; transition: color 0.15s;" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#6b7280'">
    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
      <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  </button>
</div>
<style>
  @keyframes pc-pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
</style>
<!-- End Private Connect Tunnel Widget -->
`;
  }

  /**
   * Inject widget into HTML response body
   */
  private injectWidgetIntoHtml(body: string, widget: string): string {
    // Try to inject before </body>
    if (body.includes('</body>')) {
      return body.replace('</body>', widget + '</body>');
    }
    // Try to inject before </html>
    if (body.includes('</html>')) {
      return body.replace('</html>', widget + '</html>');
    }
    // Fallback: append to end
    return body + widget;
  }
}

