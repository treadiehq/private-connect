/**
 * Private Connect SDK
 * 
 * Programmatic access to Private Connect services and agent orchestration.
 * 
 * @example
 * ```typescript
 * import { PrivateConnect } from '@privateconnect/sdk';
 * 
 * const pc = new PrivateConnect({ apiKey: 'your-api-key' });
 * 
 * // Connect to a service
 * const db = await pc.connect('postgres-prod');
 * console.log(db.connectionString); // postgres://localhost:5432/...
 * 
 * // List all agents
 * const agents = await pc.agents.list();
 * 
 * // Send message to another agent
 * await pc.agents.sendMessage(targetAgentId, { action: 'deploy' });
 * ```
 */

export interface PrivateConnectConfig {
  /** API key for authentication */
  apiKey: string;
  /** Hub URL (default: https://api.privateconnect.co) */
  hubUrl?: string;
  /** Agent ID (auto-detected from config if not provided) */
  agentId?: string;
  /** Disable usage tracking (default: false) */
  disableTracking?: boolean;
}

// Track SDK usage (fire and forget)
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
  }).catch(() => {}); // Silently ignore errors
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

export interface Session {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  expiresAt: string;
  metadata?: Record<string, unknown>;
}

/**
 * Agents API for discovery and orchestration
 */
export class AgentsAPI {
  constructor(private client: PrivateConnect) {}

  /**
   * List all agents in the workspace
   */
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

  /**
   * Find agents by capability
   */
  async findByCapability(capability: string): Promise<Agent[]> {
    const response = await this.client.fetch(`/v1/agents/by-capability/${encodeURIComponent(capability)}`);
    const data = await response.json();
    return data.agents || [];
  }

  /**
   * Register capabilities for this agent
   */
  async registerCapabilities(capabilities: Array<{ name: string; metadata?: Record<string, unknown> }>): Promise<void> {
    await this.client.fetch(`/v1/agents/${this.client.agentId}/capabilities`, {
      method: 'POST',
      body: JSON.stringify({ capabilities }),
    });
  }

  /**
   * Send a message to another agent
   */
  async sendMessage(
    toAgentId: string,
    payload: Record<string, unknown>,
    options?: { channel?: string; type?: 'request' | 'response' | 'event' }
  ): Promise<{ messageId: string }> {
    const response = await this.client.fetch(`/v1/agents/${this.client.agentId}/messages/send`, {
      method: 'POST',
      body: JSON.stringify({ toAgentId, payload, ...options }),
    });
    return response.json();
  }

  /**
   * Broadcast a message to all online agents
   */
  async broadcast(
    payload: Record<string, unknown>,
    options?: { channel?: string }
  ): Promise<{ sent: number }> {
    const response = await this.client.fetch(`/v1/agents/${this.client.agentId}/messages/broadcast`, {
      method: 'POST',
      body: JSON.stringify({ payload, ...options }),
    });
    return response.json();
  }

  /**
   * Get messages for this agent
   */
  async getMessages(options?: { channel?: string; unreadOnly?: boolean; limit?: number }): Promise<Message[]> {
    const params = new URLSearchParams();
    if (options?.channel) params.set('channel', options.channel);
    if (options?.unreadOnly !== undefined) params.set('unreadOnly', String(options.unreadOnly));
    if (options?.limit) params.set('limit', String(options.limit));
    
    const response = await this.client.fetch(`/v1/agents/${this.client.agentId}/messages?${params}`);
    const data = await response.json();
    return data.messages || [];
  }

  /**
   * Mark messages as read
   */
  async markRead(messageIds: string[]): Promise<void> {
    await this.client.fetch(`/v1/agents/${this.client.agentId}/messages/read`, {
      method: 'POST',
      body: JSON.stringify({ messageIds }),
    });
  }
}

/**
 * Services API for connecting to and managing services
 */
export class ServicesAPI {
  constructor(private client: PrivateConnect) {}

  /**
   * List all services
   */
  async list(): Promise<Service[]> {
    const response = await this.client.fetch('/v1/services');
    return response.json();
  }

