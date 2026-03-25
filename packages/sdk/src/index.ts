/**
 * Private Connect SDK
 *
 * Define your connections in pconnect.yml. Access them from anywhere.
 *
 * @example
 * ```typescript
 * import { PrivateConnect } from '@privateconnect/sdk';
 *
 * // Load your project's connection manifest
 * const pc = PrivateConnect.fromManifest();
 *
 * // Get a resource declared in pconnect.yml
 * const db = pc.resource('staging-db');
 * console.log(db.connectionString); // postgres://internal-db:5432
 * console.log(db.envVar);           // DATABASE_URL
 *
 * // With an API key, you also get hub API access
 * const pc2 = PrivateConnect.fromManifest('./pconnect.yml', {
 *   apiKey: process.env.PRIVATECONNECT_API_KEY,
 * });
 * const grant = await pc2.grants.create({
 *   agentLabel: 'claude',
 *   resourceType: 'db',
 *   resourceName: 'postgres',
 *   ttl: '5m',
 * });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PrivateConnectConfig {
  /** API key for authentication. Required for hub API calls; optional for manifest-only usage. */
  apiKey?: string;
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
  tokenPrefix?: string;
  persistent: boolean;
  expiresAt: string | null;
  expiresInMinutes?: number | null;
  token?: string;
  endpoint?: string;
}

export interface GrantCreateOptions {
  agentLabel: string;
  resourceType: 'db' | 'api' | 'path';
  resourceName: string;
  scope?: 'read-only' | 'full';
  /** Duration string: 60s, 5m, 1h, 1d. Omit for persistent grant. */
  ttl?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest Types
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCE_TYPES = ['postgres', 'mysql', 'redis', 'http', 'generic-tcp'] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

export const ACCESS_MODES = ['tcp', 'http'] as const;
export type AccessMode = typeof ACCESS_MODES[number];

export const TRANSPORT_MODES = ['direct', 'hub'] as const;
export type TransportVia = typeof TRANSPORT_MODES[number];

export interface ManifestResourceConfig {
  type: ResourceType;
  host?: string;
  port?: number;
  targetHost?: string;
  targetPort?: number;
  url?: string;
  access: { mode: AccessMode; via?: TransportVia };
}

export interface ManifestResource {
  name: string;
  type: ResourceType;
  host: string;
  port: number;
  connectionString: string;
  envVar: string;
  accessMode: AccessMode;
  via: TransportVia;
}

// ─────────────────────────────────────────────────────────────────────────────
// Manifest Parsing
// ─────────────────────────────────────────────────────────────────────────────

const MANIFEST_FILENAMES = [
  'pconnect.yml',
  'pconnect.yaml',
  'pconnect.json',
  '.pconnect.yml',
  '.pconnect.yaml',
  '.pconnect.json',
];

const DEFAULT_PORTS: Record<ResourceType, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  http: 80,
  'generic-tcp': 0,
};

const PROTOCOL_SCHEMES: Record<ResourceType, string> = {
  postgres: 'postgres',
  mysql: 'mysql',
  redis: 'redis',
  http: 'http',
  'generic-tcp': 'tcp',
};

const ENV_VAR_MAP: Record<ResourceType, string> = {
  postgres: 'DATABASE_URL',
  mysql: 'DATABASE_URL',
  redis: 'REDIS_URL',
  http: 'API_URL',
  'generic-tcp': 'TCP_URL',
};

