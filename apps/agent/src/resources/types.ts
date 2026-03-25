// ─────────────────────────────────────────────────────────────────────────────
// Resource Registry Types
// ─────────────────────────────────────────────────────────────────────────────

export const RESOURCE_TYPES = ['postgres', 'mysql', 'redis', 'http', 'generic-tcp'] as const;
export type ResourceType = typeof RESOURCE_TYPES[number];

export const ACCESS_MODES = ['tcp', 'http'] as const;
export type AccessMode = typeof ACCESS_MODES[number];

export const TRANSPORT_MODES = ['direct', 'hub'] as const;
export type TransportVia = typeof TRANSPORT_MODES[number];

export interface ResourceAccessConfig {
  mode: AccessMode;
  via?: TransportVia;
}

export interface ResourceConfig {
  type: ResourceType;
  host?: string;
  port?: number;
  targetHost?: string;
  targetPort?: number;
  url?: string;
  access: ResourceAccessConfig;
}

export interface ResourcesMap {
  [name: string]: ResourceConfig;
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolved resource — normalized from config with all ambiguity resolved
// ─────────────────────────────────────────────────────────────────────────────

export interface ResolvedResource {
  name: string;
  type: ResourceType;
  targetHost: string;
  targetPort: number;
  accessMode: AccessMode;
  via: TransportVia;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceSession {
  id: string;
  resourceName: string;
  resourceType: ResourceType;
  createdAt: string;
  expiresAt: string;
  endpoint: string;
  localPort: number | null;
  protocol: string;
  status: 'active' | 'expired' | 'closed';
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON output contracts
// ─────────────────────────────────────────────────────────────────────────────

export interface ResourceConnectSuccess {
  ok: true;
  session: {
    id: string;
    resource: string;
    type: ResourceType;
    protocol: string;
    endpoint: string;
    expiresAt: string;
    expiresInSeconds: number;
    suggestedName: string;
  };
}

export interface ResourceConnectError {
  ok: false;
  error: {
    code: ResourceErrorCode;
    message: string;
  };
}

export type ResourceConnectResult = ResourceConnectSuccess | ResourceConnectError;

export const RESOURCE_ERROR_CODES = [
  'RESOURCE_NOT_FOUND',
  'CONFIG_NOT_FOUND',
  'CONFIG_INVALID',
  'PORT_UNAVAILABLE',
  'CONNECTION_FAILED',
  'TARGET_UNREACHABLE',
  'HUB_NOT_CONFIGURED',
] as const;

export type ResourceErrorCode = typeof RESOURCE_ERROR_CODES[number];

export interface ResourceListSuccess {
  ok: true;
  resources: Array<{
    name: string;
    type: ResourceType;
    target: string;
    via: TransportVia;
  }>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Config types — expose: section in pconnect.yml
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedExposeEntry {
  name: string;
  target: string;
  public?: boolean;
  expires?: string;
}
