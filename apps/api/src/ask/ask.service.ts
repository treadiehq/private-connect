import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { validateUrlSafeForFetch } from '../common/security';
import type {
  AskRequest,
  AskResponse,
  AskReceipt,
  Reachability,
  BlockedAction,
} from './ask.types';

const CHECK_TIMEOUT_MS = 2000;
const CHECK_PATHS = ['/health', '/status', '/version', '/', '/api/v2/status.json'];
const BODY_SNIPPET_MAX_LEN = 200;
const LLM_TIMEOUT_MS = 10000;

interface LLMConfig {
  provider: 'openai' | 'anthropic' | 'ollama';
  model: string;
  apiKey?: string;
  ollamaUrl?: string;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

@Injectable()
export class AskService {
  private readonly logger = new Logger(AskService.name);

  /**
   * Get LLM config from environment variables.
   */
  private getLLMConfig(): LLMConfig | null {
    const provider = process.env.ASK_LLM_PROVIDER as LLMConfig['provider'];
    if (!provider || !['openai', 'anthropic', 'ollama'].includes(provider)) {
      return null;
    }

    const model = process.env.ASK_LLM_MODEL;
    if (!model) {
      return null;
    }

    return {
      provider,
      model,
      apiKey: process.env.ASK_LLM_API_KEY,
      ollamaUrl: process.env.ASK_LLM_OLLAMA_URL || 'http://localhost:11434',
    };
  }

  /**
   * Call LLM based on provider.
   */
  private async callLLM(
    config: LLMConfig,
    messages: ChatMessage[],
  ): Promise<string> {
    switch (config.provider) {
      case 'openai':
        return this.callOpenAI(config, messages);
      case 'anthropic':
        return this.callAnthropic(config, messages);
      case 'ollama':
        return this.callOllama(config, messages);
      default:
        throw new Error(`Unknown LLM provider: ${config.provider}`);
    }
  }

  private async callOpenAI(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error('OpenAI API key required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: 0.3,
          max_completion_tokens: 150,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`OpenAI error: ${text}`);
      }

      const data = (await response.json()) as {
        choices?: Array<{ message?: { content: string } }>;
      };
      return data.choices?.[0]?.message?.content || '';
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async callAnthropic(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key required');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    const systemMessage = messages.find((m) => m.role === 'system');
    const otherMessages = messages.filter((m) => m.role !== 'system');

    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: config.model,
          max_tokens: 150,
          system: systemMessage?.content,
          messages: otherMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Anthropic error: ${text}`);
      }

      const data = (await response.json()) as {
        content?: Array<{ text: string }>;
      };
      return data.content?.[0]?.text || '';
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  private async callOllama(config: LLMConfig, messages: ChatMessage[]): Promise<string> {
    const url = `${config.ollamaUrl}/api/chat`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: config.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Ollama error: ${text}`);
      }

