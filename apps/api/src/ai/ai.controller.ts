import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { AIService, AIConfig, ChatMessage } from './ai.service';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma/prisma.service';

interface UpdateConfigDto {
  provider: 'ollama' | 'openai' | 'anthropic';
  model?: string;
  apiKey?: string;
  ollamaUrl?: string;
  autoAnalyze?: boolean;
}

interface AnalyzeDto {
  sessionId: string;
  question?: string;
}

interface ChatDto {
  sessionId: string;
  messages: ChatMessage[];
}

@Controller('v1/ai')
@UseGuards(AuthGuard)
export class AIController {
  constructor(
    private aiService: AIService,
    private prisma: PrismaService,
  ) {}

  /**
   * Get AI configuration for workspace
   */
  @Get('config')
  async getConfig(@Req() req: any) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const config = await this.aiService.getConfig(workspaceId);
    
    // Don't expose the full API key
    if (config?.apiKey) {
      config.apiKey = config.apiKey.substring(0, 8) + '...';
    }

    return { config };
  }

  /**
   * Update AI configuration
   */
  @Put('config')
  async updateConfig(
    @Req() req: any,
    @Body() body: UpdateConfigDto,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    // Validate provider
    if (!['ollama', 'openai', 'anthropic'].includes(body.provider)) {
      throw new BadRequestException('Invalid provider');
    }

    // Require API key for cloud providers
    if (['openai', 'anthropic'].includes(body.provider) && !body.apiKey) {
      // Check if there's an existing key
      const existing = await this.aiService.getConfig(workspaceId);
      if (!existing?.apiKey) {
        throw new BadRequestException(`API key required for ${body.provider}`);
      }
    }

    await this.aiService.updateConfig(workspaceId, body);

    // Also update autoAnalyze if provided
    if (body.autoAnalyze !== undefined) {
      await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { aiAutoAnalyze: body.autoAnalyze },
      });
    }

    return { success: true };
  }

  /**
   * Test AI configuration
   */
  @Post('test')
  async testConfig(@Req() req: any) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const config = await this.aiService.getConfig(workspaceId);
    if (!config) {
      throw new BadRequestException('AI not configured');
    }

    try {
      const response = await this.aiService.chat(config, [
        { role: 'user', content: 'Say "Hello, I am working correctly!" in exactly those words.' },
      ]);

      return {
        success: true,
        response: response.content,
        tokensUsed: response.tokensUsed,
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
   * Analyze traffic from a debug session
   */
  @Post('analyze')
  async analyze(
    @Req() req: any,
    @Body() body: AnalyzeDto,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const config = await this.aiService.getConfig(workspaceId);
    if (!config) {
      throw new BadRequestException('AI not configured');
    }

    // Get session and packets
    const session = await this.prisma.debugSession.findUnique({
      where: { id: body.sessionId },
      include: {
        packets: {
          orderBy: { sequence: 'desc' },
          take: 50,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Debug session not found');
    }

    if (session.workspaceId !== workspaceId) {
      throw new BadRequestException('Session belongs to different workspace');
    }

    // Build packet data for analysis
    const packets = session.packets.map(p => ({
      direction: p.direction,
      protocol: p.protocol,
      parsed: p.parsed ? JSON.parse(p.parsed) : undefined,
      payloadPreview: p.payloadSize <= 500 
        ? Buffer.from(p.payload, 'base64').toString('utf8').substring(0, 200)
        : undefined,
    }));

    // Redact PII if using cloud provider
    const shouldRedact = config.provider !== 'ollama';

    const analysis = await this.aiService.analyzeTraffic(config, {
      packets: shouldRedact 
        ? packets.map(p => ({
            ...p,
            parsed: p.parsed ? JSON.parse(this.aiService.redactPII(JSON.stringify(p.parsed))) : undefined,
            payloadPreview: p.payloadPreview ? this.aiService.redactPII(p.payloadPreview) : undefined,
          }))
        : packets,
      question: body.question,
    });

    // Store AI message in session
    await this.prisma.debugAIMessage.create({
      data: {
        sessionId: body.sessionId,
        role: 'assistant',
        content: analysis.analysis,
        model: analysis.model,
        tokensUsed: analysis.tokensUsed,
        latencyMs: analysis.latencyMs,
      },
    });

    return analysis;
  }

  /**
   * Chat with AI about a debug session
   */
  @Post('chat')
  async chat(
    @Req() req: any,
    @Body() body: ChatDto,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const config = await this.aiService.getConfig(workspaceId);
    if (!config) {
      throw new BadRequestException('AI not configured');
    }

    // Get session and recent packets for context
    const session = await this.prisma.debugSession.findUnique({
      where: { id: body.sessionId },
      include: {
        packets: {
          orderBy: { sequence: 'desc' },
          take: 20,
        },
      },
    });

    if (!session) {
      throw new NotFoundException('Debug session not found');
    }

    if (session.workspaceId !== workspaceId) {
      throw new BadRequestException('Session belongs to different workspace');
    }

    // Build traffic context
    const trafficContext = {
      packets: session.packets.map(p => ({
        direction: p.direction,
        protocol: p.protocol,
        parsed: p.parsed ? JSON.parse(p.parsed) : undefined,
      })),
    };

    // Redact if cloud provider
    const shouldRedact = config.provider !== 'ollama';
    const messages = shouldRedact
      ? body.messages.map(m => ({ ...m, content: this.aiService.redactPII(m.content) }))
      : body.messages;

    const response = await this.aiService.chat(config, messages, trafficContext);

    // Store messages
    for (const msg of body.messages) {
      await this.prisma.debugAIMessage.create({
        data: {
          sessionId: body.sessionId,
          role: msg.role,
          content: msg.content,
        },
      });
    }

    await this.prisma.debugAIMessage.create({
      data: {
        sessionId: body.sessionId,
        role: 'assistant',
        content: response.content,
        tokensUsed: response.tokensUsed,
      },
    });

    return {
      content: response.content,
      tokensUsed: response.tokensUsed,
    };
  }

  /**
   * Get chat history for a session
   */
  @Get('sessions/:sessionId/messages')
  async getMessages(
    @Req() req: any,
    @Param('sessionId') sessionId: string,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const session = await this.prisma.debugSession.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.workspaceId !== workspaceId) {
      throw new NotFoundException('Session not found');
    }

    const messages = await this.prisma.debugAIMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });

    return { messages };
  }
}
