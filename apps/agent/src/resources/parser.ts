import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  ResourceConfig,
  ResourcesMap,
  ResolvedResource,
  ResourceType,
  RESOURCE_TYPES,
  ACCESS_MODES,
  TRANSPORT_MODES,
  AccessMode,
  TransportVia,
  ParsedExposeEntry,
} from './types';
import { defaultPortForType } from './endpoint';

// ─────────────────────────────────────────────────────────────────────────────
// Config file discovery
// ─────────────────────────────────────────────────────────────────────────────

const CONFIG_FILENAMES = [
  'pconnect.yml',
  'pconnect.yaml',
  'pconnect.json',
  '.pconnect.yml',
  '.pconnect.yaml',
  '.pconnect.json',
];

export function findResourceConfig(startDir?: string): string | null {
  let dir = startDir || process.cwd();

  for (let depth = 0; depth < 4; depth++) {
    for (const filename of CONFIG_FILENAMES) {
      const configPath = path.join(dir, filename);
      if (fs.existsSync(configPath)) {
        return configPath;
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return null;
}

export const findProjectConfig = findResourceConfig;

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

export class ConfigValidationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly resourceName?: string,
  ) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

function validateResourceType(value: unknown, name: string): ResourceType {
  if (!value || typeof value !== 'string') {
    throw new ConfigValidationError(
      `Resource "${name}" is missing "type". Supported types: ${RESOURCE_TYPES.join(', ')}`,
      'type',
      name,
    );
  }
  if (!RESOURCE_TYPES.includes(value as ResourceType)) {
    throw new ConfigValidationError(
      `Resource "${name}" has invalid type "${value}". Supported: ${RESOURCE_TYPES.join(', ')}`,
      'type',
      name,
    );
  }
  return value as ResourceType;
}

function validateAccessMode(value: unknown, name: string): AccessMode {
  if (!value || typeof value !== 'string') {
    throw new ConfigValidationError(
      `Resource "${name}" access.mode is required. Use "tcp" or "http".`,
      'access.mode',
      name,
    );
  }
  if (!ACCESS_MODES.includes(value as AccessMode)) {
    throw new ConfigValidationError(
      `Resource "${name}" has invalid access.mode "${value}". Supported: ${ACCESS_MODES.join(', ')}`,
      'access.mode',
      name,
    );
  }
  return value as AccessMode;
}

function validateTransportVia(value: unknown, name: string): TransportVia {
  if (value === undefined || value === null) return 'direct';
  if (typeof value !== 'string' || !TRANSPORT_MODES.includes(value as TransportVia)) {
    throw new ConfigValidationError(
      `Resource "${name}" has invalid access.via "${value}". Supported: ${TRANSPORT_MODES.join(', ')}`,
      'access.via',
      name,
    );
  }
  return value as TransportVia;
}

function validatePort(value: unknown, name: string, field: string): number | undefined {
  if (value === undefined || value === null) return undefined;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new ConfigValidationError(
      `Resource "${name}" has invalid ${field}: ${value} (must be 1-65535)`,
      field,
      name,
    );
  }
  return port;
}

function validateResource(name: string, raw: unknown): ResourceConfig {
  if (!raw || typeof raw !== 'object') {
    throw new ConfigValidationError(
      `Resource "${name}" must be an object with at least "type" and "access" fields.`,
      name,
      name,
    );
  }

  const obj = raw as Record<string, unknown>;
  const type = validateResourceType(obj.type, name);

  // Validate target specification
  if (type === 'http') {
    if (!obj.url && !obj.host && !obj.targetHost) {
      throw new ConfigValidationError(
        `HTTP resource "${name}" requires "url" or "host". Example:\n  ${name}:\n    type: http\n    url: http://service.internal:3000`,
        'url',
        name,
      );
    }
  } else {
    if (!obj.host && !obj.targetHost) {
      throw new ConfigValidationError(
        `Resource "${name}" requires "host" (or "targetHost"). Example:\n  ${name}:\n    type: ${type}\n    host: db.internal\n    port: ${defaultPortForType(type)}`,
        'host',
        name,
      );
    }
  }

  // Validate access block
  if (!obj.access || typeof obj.access !== 'object') {
    throw new ConfigValidationError(
      `Resource "${name}" is missing "access" block. Example:\n  ${name}:\n    ...\n    access:\n      mode: tcp`,
      'access',
      name,
    );
  }

  const accessObj = obj.access as Record<string, unknown>;
  const accessMode = validateAccessMode(accessObj.mode, name);
  const via = validateTransportVia(accessObj.via, name);

  return {
    type,
    host: typeof obj.host === 'string' ? obj.host : undefined,
    port: validatePort(obj.port, name, 'port'),
    targetHost: typeof obj.targetHost === 'string' ? obj.targetHost : undefined,
    targetPort: validatePort(obj.targetPort, name, 'targetPort'),
    url: typeof obj.url === 'string' ? obj.url : undefined,
    access: { mode: accessMode, via },
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Parsing
// ─────────────────────────────────────────────────────────────────────────────

export interface ParsedProjectConfig {
  resources: ResourcesMap;
  expose: ParsedExposeEntry[];
  hub?: string;
}

function parseExposeMap(raw: unknown): ParsedExposeEntry[] {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];

  const entries: ParsedExposeEntry[] = [];
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const e = value as Record<string, unknown>;
    entries.push({
      name,
      target: typeof e.target === 'string' ? e.target : '',
      public: e.public === true,
      expires: typeof e.expires === 'string' ? e.expires : undefined,
    });
  }
  return entries;
}

/**
 * Parse a pconnect.yml / .json file. Extracts:
 *   - resources: (named map with type, host, port, access)
 *   - expose:    (map — expose block)
 * Validates each resource strictly with friendly error messages.
 */
export function parseResourceConfig(configPath: string): ParsedProjectConfig {
  const content = fs.readFileSync(configPath, 'utf-8');
  let raw: Record<string, unknown>;

  if (configPath.endsWith('.json')) {
    try {
      raw = JSON.parse(content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new ConfigValidationError(`Failed to parse JSON config: ${msg}`, 'file');
    }
  } else {
    try {
      raw = yaml.load(content) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      throw new ConfigValidationError(`Failed to parse YAML config: ${msg}`, 'file');
    }
  }

  if (!raw || typeof raw !== 'object') {
    throw new ConfigValidationError('Config file is empty or not an object.', 'file');
  }

  const resources: ResourcesMap = {};

  if (raw.resources && typeof raw.resources === 'object' && !Array.isArray(raw.resources)) {
    const rawResources = raw.resources as Record<string, unknown>;

    for (const [name, value] of Object.entries(rawResources)) {
      if (/[^a-zA-Z0-9_-]/.test(name)) {
        throw new ConfigValidationError(
          `Resource name "${name}" contains invalid characters. Use only letters, numbers, hyphens, and underscores.`,
          'name',
          name,
        );
      }
      resources[name] = validateResource(name, value);
    }
  }

  return {
    resources,
    expose: parseExposeMap(raw.expose),
    hub: typeof raw.hub === 'string' ? raw.hub : undefined,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Resolution — normalize config into a fully resolved resource
// ─────────────────────────────────────────────────────────────────────────────

export function resolveResource(name: string, config: ResourceConfig): ResolvedResource {
  let targetHost: string;
  let targetPort: number;

  if (config.type === 'http' && config.url) {
    try {
      const parsed = new URL(config.url);
      targetHost = parsed.hostname;
      targetPort = parsed.port
        ? parseInt(parsed.port, 10)
        : (parsed.protocol === 'https:' ? 443 : 80);
    } catch {
      targetHost = config.host || config.targetHost || 'localhost';
      targetPort = config.port || config.targetPort || defaultPortForType(config.type);
    }
  } else {
    targetHost = config.targetHost || config.host || 'localhost';
    targetPort = config.targetPort || config.port || defaultPortForType(config.type);
  }

  return {
    name,
    type: config.type,
    targetHost,
    targetPort,
    accessMode: config.access.mode,
    via: config.access.via || 'direct',
  };
}

/**
 * Load and resolve all resources from config, or return null if no config found.
 */
export function loadResources(configPath?: string): {
  resources: Map<string, ResolvedResource>;
  rawConfig: ParsedProjectConfig;
  configPath: string;
} | null {
  const resolvedPath = configPath || findResourceConfig();
  if (!resolvedPath) return null;

  const parsed = parseResourceConfig(resolvedPath);
  const resources = new Map<string, ResolvedResource>();

  for (const [name, config] of Object.entries(parsed.resources)) {
    resources.set(name, resolveResource(name, config));
  }

  return { resources, rawConfig: parsed, configPath: resolvedPath };
}