      const data = (await response.json()) as {
        message?: { content: string };
      };
      return data.message?.content || '';
    } catch (err) {
      clearTimeout(timeoutId);
      throw err;
    }
  }

  /**
   * Resolve service input (URL or hostname) into a baseUrl.
   * Blocks private/internal IPs and cloud metadata endpoints (SSRF protection).
   */
  async normalizeServiceInput(service: string): Promise<string> {
    const s = (service || '').trim();
    if (!s) {
      throw new BadRequestException('Service is required');
    }

    let urlStr = s;
    if (!/^https?:\/\//i.test(s)) {
      urlStr = `https://${s}`;
    }

    try {
      const url = new URL(urlStr);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        throw new BadRequestException('Only http and https are allowed');
      }

      await validateUrlSafeForFetch(url.origin);
      return url.origin;
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
      throw new BadRequestException('Invalid or disallowed service URL');
    }
  }

  /**
   * Run GET checks in order; each is timeout-capped.
   * Read-only: only GET (no writes).
   */
  async runChecks(baseUrl: string): Promise<AskReceipt[]> {
    const receipts: AskReceipt[] = [];

    for (const path of CHECK_PATHS) {
      const url = `${baseUrl.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
      const receipt = await this.runOneCheck('GET', path, url);
      receipts.push(receipt);
    }

    return receipts;
  }

  private async runOneCheck(
    method: string,
    path: string,
    url: string,
  ): Promise<AskReceipt> {
    const start = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: controller.signal,
        redirect: 'manual',
        headers: { Accept: 'application/json, text/plain, */*' },
      });
      const latencyMs = Date.now() - start;

      let bodySnippet: string | undefined;
      try {
        const reader = res.body?.getReader();
        if (reader) {
          const maxBytes = BODY_SNIPPET_MAX_LEN + 64;
          let received = 0;
          const chunks: Uint8Array[] = [];
          while (received < maxBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            received += value.length;
          }
          reader.cancel();
          const text = new TextDecoder().decode(
            chunks.length === 1 ? chunks[0] : Buffer.concat(chunks),
          );
          if (text.length > 0) {
            bodySnippet = text.length > BODY_SNIPPET_MAX_LEN
              ? text.slice(0, BODY_SNIPPET_MAX_LEN) + '…'
              : text;
          }
        }
      } catch {
        // ignore body read errors (including abort)
      } finally {
        clearTimeout(timeoutId);
      }

      return {
        method,
        path,
        url,
        status: res.status,
        latencyMs,
        ok: res.ok,
        bodySnippet,
      };
    } catch (err: unknown) {
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      return {
        method,
        path,
        url,
        status: null,
        latencyMs,
        ok: false,
        error,
      };
    }
  }

  /**
   * Classify reachability from check results.
   * UNREACHABLE_OR_PRIVATE when all checks fail (DNS, timeout, connection refused, 403).
   */
  classifyReachability(receipts: AskReceipt[]): Reachability {
    const anyOk = receipts.some((r) => r.ok);
    if (anyOk) {
      return {
        reachable: true,
        classification: 'PUBLIC_OR_LOCAL',
      };
    }

    const allFailed = receipts.length > 0 && receipts.every((r) => !r.ok);
    const reasons = receipts
      .map((r) => r.error)
      .filter(Boolean) as string[];
    const hasDns = reasons.some(
      (e) => /ENOTFOUND|getaddrinfo|EAI_AGAIN/i.test(e),
    );
    const hasTimeout = reasons.some(
      (e) => /ETIMEDOUT|timeout|aborted/i.test(e),
    );
    const hasRefused = reasons.some(
      (e) => /ECONNREFUSED|ECONNRESET/i.test(e),
    );
    const has403 = receipts.some((r) => r.status === 403);

    const isUnreachable =
      allFailed && (hasDns || hasTimeout || hasRefused || has403);
    const reason = reasons[0] || (has403 ? 'Forbidden (403)' : 'All checks failed');

    return {
      reachable: false,
      classification: isUnreachable ? 'UNREACHABLE_OR_PRIVATE' : 'PUBLIC_OR_LOCAL',
      reason: isUnreachable ? reason : undefined,
    };
  }

  /**
   * Build the LLM prompt for generating an answer.
   */
  private buildPrompt(
    question: string,
    receipts: AskReceipt[],
    reachability: Reachability,
    blockedActions: BlockedAction[],
  ): ChatMessage[] {
    const systemPrompt = `You are a concise service checker. You answer questions about a service based ONLY on the check results provided.

Rules:
- Be assertive and confident. Start with "Yes" or "No" when appropriate.
- Keep answers to 1-2 sentences maximum.
- Only state facts from the check results. Never guess or hallucinate.
- If the service is unreachable, say so clearly.
- If asked about something the checks don't show, say you can only confirm what was checked.`;

    const receiptsText = receipts
      .map(
        (r) =>
          `${r.method} ${r.path}: ${r.ok ? `${r.status} OK` : `FAILED (${r.error || r.status})`}${r.bodySnippet ? `\nResponse: ${r.bodySnippet}` : ''}`,
      )
      .join('\n\n');

    const blockedText =
      blockedActions.length > 0
        ? `\nBlocked actions (writes are disabled): ${blockedActions.map((a) => `${a.method} ${a.path}`).join(', ')}`
        : '';

    const userPrompt = `Question: "${question}"

Service reachability: ${reachability.reachable ? 'REACHABLE' : `UNREACHABLE (${reachability.reason || 'unknown'})`}

Check results:
${receiptsText}${blockedText}

Answer the question concisely based only on the above.`;

    return [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ];
  }

  /**
   * Generate answer using LLM if configured, otherwise fall back to stub.
   */
  async buildAnswer(
    question: string,
    receipts: AskReceipt[],
    reachability: Reachability,
    blockedActions: BlockedAction[],
  ): Promise<string> {
    // Try LLM first
    const llmConfig = this.getLLMConfig();
    if (llmConfig) {
      try {
        const messages = this.buildPrompt(question, receipts, reachability, blockedActions);
        const answer = await this.callLLM(llmConfig, messages);
        if (answer && answer.trim()) {
          return answer.trim();
        }
      } catch (err) {
        this.logger.warn(`LLM call failed, falling back to stub: ${err}`);
      }
    }

    // Fall back to stub answer
    return this.buildStubAnswer(question, receipts, reachability);
  }

  private static readonly STUB_DISCLAIMER =
    '\n\n_(Automated endpoint check — not AI analysis. Set ASK_LLM_PROVIDER for intelligent answers.)_';

  /**
   * Stub answer generator (fallback when LLM is not configured or fails).
   * All responses clearly indicate this is an automated heuristic, not AI.
   */
  private buildStubAnswer(
    question: string,
    receipts: AskReceipt[],
    reachability: Reachability,
  ): string {
    const note = AskService.STUB_DISCLAIMER;

    if (reachability.classification === 'UNREACHABLE_OR_PRIVATE') {
      return `The service could not be reached from the server.${note}`;
    }

    const okReceipts = receipts.filter((r) => r.ok);
    if (okReceipts.length === 0) {
      return `None of the probed endpoints (${CHECK_PATHS.join(', ')}) responded successfully.${note}`;
    }

    const q = question.toLowerCase();
    const healthReceipt = okReceipts.find((r) => r.path === '/health' || r.path === '/healthz');
    const versionReceipt = okReceipts.find((r) => r.path === '/version');
    const statusReceipt = okReceipts.find((r) => r.path === '/status');

    if (q.includes('health') && healthReceipt) {
      const snippet = healthReceipt.bodySnippet || '';
      const statusOk =
        snippet.includes('"ok"') || snippet.includes('"status":"ok"') || snippet.includes('"healthy"');
      const answer = statusOk
        ? `/health returned a healthy status.`
        : `/health responded with HTTP ${healthReceipt.status}.`;
      return `${answer}${note}`;
    }

    if (q.includes('version') && versionReceipt) {
      const match = versionReceipt.bodySnippet?.match(/"version"\s*:\s*"([^"]+)"/);
      const answer = match
        ? `/version reports version ${match[1]}.`
        : `/version responded with HTTP ${versionReceipt.status}.`;
      return `${answer}${note}`;
    }

    if (q.includes('status') && statusReceipt) {
      return `/status responded with HTTP ${statusReceipt.status}.${note}`;
    }

    if (q.includes('running') || q.includes('up') || q.includes('alive') || q.includes('reachable')) {
      return `The service responded on ${okReceipts.length}/${receipts.length} probed endpoints.${note}`;
    }

    if (q.includes('fail') || q.includes('error') || q.includes('wrong')) {
      const failedReceipts = receipts.filter((r) => !r.ok);
      if (failedReceipts.length > 0) {
        return `${failedReceipts.length} endpoint(s) failed: ${failedReceipts.map((r) => `${r.path} (${r.error || r.status})`).join(', ')}.${note}`;
      }
      return `All ${receipts.length} probed endpoints responded successfully.${note}`;
    }

    return `${okReceipts.length}/${receipts.length} probed endpoints responded successfully.${note}`;
  }

  /**
   * Infer blocked write actions from the user's question.
   * Returns actions that we considered but refused to execute.
   */
  inferBlockedActions(question: string): BlockedAction[] {
    const q = question.toLowerCase();
    const blocked: BlockedAction[] = [];

    // Map question intents to blocked actions
    const patterns: Array<{ keywords: string[]; method: string; path: string }> = [
      { keywords: ['deploy', 'deployment', 'ship', 'release'], method: 'POST', path: '/deploy' },
      { keywords: ['restart', 'reboot'], method: 'POST', path: '/restart' },
      { keywords: ['stop', 'shutdown', 'kill'], method: 'POST', path: '/stop' },
      { keywords: ['start', 'boot', 'launch'], method: 'POST', path: '/start' },
      { keywords: ['update', 'upgrade', 'patch'], method: 'PATCH', path: '/config' },
      { keywords: ['delete', 'remove', 'destroy', 'drop'], method: 'DELETE', path: '/resource' },
      { keywords: ['create', 'add', 'insert', 'new'], method: 'POST', path: '/resource' },
      { keywords: ['reset', 'clear', 'flush', 'purge'], method: 'POST', path: '/reset' },
      { keywords: ['migrate', 'migration'], method: 'POST', path: '/migrate' },
      { keywords: ['rollback', 'revert'], method: 'POST', path: '/rollback' },
      { keywords: ['scale', 'scaling'], method: 'POST', path: '/scale' },
      { keywords: ['config', 'configure', 'setting'], method: 'PUT', path: '/config' },
      { keywords: ['backup'], method: 'POST', path: '/backup' },
      { keywords: ['restore'], method: 'POST', path: '/restore' },
    ];

    for (const pattern of patterns) {
      if (pattern.keywords.some((kw) => q.includes(kw))) {
        blocked.push({
          method: pattern.method,
          path: pattern.path,
          reason: 'writes are disabled',
        });
      }
    }

    return blocked;
  }

  async ask(body: AskRequest): Promise<AskResponse> {
    const baseUrl = await this.normalizeServiceInput(body.service);
    const receipts = await this.runChecks(baseUrl);
    const reachability = this.classifyReachability(receipts);
    const blockedActions = this.inferBlockedActions(body.question);
    const answer = await this.buildAnswer(body.question, receipts, reachability, blockedActions);

    return {
      answer,
      baseUrl,
      receipts,
      reachability,
      blockedActions,
    };
  }
}
