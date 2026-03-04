import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecureLogger, encryptField, decryptField } from '../common/security';

export interface AIConfig {
  provider: 'ollama' | 'openai' | 'anthropic';
  model: string;
  apiKey?: string;
  ollamaUrl?: string;
}

export interface AnalysisRequest {
  packets: Array<{
    direction: string;
    protocol: string;
    parsed?: any;
    payloadPreview?: string;
  }>;
  context?: string;
  question?: string;
}

export interface AnalysisResponse {
  analysis: string;
  suggestions?: string[];
  errors?: Array<{
    type: string;
    message: string;
    fix?: string;
  }>;
  tokensUsed?: number;
  model: string;
  latencyMs: number;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

@Injectable()
export class AIService {
  private readonly logger = new SecureLogger(AIService.name);
  
  // Default Ollama URL
  private readonly defaultOllamaUrl = 'http://localhost:11434';

  constructor(private prisma: PrismaService) {}

  /**
   * Get AI configuration for a workspace
   */
  async getConfig(workspaceId: string): Promise<AIConfig | null> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        aiProvider: true,
        aiModel: true,
        aiApiKey: true,
        aiOllamaUrl: true,
      },
    });

    if (!workspace?.aiProvider) return null;

    return {
      provider: workspace.aiProvider as AIConfig['provider'],
      model: workspace.aiModel || this.getDefaultModel(workspace.aiProvider),
      apiKey: workspace.aiApiKey ? decryptField(workspace.aiApiKey) : undefined,
      ollamaUrl: workspace.aiOllamaUrl || this.defaultOllamaUrl,
    };
  }

  /**
   * Update AI configuration for a workspace
   */
  async updateConfig(workspaceId: string, config: Partial<AIConfig>): Promise<void> {
    await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        aiProvider: config.provider,
        aiModel: config.model,
        aiApiKey: config.apiKey != null ? encryptField(config.apiKey) : config.apiKey,
        aiOllamaUrl: config.ollamaUrl,
      },
    });
  }

  /**
   * Analyze traffic packets
   */
  async analyzeTraffic(
    config: AIConfig,
    request: AnalysisRequest,
  ): Promise<AnalysisResponse> {
    const startTime = Date.now();
    
    // Build the analysis prompt
    const systemPrompt = `You are an expert debugging assistant analyzing network traffic. 
You help developers understand errors, identify issues, and suggest fixes.
Be concise and actionable. Focus on the most important issues first.
When you see errors, explain what went wrong and suggest specific fixes.`;

    const userPrompt = this.buildAnalysisPrompt(request);

    try {
      const response = await this.callLLM(config, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      const latencyMs = Date.now() - startTime;
      
      // Parse the response for structured output
      const parsed = this.parseAnalysisResponse(response.content);

      return {
        analysis: parsed.analysis,
        suggestions: parsed.suggestions,
        errors: parsed.errors,
        tokensUsed: response.tokensUsed,
        model: config.model,
        latencyMs,
      };
    } catch (error: unknown) {
      const err = error as Error;
      this.logger.error(`AI analysis failed: ${err.message}`);
      throw error;
    }
  }

  /**
   * Chat with AI about the traffic
   */
  async chat(
    config: AIConfig,
    messages: ChatMessage[],
    trafficContext?: AnalysisRequest,
  ): Promise<{ content: string; tokensUsed?: number }> {
    const systemPrompt = `You are an expert debugging assistant helping developers analyze network traffic.
You have access to captured traffic from a live debug session.
Be helpful, concise, and provide actionable advice.`;

    const contextPrompt = trafficContext 
      ? `\n\nCurrent traffic context:\n${this.buildAnalysisPrompt(trafficContext)}`
      : '';

    const allMessages: ChatMessage[] = [
      { role: 'system', content: systemPrompt + contextPrompt },
      ...messages,
    ];

    return this.callLLM(config, allMessages);
  }

  /**
   * Call the LLM based on provider
   */
  private async callLLM(
    config: AIConfig,
    messages: ChatMessage[],
  ): Promise<{ content: string; tokensUsed?: number }> {
    switch (config.provider) {
      case 'ollama':
        return this.callOllama(config, messages);
      case 'openai':
        return this.callOpenAI(config, messages);
      case 'anthropic':
        return this.callAnthropic(config, messages);
      default:
        throw new Error(`Unknown AI provider: ${config.provider}`);
    }
  }

  /**
   * Call Ollama (local)
   */
  private async callOllama(
    config: AIConfig,
    messages: ChatMessage[],
  ): Promise<{ content: string; tokensUsed?: number }> {
    const url = `${config.ollamaUrl || this.defaultOllamaUrl}/api/chat`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        stream: false,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error: ${text}`);
    }

    const data = await response.json() as {
      message?: { content: string };
      eval_count?: number;
      prompt_eval_count?: number;
    };
    
    return {
      content: data.message?.content || '',
      tokensUsed: (data.eval_count || 0) + (data.prompt_eval_count || 0),
    };
  }

  /**
   * Call OpenAI
   */
  private async callOpenAI(
    config: AIConfig,
    messages: ChatMessage[],
  ): Promise<{ content: string; tokensUsed?: number }> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key required');
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
        temperature: 0.7,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`OpenAI error: ${text}`);
    }

    const data = await response.json() as {
      choices?: Array<{ message?: { content: string } }>;
      usage?: { total_tokens: number };
    };
    
    return {
      content: data.choices?.[0]?.message?.content || '',
      tokensUsed: data.usage?.total_tokens,
    };
  }

  /**
   * Call Anthropic
   */
  private async callAnthropic(
    config: AIConfig,
    messages: ChatMessage[],
  ): Promise<{ content: string; tokensUsed?: number }> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key required');
    }

    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const otherMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.model,
        max_tokens: 1000,
        system: systemMessage?.content,
        messages: otherMessages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Anthropic error: ${text}`);
    }

    const data = await response.json() as {
      content?: Array<{ text: string }>;
      usage?: { input_tokens: number; output_tokens: number };
    };
    
    return {
      content: data.content?.[0]?.text || '',
      tokensUsed: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    };
  }

  /**
   * Build analysis prompt from traffic
   */
  private buildAnalysisPrompt(request: AnalysisRequest): string {
    let prompt = 'Analyze the following network traffic:\n\n';

    for (const packet of request.packets.slice(0, 20)) { // Limit to 20 packets
      prompt += `[${packet.direction.toUpperCase()}] ${packet.protocol.toUpperCase()}\n`;
      if (packet.parsed) {
        prompt += JSON.stringify(packet.parsed, null, 2) + '\n';
      }
      if (packet.payloadPreview) {
        prompt += `Payload preview: ${packet.payloadPreview}\n`;
      }
      prompt += '\n';
    }

    if (request.context) {
      prompt += `\nAdditional context: ${request.context}\n`;
    }

    if (request.question) {
      prompt += `\nQuestion: ${request.question}\n`;
    } else {
      prompt += `\nIdentify any errors, issues, or performance problems. Suggest fixes if applicable.\n`;
    }

    return prompt;
  }

  /**
   * Parse analysis response for structured output
   */
  private parseAnalysisResponse(content: string): {
    analysis: string;
    suggestions?: string[];
    errors?: Array<{ type: string; message: string; fix?: string }>;
  } {
    // For now, just return the raw analysis
    // In the future, we could use structured output or parsing
    return {
      analysis: content,
    };
  }

  /**
   * Get default model for provider
   */
  private getDefaultModel(provider: string): string {
    switch (provider) {
      case 'ollama':
        return 'llama3';
      case 'openai':
        return 'gpt-4o-mini';
      case 'anthropic':
        return 'claude-3-haiku-20240307';
      default:
        return 'llama3';
    }
  }

  /**
   * Redact PII from content before sending to cloud
   */
  redactPII(content: string): string {
    // Email addresses
    content = content.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL]');
    
    // Phone numbers (various formats)
    content = content.replace(/\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g, '[PHONE]');
    
    // Credit card numbers (basic pattern)
    content = content.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[CARD]');
    
    // SSN
    content = content.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '[SSN]');
    
    // API keys and tokens (common patterns)
    content = content.replace(/\b(sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{20,}\b/gi, '[API_KEY]');
    
    // Bearer tokens
    content = content.replace(/Bearer\s+[a-zA-Z0-9._-]+/gi, 'Bearer [TOKEN]');
    
    // JWT tokens
    content = content.replace(/eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g, '[JWT]');
    
    return content;
  }
}
