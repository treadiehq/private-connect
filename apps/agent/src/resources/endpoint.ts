import { ResourceType } from './types';

// ─────────────────────────────────────────────────────────────────────────────
// Protocol-aware endpoint formatting
// ─────────────────────────────────────────────────────────────────────────────

const PROTOCOL_SCHEMES: Record<ResourceType, string> = {
  postgres: 'postgres',
  mysql: 'mysql',
  redis: 'redis',
  http: 'http',
  'generic-tcp': 'tcp',
};

const DEFAULT_PORTS: Record<ResourceType, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  http: 80,
  'generic-tcp': 0,
};

/**
 * Format a usable endpoint URL for the given resource type.
 * Always returns a protocol-prefixed URI.
 */
export function formatEndpoint(type: ResourceType, host: string, port: number): string {
  const scheme = PROTOCOL_SCHEMES[type];
  return `${scheme}://${host}:${port}`;
}

/**
 * Get the suggested `.pc` name for a resource.
 */
export function suggestedName(resourceName: string): string {
  return `${resourceName}.pc`;
}

/**
 * Get the default port for a resource type.
 */
export function defaultPortForType(type: ResourceType): number {
  return DEFAULT_PORTS[type];
}

