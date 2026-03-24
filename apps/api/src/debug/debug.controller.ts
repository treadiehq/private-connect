import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  Req,
  UseGuards,
  NotFoundException,
  BadRequestException,
  Inject,
  forwardRef,
  Optional,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { DebugService } from './debug.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuthGuard } from '../auth/auth.guard';
import { CombinedAuthGuard } from '../auth/combined-auth.guard';
import { AIService } from '../ai/ai.service';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';
import { validateUrlSafeForFetch, type ValidatedUrl } from '../common/security';

const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-api-key',
  'proxy-authorization',
  'www-authenticate',
  'x-csrf-token',
  'x-xsrf-token',
]);

interface CreateSessionDto {
  serviceId?: string;
  agentId?: string;
  name?: string;
  aiEnabled?: boolean;
  aiProvider?: string;
  aiModel?: string;
  expiresIn?: number;
}

@ApiTags('Debug')
@Controller('v1/debug')
export class DebugController {
  constructor(
    private debugService: DebugService,
    private prisma: PrismaService,
    @Optional() @Inject(forwardRef(() => AIService))
    private aiService?: AIService,
  ) {}

  /**
   * Create a new debug session
   */
  @Post('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Create debug session',
    description: 'Creates a new debug session for the current workspace.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        agentId: { type: 'string' },
        name: { type: 'string' },
        aiEnabled: { type: 'boolean' },
        aiProvider: { type: 'string' },
        aiModel: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 400, description: 'Invalid request or missing workspace' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSession(
    @Req() req: any,
    @Body() body: CreateSessionDto,
  ) {
    const workspaceId = req.workspaceId || req.workspace?.id;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const session = await this.debugService.createSession({
      workspaceId,
      ...body,
    });

    return {
      id: session.id,
      token: session.token,
      url: `${process.env.PUBLIC_URL || 'https://app.privateconnect.co'}/debug/${session.token}`,
      status: session.status,
      aiEnabled: session.aiEnabled,
      createdAt: session.createdAt,
    };
  }

  /**
   * List debug sessions for workspace
   */
  @Get('sessions')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List debug sessions',
    description: 'Returns debug sessions for the current workspace.',
  })
  @ApiQuery({ name: 'includeEnded', required: false, description: 'Include ended sessions when true', type: String })
  @ApiResponse({ status: 200, description: 'Session list' })
  @ApiResponse({ status: 400, description: 'Missing workspace context' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async listSessions(
    @Req() req: any,
    @Query('includeEnded') includeEnded?: string,
  ) {
    const workspaceId = req.workspaceId || req.workspace?.id;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const sessions = await this.debugService.listSessions(
      workspaceId,
      includeEnded === 'true',
    );

    return { sessions };
  }

  /**
   * Get session by ID (authenticated)
   */
  @Get('sessions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get debug session',
    description: 'Returns a debug session by its ID.',
  })
  @ApiParam({ name: 'id', description: 'Debug session ID' })
  @ApiResponse({ status: 200, description: 'Session details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async getSession(@Param('id') id: string) {
    const session = await this.debugService.getSession(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    return session;
  }

  /**
   * Get session by token (public - for debug viewer)
   */
  @Get('public/:token')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'Get session by token',
    description: 'Returns limited session info for the public debug viewer using the share token.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiResponse({ status: 200, description: 'Limited session info' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getSessionByToken(@Param('token') token: string) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    // Return limited info for public access
    return {
      id: session.id,
      status: session.status,
      aiEnabled: session.aiEnabled,
      packetCount: session.packetCount,
      createdAt: session.createdAt,
    };
  }

  /**
   * End a debug session
   */
  @Delete('sessions/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'End debug session',
    description: 'Ends an active debug session by ID.',
  })
  @ApiParam({ name: 'id', description: 'Debug session ID' })
  @ApiResponse({ status: 200, description: 'Session ended' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async endSession(@Param('id') id: string) {
    await this.debugService.endSession(id);
    return { success: true };
  }

  /**
   * Toggle AI on a debug session
   */
  @Patch('sessions/:id/ai')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Toggle session AI',
    description: 'Enables or disables AI for a debug session.',
  })
  @ApiParam({ name: 'id', description: 'Debug session ID' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['enabled'],
      properties: { enabled: { type: 'boolean' } },
    },
  })
  @ApiResponse({ status: 200, description: 'AI state updated' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  async toggleAI(
    @Param('id') id: string,
    @Body() body: { enabled: boolean },
  ) {
    const session = await this.debugService.getSession(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await this.prisma.debugSession.update({
      where: { id },
      data: { aiEnabled: body.enabled },
    });

    return { success: true, aiEnabled: body.enabled };
  }

  /**
   * Toggle AI on a debug session (public, token-based)
   */
  @Patch('public/:token/ai/enable')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'Toggle session AI by token',
    description: 'Enables or disables AI for a session using the public debug token.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['enabled'],
      properties: { enabled: { type: 'boolean' } },
    },
  })
  @ApiResponse({ status: 200, description: 'AI state updated' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async toggleAIPublic(
    @Param('token') token: string,
    @Body() body: { enabled: boolean },
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    await this.prisma.withWorkspace(session.workspaceId, () =>
      this.prisma.debugSession.update({
        where: { id: session.id },
        data: { aiEnabled: body.enabled },
      })
    );

    return { success: true, aiEnabled: body.enabled };
  }

  /**
   * End a debug session by token (public - requires session token to prevent unauthorized termination)
   */
  @Delete('public/:token')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'End session by token',
    description: 'Ends a debug session using the public share token.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiResponse({ status: 200, description: 'Session ended' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async endSessionPublic(@Param('token') token: string) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }
    await this.prisma.withWorkspace(session.workspaceId, () =>
      this.debugService.endSession(session.id)
    );
    return { success: true, message: 'Session ended' };
  }

  /**
   * Get packets for a session (authenticated)
   */
  @Get('sessions/:id/packets')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'List session packets',
    description: 'Returns captured packets for a debug session with optional pagination.',
  })
  @ApiParam({ name: 'id', description: 'Debug session ID' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max packets to return', type: String })
  @ApiQuery({ name: 'before', required: false, description: 'Cursor for older packets', type: String })
  @ApiResponse({ status: 200, description: 'Packet list' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getPackets(
    @Param('id') id: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const packets = await this.debugService.getPackets(
      id,
      limit ? parseInt(limit) : 100,
      before,
    );

    return { packets };
  }

  /**
   * Get packets by token (public - for debug viewer)
   */
  @Get('public/:token/packets')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'List packets by token',
    description: 'Returns captured packets for the session identified by the public token.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiQuery({ name: 'limit', required: false, description: 'Max packets to return', type: String })
  @ApiQuery({ name: 'before', required: false, description: 'Cursor for older packets', type: String })
  @ApiResponse({ status: 200, description: 'Packet list' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async getPacketsByToken(
    @Param('token') token: string,
    @Query('limit') limit?: string,
    @Query('before') before?: string,
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    const packets = await this.debugService.getPackets(
      session.id,
      limit ? parseInt(limit) : 100,
      before,
      true,
    );

    return { packets };
  }

  /**
   * Get a single packet with full payload
   */
  @Get('packets/:id')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Get packet',
    description: 'Returns a single captured packet including its payload.',
  })
  @ApiParam({ name: 'id', description: 'Packet ID' })
  @ApiResponse({ status: 200, description: 'Packet details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Packet not found' })
  async getPacket(@Req() req: any, @Param('id') id: string) {
    const workspaceId = req.workspaceId || req.workspace?.id;
    const packet = await this.debugService.getPacket(id);
    if (!packet) {
      throw new NotFoundException('Packet not found');
    }

    const session = await this.debugService.getSession(packet.sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      throw new NotFoundException('Packet not found');
    }

    return packet;
  }

  /**
   * Replay a captured request
   */
  @Post('packets/:id/replay')
  @UseGuards(AuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Replay packet',
    description: 'Replays an outbound HTTP packet, optionally against a different target URL.',
  })
  @ApiParam({ name: 'id', description: 'Packet ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { targetUrl: { type: 'string', description: 'Optional override URL for the replay request' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Replay result' })
  @ApiResponse({ status: 400, description: 'Invalid replay request or unsupported packet' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Packet not found' })
  async replayPacket(
    @Req() req: any,
    @Param('id') id: string,
    @Body() body: { targetUrl?: string },
  ) {
    const workspaceId = req.workspaceId || req.workspace?.id;
    const packet = await this.debugService.getPacket(id);
    if (!packet) {
      throw new NotFoundException('Packet not found');
    }

    const session = await this.debugService.getSession(packet.sessionId);
    if (!session || session.workspaceId !== workspaceId) {
      throw new NotFoundException('Packet not found');
    }

    if (packet.direction !== 'outbound') {
      throw new BadRequestException('Can only replay outbound (request) packets');
    }

    if (packet.protocol !== 'http' || !packet.parsed) {
      throw new BadRequestException(`Replay not supported for ${packet.protocol} protocol`);
    }

    const parsed = JSON.parse(packet.parsed);
    return this.executeReplay(parsed, packet.payload, body.targetUrl);
  }

  /**
   * Replay a packet by token (public access)
   */
  @Post('public/:token/packets/:packetId/replay')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'Replay packet by token',
    description: 'Replays an outbound HTTP packet for the session token, optionally against a different URL.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiParam({ name: 'packetId', description: 'Packet ID' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: { targetUrl: { type: 'string', description: 'Optional override URL for the replay request' } },
    },
  })
  @ApiResponse({ status: 200, description: 'Replay result' })
  @ApiResponse({ status: 400, description: 'Invalid replay request or unsupported packet' })
  @ApiResponse({ status: 404, description: 'Session or packet not found' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async replayPacketByToken(
    @Param('token') token: string,
    @Param('packetId') packetId: string,
    @Body() body: { targetUrl?: string },
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    const packet = await this.debugService.getPacketForSession(packetId, session.id);
    if (!packet) {
      throw new NotFoundException('Packet not found');
    }

    if (packet.direction !== 'outbound') {
      throw new BadRequestException('Can only replay outbound (request) packets');
    }

    if (packet.protocol !== 'http') {
      throw new BadRequestException(`Replay not supported for ${packet.protocol} protocol`);
    }

    const parsed = JSON.parse(packet.parsed || '{}');
    return this.executeReplay(parsed, packet.payload, body.targetUrl);
  }

  /**
   * Create session via API key (for CLI)
   */
  @Post('sessions/cli')
  @UseGuards(CombinedAuthGuard)
  @ApiOperation({
    summary: 'Create debug session (CLI)',
    description: 'Creates a debug session using session or API key authentication for CLI clients.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        serviceId: { type: 'string' },
        agentId: { type: 'string' },
        name: { type: 'string' },
        aiEnabled: { type: 'boolean' },
        aiProvider: { type: 'string' },
        aiModel: { type: 'string' },
        expiresIn: { type: 'number' },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Session created' })
  @ApiResponse({ status: 400, description: 'Invalid request or missing workspace' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createSessionCli(
    @Req() req: any,
    @Body() body: CreateSessionDto,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const session = await this.debugService.createSession({
      workspaceId,
      ...body,
    });

    return {
      id: session.id,
      token: session.token,
      url: `${process.env.PUBLIC_URL || 'https://app.privateconnect.co'}/debug/${session.token}`,
      status: session.status,
      aiEnabled: session.aiEnabled,
      createdAt: session.createdAt,
    };
  }

  /**
   * Export session as shareable recap (public)
   */
  @Get('public/:token/export')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  @ApiOperation({
    summary: 'Export debug session',
    description: 'Exports session summary and packets as JSON or markdown.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiQuery({ name: 'format', required: false, description: 'Export format: json (default) or markdown', type: String })
  @ApiResponse({ status: 200, description: 'Export payload' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async exportSession(
    @Param('token') token: string,
    @Query('format') format: string = 'json',
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    const packets = await this.debugService.getPackets(session.id, 500, undefined, true);

    // Build export data
    const exportData = {
      session: {
        id: session.id,
        token: session.token,
        status: session.status,
        aiEnabled: session.aiEnabled,
        packetCount: session.packetCount,
        createdAt: session.createdAt,
      },
      summary: this.generateSummary(packets),
      packets: packets.map(p => ({
        sequence: p.sequence,
        direction: p.direction,
        protocol: p.protocol,
        payloadSize: p.payloadSize,
        parsed: p.parsed ? JSON.parse(p.parsed) : null,
        capturedAt: p.capturedAt,
      })),
      exportedAt: new Date().toISOString(),
    };

    if (format === 'markdown') {
      return {
        format: 'markdown',
        content: this.generateMarkdownRecap(exportData),
      };
    }

    return exportData;
  }

  /**
   * Generate summary stats from packets
   */
  /**
   * Shared replay execution with header sanitization and safe default URL.
   */
  private async executeReplay(
    parsed: any,
    rawPayload: string,
    overrideTargetUrl?: string,
  ) {
    const payload = Buffer.from(rawPayload, 'base64').toString('utf8');
    const bodyStart = payload.indexOf('\r\n\r\n');
    const httpBody = bodyStart !== -1 ? payload.substring(bodyStart + 4) : '';

    const originalHost = parsed.headers?.host || parsed.headers?.Host || '';
    const targetUrl =
      overrideTargetUrl ||
      (originalHost ? `https://${originalHost}${parsed.path}` : null);

    if (!targetUrl) {
      throw new BadRequestException(
        'Cannot determine replay target: no targetUrl provided and original request has no Host header',
      );
    }

    const validated: ValidatedUrl = await validateUrlSafeForFetch(targetUrl);

    const headers = { ...(parsed.headers || {}) };

    const targetHost = new URL(targetUrl).host;
    const isSameHost =
      originalHost &&
      targetHost.toLowerCase() === originalHost.toLowerCase();

    if (!isSameHost) {
      for (const key of Object.keys(headers)) {
        if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
          delete headers[key];
        }
      }
    }

    // Use resolved-IP URL to prevent DNS rebinding; set Host header
    // from the original hostname for correct virtual-host routing.
    headers['host'] = validated.hostname;
    delete headers['Host'];

    const fetchOptions: RequestInit = {
      method: parsed.method,
      headers,
    };

    if (httpBody && ['POST', 'PUT', 'PATCH'].includes(parsed.method)) {
      fetchOptions.body = httpBody;
    }

    try {
      const startTime = Date.now();
      const response = await fetch(validated.fetchUrl, fetchOptions);
      const latencyMs = Date.now() - startTime;
      const responseBody = await response.text();

      return {
        success: true,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        body: responseBody.substring(0, 10000),
        latencyMs,
      };
    } catch (error: unknown) {
      const err = error as Error;
      return {
        success: false,
        error: err.message,
      };
    }
  }

  private generateSummary(packets: any[]): any {
    const protocols: Record<string, number> = {};
    const errors: any[] = [];
    let totalBytes = 0;
    let requestCount = 0;
    let responseCount = 0;

    for (const p of packets) {
      protocols[p.protocol] = (protocols[p.protocol] || 0) + 1;
      totalBytes += p.payloadSize;
      
      if (p.direction === 'outbound') requestCount++;
      if (p.direction === 'inbound') responseCount++;

      // Detect errors
      if (p.parsed) {
        const parsed = typeof p.parsed === 'string' ? JSON.parse(p.parsed) : p.parsed;
        if (parsed.type === 'error' || (parsed.status && parsed.status >= 400)) {
          errors.push({
            sequence: p.sequence,
            protocol: p.protocol,
            error: parsed.status ? `HTTP ${parsed.status}` : parsed.message || 'Error',
          });
        }
      }
    }

    return {
      totalPackets: packets.length,
      totalBytes,
      requestCount,
      responseCount,
      protocols,
      errorCount: errors.length,
      errors: errors.slice(0, 10), // Limit to 10 errors
    };
  }

  /**
   * Generate markdown recap
   */
  private generateMarkdownRecap(data: any): string {
    let md = `# Debug Session Recap\n\n`;
    md += `**Session ID:** \`${data.session.token}\`\n`;
    md += `**Created:** ${new Date(data.session.createdAt).toLocaleString()}\n`;
    md += `**Exported:** ${new Date(data.exportedAt).toLocaleString()}\n\n`;

    md += `## Summary\n\n`;
    md += `- **Total Packets:** ${data.summary.totalPackets}\n`;
    md += `- **Total Data:** ${this.formatBytes(data.summary.totalBytes)}\n`;
    md += `- **Requests:** ${data.summary.requestCount}\n`;
    md += `- **Responses:** ${data.summary.responseCount}\n`;
    md += `- **Errors:** ${data.summary.errorCount}\n\n`;

    md += `### Protocols\n\n`;
    for (const [proto, count] of Object.entries(data.summary.protocols)) {
      md += `- ${proto.toUpperCase()}: ${count} packets\n`;
    }
    md += `\n`;

    if (data.summary.errors.length > 0) {
      md += `### Errors Detected\n\n`;
      for (const err of data.summary.errors) {
        md += `- Packet #${err.sequence} (${err.protocol}): ${err.error}\n`;
      }
      md += `\n`;
    }

    md += `## Traffic Log\n\n`;
    md += `| # | Dir | Protocol | Size | Details |\n`;
    md += `|---|-----|----------|------|------|\n`;
    
    for (const p of data.packets.slice(0, 50)) { // Limit to 50 in markdown
      const dir = p.direction === 'inbound' ? '←' : '→';
      const details = this.getPacketSummary(p);
      md += `| ${p.sequence} | ${dir} | ${p.protocol.toUpperCase()} | ${this.formatBytes(p.payloadSize)} | ${details} |\n`;
    }

    if (data.packets.length > 50) {
      md += `\n*... and ${data.packets.length - 50} more packets*\n`;
    }

    return md;
  }

  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  }

  private getPacketSummary(packet: any): string {
    if (!packet.parsed) return `${packet.payloadSize} bytes`;
    
    const p = packet.parsed;
    switch (packet.protocol) {
      case 'http':
        if (p.type === 'request') return `${p.method} ${p.path}`;
        if (p.type === 'response') return `${p.status} ${p.statusText}`;
        break;
      case 'postgres':
        if (p.type === 'query') return p.query?.substring(0, 40) + '...';
        return p.type;
      case 'redis':
        if (p.type === 'command') return `${p.command}`;
        return p.type;
    }
    return `${packet.payloadSize} bytes`;
  }

  /**
   * Public AI chat for debug viewer (token-based access)
   */
  @Post('public/:token/ai/chat')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug-ai')
  @ApiOperation({
    summary: 'Debug viewer AI chat',
    description: 'Sends a chat message with optional packet context for the public debug viewer.',
  })
  @ApiParam({ name: 'token', description: 'Public debug session token' })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['message'],
      properties: {
        message: { type: 'string' },
        packetContext: { type: 'array', items: { type: 'object' }, description: 'Optional packet snippets for context' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Assistant reply' })
  @ApiResponse({ status: 400, description: 'AI disabled, not configured, or model error' })
  @ApiResponse({ status: 404, description: 'Session not found or expired' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded' })
  async publicAIChat(
    @Param('token') token: string,
    @Body() body: { message: string; packetContext?: any[] },
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    if (!session.aiEnabled) {
      throw new BadRequestException('AI is not enabled for this session');
    }

    if (!this.aiService) {
      throw new BadRequestException('AI service not available');
    }

    // Get workspace AI config
    const config = await this.aiService.getConfig(session.workspaceId);
    if (!config) {
      throw new BadRequestException('AI not configured for this workspace');
    }

    // Build context from packet data
    const packets = body.packetContext || [];

    const history = await this.prisma.withoutRls(() =>
      this.prisma.debugAIMessage.findMany({
        where: { sessionId: session.id },
        orderBy: { createdAt: 'asc' },
        take: 20,
      })
    );

    const ai = this.aiService!;
    const shouldRedact = config.provider !== 'ollama';
    const messages = [
      ...history.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: shouldRedact ? ai.redactPII(m.content) : m.content,
      })),
      { role: 'user' as const, content: shouldRedact ? ai.redactPII(body.message) : body.message },
    ];

    try {
      const response = await ai.chat(
        config,
        messages,
        { packets: shouldRedact
          ? packets.map((p: any) => ({
              ...p,
              parsed: p.parsed ? JSON.parse(ai.redactPII(JSON.stringify(p.parsed))) : undefined,
            }))
          : packets,
        },
      );

      await this.prisma.withoutRls(() =>
        this.prisma.debugAIMessage.createMany({
          data: [
            { sessionId: session.id, role: 'user', content: body.message },
            { sessionId: session.id, role: 'assistant', content: response.content, tokensUsed: response.tokensUsed },
          ],
        })
      );

      return {
        response: response.content,
        tokensUsed: response.tokensUsed,
      };
    } catch (error: unknown) {
      const err = error as Error;
      throw new BadRequestException(`AI error: ${err.message}`);
    }
  }
}
