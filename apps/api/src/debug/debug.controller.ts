import {
  Controller,
  Get,
  Post,
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
import { DebugService } from './debug.service';
import { AuthGuard } from '../auth/auth.guard';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { AIService } from '../ai/ai.service';
import { RateLimitGuard, RateLimit } from '../common/rate-limit.guard';

interface CreateSessionDto {
  serviceId?: string;
  agentId?: string;
  name?: string;
  aiEnabled?: boolean;
  aiProvider?: string;
  aiModel?: string;
  expiresIn?: number;
}

@Controller('v1/debug')
export class DebugController {
  constructor(
    private debugService: DebugService,
    @Optional() @Inject(forwardRef(() => AIService))
    private aiService?: AIService,
  ) {}

  /**
   * Create a new debug session
   */
  @Post('sessions')
  @UseGuards(AuthGuard)
  async createSession(
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
      url: `${process.env.PUBLIC_URL || 'https://privateconnect.co'}/debug/${session.token}`,
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
  async listSessions(
    @Req() req: any,
    @Query('includeEnded') includeEnded?: string,
  ) {
    const workspaceId = req.workspaceId;
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
  async endSession(@Param('id') id: string) {
    await this.debugService.endSession(id);
    return { success: true };
  }

  /**
   * End a debug session by ID (public - for temp tunnels)
   */
  @Delete(':id')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  async endSessionPublic(@Param('id') id: string) {
    const session = await this.debugService.getSession(id);
    if (!session) {
      throw new NotFoundException('Session not found');
    }
    
    await this.debugService.endSession(id);
    return { success: true, message: 'Session ended' };
  }

  /**
   * Get packets for a session (authenticated)
   */
  @Get('sessions/:id/packets')
  @UseGuards(AuthGuard)
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
    );

    return { packets };
  }

  /**
   * Get a single packet with full payload
   */
  @Get('packets/:id')
  @UseGuards(AuthGuard)
  async getPacket(@Param('id') id: string) {
    const packet = await this.debugService.getPacket(id);
    if (!packet) {
      throw new NotFoundException('Packet not found');
    }
    return packet;
  }

  /**
   * Replay a captured request
   */
  @Post('packets/:id/replay')
  @UseGuards(AuthGuard)
  async replayPacket(
    @Param('id') id: string,
    @Body() body: { targetUrl?: string },
  ) {
    const packet = await this.debugService.getPacket(id);
    if (!packet) {
      throw new NotFoundException('Packet not found');
    }

    if (packet.direction !== 'outbound') {
      throw new BadRequestException('Can only replay outbound (request) packets');
    }

    // For HTTP packets, we can replay
    if (packet.protocol === 'http' && packet.parsed) {
      const parsed = JSON.parse(packet.parsed);
      const payload = Buffer.from(packet.payload, 'base64').toString('utf8');
      
      // Extract body from HTTP payload
      const bodyStart = payload.indexOf('\r\n\r\n');
      const httpBody = bodyStart !== -1 ? payload.substring(bodyStart + 4) : '';
      
      // Build fetch options
      const fetchOptions: RequestInit = {
        method: parsed.method,
        headers: parsed.headers || {},
      };
      
      if (httpBody && ['POST', 'PUT', 'PATCH'].includes(parsed.method)) {
        fetchOptions.body = httpBody;
      }

      // Use provided target URL or construct from original
      const targetUrl = body.targetUrl || `http://localhost${parsed.path}`;
      
      try {
        const startTime = Date.now();
        const response = await fetch(targetUrl, fetchOptions);
        const latencyMs = Date.now() - startTime;
        const responseBody = await response.text();
        
        return {
          success: true,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body: responseBody.substring(0, 10000), // Limit response size
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

    throw new BadRequestException(`Replay not supported for ${packet.protocol} protocol`);
  }

  /**
   * Replay a packet by token (public access)
   */
  @Post('public/:token/packets/:packetId/replay')
  @UseGuards(RateLimitGuard)
  @RateLimit('debug')
  async replayPacketByToken(
    @Param('token') token: string,
    @Param('packetId') packetId: string,
    @Body() body: { targetUrl?: string },
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    const packet = await this.debugService.getPacket(packetId);
    if (!packet || packet.sessionId !== session.id) {
      throw new NotFoundException('Packet not found');
    }

    if (packet.direction !== 'outbound') {
      throw new BadRequestException('Can only replay outbound (request) packets');
    }

    if (packet.protocol !== 'http') {
      throw new BadRequestException(`Replay not supported for ${packet.protocol} protocol`);
    }

    const parsed = JSON.parse(packet.parsed || '{}');
    const payload = Buffer.from(packet.payload, 'base64').toString('utf8');
    
    const bodyStart = payload.indexOf('\r\n\r\n');
    const httpBody = bodyStart !== -1 ? payload.substring(bodyStart + 4) : '';
    
    const fetchOptions: RequestInit = {
      method: parsed.method,
      headers: parsed.headers || {},
    };
    
    if (httpBody && ['POST', 'PUT', 'PATCH'].includes(parsed.method)) {
      fetchOptions.body = httpBody;
    }

    const targetUrl = body.targetUrl || `http://localhost${parsed.path}`;
    
    try {
      const startTime = Date.now();
      const response = await fetch(targetUrl, fetchOptions);
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

  /**
   * Create session via API key (for CLI)
   */
  @Post('sessions/cli')
  @UseGuards(ApiKeyGuard)
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
      url: `${process.env.PUBLIC_URL || 'https://privateconnect.co'}/debug/${session.token}`,
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
  async exportSession(
    @Param('token') token: string,
    @Query('format') format: string = 'json',
  ) {
    const session = await this.debugService.getSessionByToken(token);
    if (!session) {
      throw new NotFoundException('Session not found or expired');
    }

    // Get all packets for the session
    const packets = await this.debugService.getPackets(session.id, 500);

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
    
    try {
      const response = await this.aiService.chat(
        config,
        [{ role: 'user', content: body.message }],
        { packets },
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
