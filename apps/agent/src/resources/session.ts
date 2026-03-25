import { randomBytes } from 'crypto';
import { ResourceType, ResourceSession, ResourceConnectSuccess, ResourceConnectError, ResourceErrorCode } from './types';
import { formatEndpoint, suggestedName } from './endpoint';

// ─────────────────────────────────────────────────────────────────────────────
// TTL parsing
// ─────────────────────────────────────────────────────────────────────────────

const TTL_PATTERN = /^(\d+)(s|m|h)$/;
const DEFAULT_TTL_SECONDS = 900; // 15 minutes

/**
 * Parse a human TTL string (e.g. "15m", "1h", "300s") into seconds.
 * Returns default (900s = 15m) on invalid input.
 */
export function parseTtl(ttl: string | undefined): number {
  if (!ttl) return DEFAULT_TTL_SECONDS;

  const match = ttl.match(TTL_PATTERN);
  if (!match) return DEFAULT_TTL_SECONDS;

  const value = parseInt(match[1], 10);
  switch (match[2]) {
    case 's': return value;
    case 'm': return value * 60;
    case 'h': return value * 3600;
    default: return DEFAULT_TTL_SECONDS;
  }
}

/**
 * Format seconds into a human-readable duration string.
 */
export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}m`;
  }
  return `${seconds}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Session factory
// ─────────────────────────────────────────────────────────────────────────────

export function createSession(
  resourceName: string,
  resourceType: ResourceType,
  localPort: number,
  ttlSeconds: number,
): ResourceSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + ttlSeconds * 1000);

  return {
    id: `sess_${randomBytes(8).toString('hex')}`,
    resourceName,
    resourceType,
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    endpoint: formatEndpoint(resourceType, '127.0.0.1', localPort),
    localPort,
    protocol: resourceType === 'http' ? 'http' : 'tcp',
    status: 'active',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON output builders
// ─────────────────────────────────────────────────────────────────────────────

export function buildSuccessJson(session: ResourceSession): ResourceConnectSuccess {
  const expiresInSeconds = Math.max(
    0,
    Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
  );

  return {
    ok: true,
    session: {
      id: session.id,
      resource: session.resourceName,
      type: session.resourceType,
      protocol: session.protocol,
      endpoint: session.endpoint,
      expiresAt: session.expiresAt,
      expiresInSeconds,
      suggestedName: suggestedName(session.resourceName),
    },
  };
}

export function buildErrorJson(code: ResourceErrorCode, message: string): ResourceConnectError {
  return {
    ok: false,
    error: { code, message },
  };
}
