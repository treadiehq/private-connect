/**
 * Private Connect SDK
 *
 * Programmatic access to Private Connect services, grants, and agent orchestration.
 *
 * @example
 * ```typescript
 * import { PrivateConnect } from '@privateconnect/sdk';
 *
 * const pc = new PrivateConnect({ apiKey: 'your-api-key' });
 *
 * // Connect to a service (assumes tunnel is already open)
 * const db = await pc.connect('postgres-prod');
 * console.log(db.connectionString); // postgres://localhost:5432/...
 *
 * // Grant an AI agent temporary access
 * const grant = await pc.grants.create({
 *   agentLabel: 'claude',
 *   resourceType: 'db',
 *   resourceName: 'postgres',
 *   ttl: '5m',
 * });
 * console.log(grant.token); // gnt_...
 *
 * // List all agents
 * const agents = await pc.agents.list();
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PrivateConnectConfig {
  /** API key for authentication */
  apiKey: string;
  /** Hub URL (default: https://api.privateconnect.co) */
  hubUrl?: string;
  /** Agent ID (auto-detected from local config if not provided) */
  agentId?: string;
  /** Disable usage tracking (default: false) */
  disableTracking?: boolean;
}

export interface Service {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort?: number;
  protocol: string;
  status: string;
  agentLabel?: string;
}

export interface Agent {
  id: string;
  name?: string;
  label: string;
  isOnline: boolean;
  lastSeenAt: string;
  capabilities: string[];
  services: string[];
}

export interface Connection {
  service: string;
  host: string;
  port: number;
  connectionString: string;
  envVar: string;
  /** Present when using a grant-based connection */
  grantToken?: string;
  /** Present when using a grant-based connection */
  grantEndpoint?: string;
}

export interface Message {
  id: string;
  from: { id: string; name?: string; label?: string };
  channel: string;
  type: string;
  payload: Record<string, unknown>;
  createdAt: string;
  isRead: boolean;
}

export interface Grant {
  id: string;
  agentLabel: string;
  resourceType: string;
  resourceName: string;
  scope: string;
  expiresAt: string;
  expiresInMinutes?: number;
  token?: string;
  endpoint?: string;
}

export interface GrantCreateOptions {
  agentLabel: string;
  resourceType: 'db' | 'api' | 'path';
  resourceName: string;
  scope?: 'read-only' | 'full';
  /** Duration string: 60s, 5m, 1h, 1d */
  ttl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Tracking
// ─────────────────────────────────────────────────────────────────────────────

function trackSdkUsage(hubUrl: string): void {
  const data = JSON.stringify({
    os: typeof process !== 'undefined' ? process.platform : 'browser',
    arch: typeof process !== 'undefined' ? (process.arch === 'arm64' ? 'arm64' : 'x64') : 'unknown',
    version: 'sdk',
    source: 'sdk',
  });

  fetch(`${hubUrl}/v1/events/install`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: data,
  }).catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Agent ID Detection
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_PATH = path.join(os.homedir(), '.private-connect', 'config.json');

/**
 * Detect the agent ID from local config or environment.
 * Returns undefined if no agent is configured — callers that need an agent ID
 * should surface a clear error rather than using a fake one.
 */
function detectAgentId(): string | undefined {
  // 1. Environment variables (highest priority — useful in CI)
  const envId = process.env.PRIVATECONNECT_AGENT_ID || process.env.CONNECT_AGENT_ID;
  if (envId) return envId;

  // 2. Local config file (~/.private-connect/config.json)
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      const config = JSON.parse(raw);
      if (config.agentId && typeof config.agentId === 'string') {
        return config.agentId;
      }
    }
  } catch {
    // Config unreadable or malformed — fall through
  }

  return undefined;
}

// ─────────────────────────────────────────────────────────────────────────────
// Agents API
// ─────────────────────────────────────────────────────────────────────────────

export class AgentsAPI {
  constructor(private client: PrivateConnect) {}

  async list(options?: { onlineOnly?: boolean }): Promise<Agent[]> {
    const response = await this.client.fetch('/v1/agents/orchestration');
    const data = await response.json();
    let agents = data.agents || [];

    if (options?.onlineOnly) {
      agents = agents.filter((a: any) => a.isOnline);
    }

    return agents.map((a: any) => ({
      id: a.id,
      name: a.name,
      label: a.label,
      isOnline: a.isOnline,
      lastSeenAt: a.lastSeenAt,
      capabilities: a.capabilities?.map((c: any) => c.name) || [],
      services: a.services?.map((s: any) => s.name) || [],
    }));
  }

