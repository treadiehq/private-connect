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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
} from '@nestjs/swagger';
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

@ApiTags('AI')
@ApiBearerAuth('bearer')
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
  @ApiOperation({
    summary: 'Get AI configuration',
    description: 'Returns AI configuration for the workspace; the API key is masked in the response.',
  })
  @ApiResponse({ status: 200, description: 'AI configuration (masked API key)' })
  @ApiResponse({ status: 400, description: 'Workspace context required' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Update AI configuration',
    description: 'Updates provider, model, API key, Ollama URL, and auto-analyze settings.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider'],
      properties: {
        provider: {
          type: 'string',
          enum: ['ollama', 'openai', 'anthropic'],
          example: 'ollama',
        },
        model: { type: 'string' },
        apiKey: { type: 'string' },
        ollamaUrl: { type: 'string' },
        autoAnalyze: { type: 'boolean' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Configuration updated' })
  @ApiResponse({ status: 400, description: 'Invalid input or workspace context' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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

    const isMaskedKey = body.apiKey && /\.\.\.$/.test(body.apiKey) && body.apiKey.length < 20;

    if (['openai', 'anthropic'].includes(body.provider)) {
      if (!body.apiKey || isMaskedKey) {
        const existing = await this.aiService.getConfig(workspaceId);
        if (!existing?.apiKey) {
          throw new BadRequestException(`API key required for ${body.provider}`);
        }
      }
    }

    const updateData = { ...body, autoAnalyze: body.autoAnalyze };
    if (isMaskedKey) {
      delete updateData.apiKey;
    }

    await this.aiService.updateConfig(workspaceId, updateData);

    return { success: true };
  }

  /**
   * Test AI configuration
   */
  @Post('test')
  @ApiOperation({
    summary: 'Test AI configuration',
    description: 'Runs a simple prompt against the configured provider to verify connectivity.',
  })
  @ApiResponse({ status: 200, description: 'Test result with success flag and response or error message' })
  @ApiResponse({ status: 400, description: 'Workspace context or AI configuration missing' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Analyze debug session traffic',
    description: 'Sends recent session traffic to the AI for analysis with an optional follow-up question.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId'],
      properties: {
        sessionId: { type: 'string' },
        question: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Traffic analysis result' })
  @ApiResponse({ status: 400, description: 'Invalid request, workspace mismatch, or AI not configured' })
  @ApiResponse({ status: 404, description: 'Debug session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
  @ApiOperation({
    summary: 'Chat about a debug session',
    description: 'Sends messages with session traffic context and returns the assistant reply.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['sessionId', 'messages'],
      properties: {
        sessionId: { type: 'string' },
        messages: {
          type: 'array',
          items: {
            type: 'object',
            required: ['role', 'content'],
            properties: {
              role: { type: 'string', enum: ['user', 'assistant', 'system'] },
              content: { type: 'string' },
            },
          },
        },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Assistant message and token usage' })
  @ApiResponse({ status: 400, description: 'Invalid request, workspace mismatch, or AI not configured' })
  @ApiResponse({ status: 404, description: 'Debug session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async chat(
    @Req() req: any,
    @Body() body: ChatDto,
  ) {
    const workspaceId = req.workspaceId;
    if (!workspaceId) {
      throw new BadRequestException('Workspace context required');
    }

    const MAX_MESSAGES = 50;
    const MAX_MESSAGE_LENGTH = 32_000;
    if (!body.messages || body.messages.length === 0) {
      throw new BadRequestException('Messages are required');
    }
    if (body.messages.length > MAX_MESSAGES) {
      throw new BadRequestException(`Too many messages (max ${MAX_MESSAGES})`);
    }
    for (const msg of body.messages) {
      if (msg.content && msg.content.length > MAX_MESSAGE_LENGTH) {
        throw new BadRequestException(`Message too long (max ${MAX_MESSAGE_LENGTH} characters)`);
      }
    }

    const config = await this.aiService.getConfig(workspaceId);
    if (!config) {
      throw new BadRequestException('AI not configured');
    }

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

    // Redact if cloud provider (messages and traffic context must both be redacted before sending to third-party LLMs)
    const shouldRedact = config.provider !== 'ollama';
    const trafficContext = {
      packets: session.packets.map(p => ({
        direction: p.direction,
        protocol: p.protocol,
        parsed: p.parsed
          ? JSON.parse(shouldRedact ? this.aiService.redactPII(p.parsed) : p.parsed)
          : undefined,
      })),
    };
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
  @ApiOperation({
    summary: 'Get AI chat history',
    description: 'Returns stored AI messages for a debug session in chronological order.',
  })
  @ApiResponse({ status: 200, description: 'List of AI messages for the session' })
  @ApiResponse({ status: 400, description: 'Workspace context required' })
  @ApiResponse({ status: 404, description: 'Session not found' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
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
