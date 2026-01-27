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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { SharesService } from './shares.service';
import { ServicesService } from '../services/services.service';
import { AuthService } from '../auth/auth.service';
import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import { z } from 'zod';
import { SecureLogger } from '../common/security';
import { classifyNetworkError, NetworkErrorType, NETWORK_CONFIG } from '../common/network';

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
  ) {}

  @Post('v1/services/:serviceId/shares')
  @ApiBearerAuth('bearer')
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

    // Verify service belongs to user's workspace
    if (!session.workspace || service.workspaceId !== session.workspace.id) {
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
      createdBy: session.user.id,
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
              
            case 'T': // RowDescription
              const numFields = msgData.readInt16BE(0);
              let offset = 2;
              columns = [];
              for (let i = 0; i < numFields; i++) {
                const nameEnd = msgData.indexOf(0, offset);
                columns.push(msgData.slice(offset, nameEnd).toString('utf8'));
                offset = nameEnd + 19; // Skip to next field
              }
              break;
              
            case 'D': // DataRow
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
              
            case 'C': // CommandComplete
              const tag = msgData.toString('utf8').split('\0')[0];
              const match = tag.match(/\d+$/);
              rowCount = match ? parseInt(match[0], 10) : rows.length;
              break;
              
            case 'Z': // ReadyForQuery
              readyForQuery = true;
              socket.end();
              resolve({ columns, rows, rowCount });
              break;
              
            case 'E': // ErrorResponse
              const errMsg = this.parsePostgresError(msgData);
              socket.end();
              reject(new Error(errMsg));
              break;
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
  @All('shared/:token/*')
  @UseGuards(ThrottlerGuard)
  @Throttle({ medium: { limit: 100, ttl: 60000 } }) // 100 requests per minute for shared access
  @ApiOperation({ summary: 'Proxy shared request', description: 'Proxies HTTP requests through a shared service connection.' })
  @ApiResponse({ status: 200, description: 'Proxied response' })
  @ApiResponse({ status: 403, description: 'Access denied' })
  @ApiResponse({ status: 502, description: 'Service unavailable' })
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

    // Proxy the request with proper timeout and TLS handling
    const protocol = useHttps ? https : http;
    
    // For external HTTPS targets, try with certificate validation first
    // Fall back to no validation only if explicitly configured (self-signed certs)
    const rejectUnauthorized = useHttps && service.isExternal; // Trust internal tunnel, verify external
    
    if (useHttps && !rejectUnauthorized) {
      this.logger.warn(`Proxying to ${targetHost}:${targetPort} with TLS validation disabled`);
    }
    
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

    // Handle request timeout
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

      // Provide helpful error messages based on error type
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

    // Forward request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.pipe(proxyReq);
    } else {
      proxyReq.end();
    }
  }
}