function findManifest(startDir?: string): string | null {
  let dir = startDir || process.cwd();

  for (let depth = 0; depth < 4; depth++) {
    for (const filename of MANIFEST_FILENAMES) {
      const filePath = path.join(dir, filename);
      if (fs.existsSync(filePath)) return filePath;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

function parseManifestFile(filePath: string): Record<string, ManifestResourceConfig> {
  const content = fs.readFileSync(filePath, 'utf-8');
  let raw: Record<string, unknown>;

  if (filePath.endsWith('.json')) {
    raw = JSON.parse(content);
  } else {
    raw = yaml.load(content) as Record<string, unknown>;
  }

  if (!raw || typeof raw !== 'object' || !raw.resources || typeof raw.resources !== 'object') {
    return {};
  }

  const resources: Record<string, ManifestResourceConfig> = {};
  const rawResources = raw.resources as Record<string, unknown>;

  for (const [name, value] of Object.entries(rawResources)) {
    if (!value || typeof value !== 'object') continue;
    const obj = value as Record<string, unknown>;

    const type = obj.type as string;
    if (!RESOURCE_TYPES.includes(type as ResourceType)) continue;

    const accessObj = (obj.access && typeof obj.access === 'object')
      ? obj.access as Record<string, unknown>
      : { mode: 'tcp' };

    resources[name] = {
      type: type as ResourceType,
      host: typeof obj.host === 'string' ? obj.host : undefined,
      port: typeof obj.port === 'number' ? obj.port : undefined,
      targetHost: typeof obj.targetHost === 'string' ? obj.targetHost : undefined,
      targetPort: typeof obj.targetPort === 'number' ? obj.targetPort : undefined,
      url: typeof obj.url === 'string' ? obj.url : undefined,
      access: {
        mode: (ACCESS_MODES.includes(accessObj.mode as AccessMode)
          ? accessObj.mode
          : 'tcp') as AccessMode,
        via: (TRANSPORT_MODES.includes(accessObj.via as TransportVia)
          ? accessObj.via
          : 'direct') as TransportVia,
      },
    };
  }

  return resources;
}

function resolveManifestResource(name: string, config: ManifestResourceConfig): ManifestResource {
  let host: string;
  let port: number;

  if (config.type === 'http' && config.url) {
    try {
      const parsed = new URL(config.url);
      host = parsed.hostname;
      port = parsed.port ? parseInt(parsed.port, 10) : (parsed.protocol === 'https:' ? 443 : 80);
    } catch {
      host = config.host || config.targetHost || 'localhost';
      port = config.port || config.targetPort || DEFAULT_PORTS[config.type];
    }
  } else {
    host = config.targetHost || config.host || 'localhost';
    port = config.targetPort || config.port || DEFAULT_PORTS[config.type];
  }

  const scheme = PROTOCOL_SCHEMES[config.type];
  const connectionString = `${scheme}://${host}:${port}`;

  const envVar = ENV_VAR_MAP[config.type]
    || `${name.toUpperCase().replace(/-/g, '_')}_URL`;

  return {
    name,
    type: config.type,
    host,
    port,
    connectionString,
    envVar,
    accessMode: config.access.mode,
    via: config.access.via || 'direct',
  };
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

    let connectionString: string;
    let envVar: string;

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
  private config: { apiKey?: string; hubUrl: string; agentId?: string };
  private manifest: Map<string, ManifestResource> = new Map();
  private manifestPath?: string;

  /** Agents API for discovery and orchestration */
  public agents: AgentsAPI;

  /** Services API for connecting to services */
  public services: ServicesAPI;

  /** Grants API for managing scoped access tokens (time-limited or persistent) */
  public grants: GrantsAPI;

  constructor(config: PrivateConnectConfig = {}) {
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

  // ─────────────────────────────────────────────────────────────────────────
  // Manifest API — the primary way to use the SDK
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Load a pconnect.yml manifest and return a configured client.
   *
   * Auto-discovers pconnect.yml in the current directory (or parents) if no
   * path is given. Pass a config to also enable hub API access.
   *
   * @example
   * ```typescript
   * const pc = PrivateConnect.fromManifest();
   * const db = pc.resource('staging-db');
   * console.log(db.connectionString); // postgres://internal-db:5432
   * ```
   */
  static fromManifest(
    manifestPath?: string,
    config?: PrivateConnectConfig,
  ): PrivateConnect {
    const resolvedPath = manifestPath
      ? path.resolve(manifestPath)
      : findManifest();

    if (!resolvedPath) {
      throw new Error(
        'No pconnect.yml found. Create one in your project root:\n\n' +
        '  resources:\n' +
        '    staging-db:\n' +
        '      type: postgres\n' +
        '      host: internal-db\n' +
        '      port: 5432\n' +
        '      access:\n' +
        '        mode: tcp\n'
      );
    }

    const instance = new PrivateConnect(config || { disableTracking: true });
    instance.manifestPath = resolvedPath;

    const rawResources = parseManifestFile(resolvedPath);
    for (const [name, rawConfig] of Object.entries(rawResources)) {
      instance.manifest.set(name, resolveManifestResource(name, rawConfig));
    }

    return instance;
  }

  /**
   * Get a resource declared in pconnect.yml by name.
   *
   * Returns its type, host, port, connection string, and suggested env var.
   * When `connect dev` is running, the connection string points to a live
   * local tunnel.
   */
  resource(name: string): ManifestResource {
    const r = this.manifest.get(name);
    if (!r) {
      const available = Array.from(this.manifest.keys());
      const msg = available.length
        ? `Available: ${available.join(', ')}`
        : 'No resources loaded. Did you call PrivateConnect.fromManifest()?';
      throw new Error(`Resource "${name}" not found. ${msg}`);
    }
    return r;
  }

  /**
   * List all resources declared in the loaded manifest.
   */
  resources(): ManifestResource[] {
    return Array.from(this.manifest.values());
  }

  /**
   * Generate a `.env`-compatible block for all manifest resources.
   *
   * @example
   * ```typescript
   * const pc = PrivateConnect.fromManifest();
   * console.log(pc.envBlock());
   * // DATABASE_URL=postgres://internal-db:5432
   * // REDIS_URL=redis://redis.internal:6379
   * ```
   */
  envBlock(): string {
    return this.resources()
      .map(r => `${r.envVar}=${r.connectionString}`)
      .join('\n');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Existing APIs
  // ─────────────────────────────────────────────────────────────────────────

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

  /** Requires an API key or throws. */
  private requireApiKey(): string {
    if (!this.config.apiKey) {
      throw new Error(
        'API key required for hub API calls. Either:\n' +
        '  1. Set PRIVATECONNECT_API_KEY environment variable, or\n' +
        '  2. Pass apiKey in the config.'
      );
    }
    return this.config.apiKey;
  }

  /** Internal fetch with API key auth. */
  async fetch(urlPath: string, options?: RequestInit): Promise<Response> {
    const apiKey = this.requireApiKey();
    const url = `${this.config.hubUrl}${urlPath}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        'x-api-key': apiKey,
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

/** Convenience function for quick one-off connections via the hub API. */
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

/**
 * Load pconnect.yml and get a resource by name.
 * Shorthand for `PrivateConnect.fromManifest().resource(name)`.
 */
export function fromManifest(manifestPath?: string): PrivateConnect {
  return PrivateConnect.fromManifest(manifestPath);
}