  /**
   * Get a specific service by name
   */
  async get(name: string): Promise<Service | null> {
    const services = await this.list();
    return services.find(s => s.name.toLowerCase() === name.toLowerCase()) || null;
  }

  /**
   * Get connection details for a service
   */
  async getConnection(serviceName: string): Promise<Connection> {
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

    return {
      service: serviceName,
      host,
      port,
      connectionString,
      envVar,
    };
  }
}

/**
 * Sessions API for ephemeral orchestration sessions
 */
export class SessionsAPI {
  private activeSessions = new Map<string, Session>();

  constructor(private client: PrivateConnect) {}

  /**
   * Create an orchestration session
   */
  async create(name: string, options?: { ttlMinutes?: number; metadata?: Record<string, unknown> }): Promise<Session> {
    const ttlMinutes = options?.ttlMinutes || 60;
    const sessionId = `${this.client.agentId}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    const session: Session = {
      id: sessionId,
      name,
      createdBy: this.client.agentId!,
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt.toISOString(),
      metadata: options?.metadata,
    };

    this.activeSessions.set(sessionId, session);

    // Broadcast session creation
    await this.client.agents.broadcast(
      { type: 'session:created', session },
      { channel: 'orchestration' }
    );

    return session;
  }

  /**
   * End an orchestration session
   */
  async end(sessionId: string): Promise<void> {
    this.activeSessions.delete(sessionId);

    // Broadcast session end
    await this.client.agents.broadcast(
      {
        type: 'session:ended',
        sessionId,
        endedBy: this.client.agentId,
        endedAt: new Date().toISOString(),
      },
      { channel: 'orchestration' }
    );
  }

  /**
   * Get active sessions
   */
  getActive(): Session[] {
    const now = new Date();
    const active: Session[] = [];
    
    for (const [id, session] of this.activeSessions) {
      if (new Date(session.expiresAt) > now) {
        active.push(session);
      } else {
        this.activeSessions.delete(id);
      }
    }
    
    return active;
  }
}

/**
 * Main Private Connect SDK client
 */
export class PrivateConnect {
  private config: { apiKey: string; hubUrl: string; agentId: string };
  
  /** Agents API for discovery and orchestration */
  public agents: AgentsAPI;
  
  /** Services API for connecting to services */
  public services: ServicesAPI;
  
  /** Sessions API for ephemeral orchestration */
  public sessions: SessionsAPI;

  constructor(config: PrivateConnectConfig) {
    this.config = {
      apiKey: config.apiKey,
      hubUrl: config.hubUrl || 'https://api.privateconnect.co',
      agentId: config.agentId || this.detectAgentId(),
    };

    this.agents = new AgentsAPI(this);
    this.services = new ServicesAPI(this);
    this.sessions = new SessionsAPI(this);

    // Track SDK usage (non-blocking)
    if (!config.disableTracking) {
      trackSdkUsage(this.config.hubUrl);
    }
  }

  /**
   * Get the agent ID
   */
  get agentId(): string | undefined {
    return this.config.agentId;
  }

  /**
   * Connect to a service and get connection details
   */
  async connect(serviceName: string): Promise<Connection> {
    return this.services.getConnection(serviceName);
  }

  /**
   * Internal fetch helper
   */
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

  /**
   * Try to detect agent ID from local config
   */
  private detectAgentId(): string {
    // In a real implementation, this would read from ~/.connect/config.json
    // For now, generate a default ID
    return `sdk-${Date.now()}`;
  }
}

// Default export
export default PrivateConnect;

// Convenience function
export async function connect(serviceName: string, config?: PrivateConnectConfig): Promise<Connection> {
  const apiKey = config?.apiKey || process.env.PRIVATECONNECT_API_KEY;
  if (!apiKey) {
    throw new Error('API key required. Set PRIVATECONNECT_API_KEY or pass config.apiKey');
  }
  
  const client = new PrivateConnect({ ...config, apiKey });
  return client.connect(serviceName);
}