  async findByCapability(capability: string): Promise<Agent[]> {
    const response = await this.client.fetch(`/v1/agents/by-capability/${encodeURIComponent(capability)}`);
    const data = await response.json();
    return data.agents || [];
  }

  async registerCapabilities(capabilities: Array<{ name: string; metadata?: Record<string, unknown> }>): Promise<void> {
    const agentId = this.client.requireAgentId();
    await this.client.fetch(`/v1/agents/${agentId}/capabilities`, {
      method: 'POST',
      body: JSON.stringify({ capabilities }),
    });
  }

  async sendMessage(
    toAgentId: string,
    payload: Record<string, unknown>,
    options?: { channel?: string; type?: 'request' | 'response' | 'event' }
  ): Promise<{ messageId: string }> {
    const agentId = this.client.requireAgentId();
    const response = await this.client.fetch(`/v1/agents/${agentId}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ toAgentId, payload, ...options }),
    });
    return response.json();
  }

  async broadcast(
    payload: Record<string, unknown>,
    options?: { channel?: string }
  ): Promise<{ sent: number }> {
    const agentId = this.client.requireAgentId();
    const response = await this.client.fetch(`/v1/agents/${agentId}/messages/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ payload, ...options }),
    });
    return response.json();
  }

  async getMessages(options?: { channel?: string; unreadOnly?: boolean; limit?: number }): Promise<Message[]> {
    const agentId = this.client.requireAgentId();
    const params = new URLSearchParams();
    if (options?.channel) params.set('channel', options.channel);
    if (options?.unreadOnly !== undefined) params.set('unreadOnly', String(options.unreadOnly));
    if (options?.limit) params.set('limit', String(options.limit));

    const response = await this.client.fetch(`/v1/agents/${agentId}/messages?${params}`);
    const data = await response.json();
    return data.messages || [];
  }

  async markRead(messageIds: string[]): Promise<void> {
    const agentId = this.client.requireAgentId();
    await this.client.fetch(`/v1/agents/${agentId}/messages/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Services API
// ─────────────────────────────────────────────────────────────────────────────

export class ServicesAPI {
  constructor(private client: PrivateConnect) {}

  async list(): Promise<Service[]> {
    const response = await this.client.fetch('/v1/services');
    return response.json();
  }

  async get(name: string): Promise<Service | null> {
    const services = await this.list();
    return services.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Get connection details for a service.
   *
   * If `grantToken` is provided, returns a proxied connection via the hub's
   * grant endpoint instead of assuming a local tunnel.
   */
  async getConnection(serviceName: string, options?: { grantToken?: string }): Promise<Connection> {
    if (options?.grantToken) {
      return this.getGrantConnection(serviceName, options.grantToken);
    }

    const service = await this.get(serviceName);
    if (!service) {
      throw new Error(`Service "${serviceName}" not found`);
    }

    const port = service.tunnelPort || service.targetPort;
    const host = 'localhost';

    let connectionString = '';
    let envVar = 'SERVICE_URL';

    if (service.targetPort === 5432 || service.protocol === 'postgres') {
      connectionString = `postgres://${host}:${port}/postgres`;
      envVar = 'DATABASE_URL';
    } else if (service.targetPort === 3306 || service.protocol === 'mysql') {
      connectionString = `mysql://${host}:${port}`;
      envVar = 'DATABASE_URL';
    } else if (service.targetPort === 6379 || service.protocol === 'redis') {
      connectionString = `redis://${host}:${port}`;
      envVar = 'REDIS_URL';
    } else if (service.targetPort === 27017 || service.protocol === 'mongodb') {
      connectionString = `mongodb://${host}:${port}`;
      envVar = 'MONGODB_URI';
    } else if (service.protocol === 'http' || service.protocol === 'https') {
      connectionString = `http://${host}:${port}`;
      envVar = 'API_URL';
    } else {
      connectionString = `tcp://${host}:${port}`;
      envVar = `${serviceName.toUpperCase().replace(/-/g, '_')}_URL`;
    }

    return { service: serviceName, host, port, connectionString, envVar };
  }

  private getGrantConnection(serviceName: string, grantToken: string): Connection {
    const hubUrl = this.client.hubUrl;
    const grantEndpoint = `${hubUrl}/grant/${encodeURIComponent(serviceName)}`;

    return {
      service: serviceName,
      host: new URL(hubUrl).hostname,
      port: new URL(hubUrl).port ? parseInt(new URL(hubUrl).port, 10) : 443,
      connectionString: grantEndpoint,
      envVar: 'GRANT_URL',
      grantToken,
      grantEndpoint,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Grants API
// ─────────────────────────────────────────────────────────────────────────────

export class GrantsAPI {
  constructor(private client: PrivateConnect) {}

  /**
   * Create a time-limited access grant for an AI agent or external consumer.
   */
  async create(options: GrantCreateOptions): Promise<Grant> {
    const response = await this.client.fetch('/v1/grants', {
      method: 'POST',
      body: JSON.stringify(options),
    });
    const data = await response.json();
    return data.grant;
  }

  /**
   * List active grants in the workspace.
   */
  async list(options?: { includeExpired?: boolean }): Promise<Grant[]> {
    const params = new URLSearchParams();
    if (options?.includeExpired) params.set('includeExpired', 'true');
    const response = await this.client.fetch(`/v1/grants?${params}`);
    const data = await response.json();
    return data.grants || [];
  }

  /**
   * Revoke an active grant immediately.
   */
  async revoke(grantId: string): Promise<void> {
    await this.client.fetch(`/v1/grants/${grantId}`, { method: 'DELETE' });
  }

  /**
   * Validate a grant token (public endpoint — no API key required).
   * Returns the grant if valid, null otherwise.
   */
  async validate(token: string): Promise<Grant | null> {
    try {
      const url = `${this.client.hubUrl}/v1/grants/validate`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data.valid ? data.grant : null;
    } catch {
      return null;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Client
// ─────────────────────────────────────────────────────────────────────────────

export class PrivateConnect {
  private config: { apiKey: string; hubUrl: string; agentId?: string };

  /** Agents API for discovery and orchestration */
  public agents: AgentsAPI;

  /** Services API for connecting to services */
  public services: ServicesAPI;

  /** Grants API for managing time-limited access tokens */
  public grants: GrantsAPI;

  constructor(config: PrivateConnectConfig) {
    this.config = {
      apiKey: config.apiKey,
      hubUrl: config.hubUrl || 'https://api.privateconnect.co',
      agentId: config.agentId || detectAgentId(),
    };

    this.agents = new AgentsAPI(this);
    this.services = new ServicesAPI(this);
    this.grants = new GrantsAPI(this);

    if (!config.disableTracking) {
      trackSdkUsage(this.config.hubUrl);
    }
  }

  /** The resolved agent ID, or undefined if not configured. */
  get agentId(): string | undefined {
    return this.config.agentId;
  }

  /** The hub URL this client is connected to. */
  get hubUrl(): string {
    return this.config.hubUrl;
  }

  /**
   * Shorthand: get connection details for a service.
   * Pass `grantToken` to connect via the grant proxy instead of a local tunnel.
   */
  async connect(serviceName: string, options?: { grantToken?: string }): Promise<Connection> {
    return this.services.getConnection(serviceName, options);
  }

  /**
   * Returns the agent ID or throws if not configured.
   * Used by APIs that require an authenticated agent identity.
   */
  requireAgentId(): string {
    if (!this.config.agentId) {
      throw new Error(
        'Agent ID not found. Either:\n' +
        '  1. Run "connect up" to register this machine, or\n' +
        '  2. Set PRIVATECONNECT_AGENT_ID environment variable, or\n' +
        '  3. Pass agentId in the PrivateConnect constructor.'
      );
    }
    return this.config.agentId;
  }

  /** Internal fetch with API key auth. */
  async fetch(path: string, options?: RequestInit): Promise<Response> {
    const url = `${this.config.hubUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': this.config.apiKey,
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `Request failed: ${response.status}`);
    }

    return response;
  }
}

export default PrivateConnect;

/** Convenience function for quick one-off connections. */
export async function connect(
  serviceName: string,
  config?: PrivateConnectConfig & { grantToken?: string },
): Promise<Connection> {
  const apiKey = config?.apiKey || process.env.PRIVATECONNECT_API_KEY;
  if (!apiKey) {
    throw new Error('API key required. Set PRIVATECONNECT_API_KEY or pass config.apiKey');
  }

  const client = new PrivateConnect({ ...config, apiKey });
  return client.connect(serviceName, { grantToken: config?.grantToken });
}
