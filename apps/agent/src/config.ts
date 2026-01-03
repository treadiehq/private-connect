import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface AgentConfig {
  agentId: string;
  token: string;
  tokenExpiresAt?: string;  // ISO date string for token expiry
  apiKey: string;           // Workspace API key
  hubUrl: string;
  label: string;            // Environment label
  name?: string;
  workspaceId?: string;
}

export interface TokenExpiryStatus {
  expired: boolean;
  expiringSoon: boolean;
  daysLeft?: number;
  invalidDate?: boolean;
}

export interface ConfigLoadOptions {
  verbose?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.private-connect');
const DEFAULT_CONFIG_FILE = path.join(DEFAULT_CONFIG_DIR, 'config.json');

// Restrictive file permissions: owner read/write only (0600)
const CONFIG_FILE_MODE = 0o600;
const CONFIG_DIR_MODE = 0o700;

// Active config path (can be overridden)
let activeConfigPath: string = DEFAULT_CONFIG_FILE;

// ─────────────────────────────────────────────────────────────────────────────
// Path Management
// ─────────────────────────────────────────────────────────────────────────────

export function setConfigPath(customPath?: string): void {
  if (customPath) {
    // Resolve to absolute path
    activeConfigPath = path.resolve(customPath);
  } else {
    activeConfigPath = DEFAULT_CONFIG_FILE;
  }
}

export function getConfigPath(): string {
  return activeConfigPath;
}

export function getConfigDir(): string {
  return path.dirname(activeConfigPath);
}

export function getDefaultConfigDir(): string {
  return DEFAULT_CONFIG_DIR;
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate token format (64 hex characters)
 */
export function isValidToken(token: string): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Validate UUID v4 format specifically
 */
function isValidUUID(id: string): boolean {
  if (typeof id !== 'string') return false;
  // UUID v4 has '4' in the version position and [89ab] in the variant position
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validate ISO 8601 date string format
 */
function isValidISODate(dateStr: string): boolean {
  if (typeof dateStr !== 'string') return false;
  const date = new Date(dateStr);
  return !isNaN(date.getTime()) && date.toISOString().slice(0, 10) === dateStr.slice(0, 10);
}

/**
 * Validate config structure and fields
 */
function validateConfig(config: unknown, options?: ConfigLoadOptions): config is AgentConfig {
  if (!config || typeof config !== 'object') {
    if (options?.verbose) console.error('[config] Invalid: not an object');
    return false;
  }
  const c = config as Record<string, unknown>;

  // Required fields
  if (!c.agentId || !isValidUUID(c.agentId as string)) {
    if (options?.verbose) console.error('[config] Invalid: agentId missing or invalid UUID v4');
    return false;
  }
  if (!c.token || !isValidToken(c.token as string)) {
    if (options?.verbose) console.error('[config] Invalid: token missing or invalid format');
    return false;
  }
  if (!c.apiKey || typeof c.apiKey !== 'string' || c.apiKey.length < 10) {
    if (options?.verbose) console.error('[config] Invalid: apiKey missing or too short');
    return false;
  }
  if (!c.hubUrl || typeof c.hubUrl !== 'string') {
    if (options?.verbose) console.error('[config] Invalid: hubUrl missing');
    return false;
  }
  if (!c.label || typeof c.label !== 'string') {
    if (options?.verbose) console.error('[config] Invalid: label missing');
    return false;
  }

  // Optional field validation
  if (c.tokenExpiresAt !== undefined) {
    if (typeof c.tokenExpiresAt !== 'string' || !isValidISODate(c.tokenExpiresAt)) {
      if (options?.verbose) console.error('[config] Warning: tokenExpiresAt is not a valid ISO date');
      // Don't fail validation, but the field will be treated as invalid when checking expiry
    }
  }

  return true;
}

// ─────────────────────────────────────────────────────────────────────────────
// File Operations
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Set restrictive permissions on a file (Unix only)
 */
function setSecurePermissions(filePath: string, mode: number): void {
  try {
    // Only works on Unix-like systems
    if (process.platform !== 'win32') {
      fs.chmodSync(filePath, mode);
    }
  } catch {
    // Ignore permission errors (e.g., on some filesystems)
  }
}

export function loadConfig(customPath?: string, options?: ConfigLoadOptions): AgentConfig | null {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  try {
    if (!fs.existsSync(configFile)) {
      if (options?.verbose) console.error(`[config] File not found: ${configFile}`);
      return null;
    }
    const data = fs.readFileSync(configFile, 'utf-8');
    
    let config: unknown;
    try {
      config = JSON.parse(data);
    } catch (parseError) {
      const msg = parseError instanceof Error ? parseError.message : 'Unknown error';
      if (options?.verbose) {
        console.error(`[config] JSON parse error: ${msg}`);
      } else {
        console.error('Warning: Config file is corrupted. Run "connect up" to reconfigure.');
      }
      return null;
    }

    // Validate config structure
    if (!validateConfig(config, options)) {
      if (!options?.verbose) {
        console.error('Warning: Config file has invalid format. Run "connect up" to reconfigure.');
      }
      return null;
    }

    return config;
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    if (options?.verbose) {
      console.error(`[config] Load error: ${msg}`);
    }
    return null;
  }
}

export function saveConfig(config: AgentConfig, customPath?: string): void {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  const configDir = path.dirname(configFile);

  // Create directory with restrictive permissions
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: CONFIG_DIR_MODE });
  }

  // Write config file
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2), { mode: CONFIG_FILE_MODE });

  // Ensure permissions are set (in case file already existed)
  setSecurePermissions(configFile, CONFIG_FILE_MODE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Config Management
// ─────────────────────────────────────────────────────────────────────────────

export function generateConfig(
  hubUrl: string,
  apiKey: string,
  label?: string,
  name?: string,
  customPath?: string
): AgentConfig {
  const hostname = os.hostname();

  const config: AgentConfig = {
    agentId: uuidv4(),
    token: crypto.randomBytes(32).toString('hex'),
    apiKey,
    hubUrl,
    label: label || hostname,
    name,
  };
  saveConfig(config, customPath);
  return config;
}

export interface EnsureConfigOptions {
  hubUrl?: string;
  apiKey?: string;
  label?: string;
  name?: string;
  customPath?: string;
  /** If true, only update fields that are explicitly provided */
  preserveExisting?: boolean;
}

export function ensureConfig(
  hubUrl: string,
  apiKey?: string,
  label?: string,
  name?: string,
  customPath?: string
): AgentConfig {
  let config = loadConfig(customPath);

  if (!config) {
    if (!apiKey) {
      throw new Error('API key required for first-time setup. Use --api-key flag.');
    }
    config = generateConfig(hubUrl, apiKey, label, name, customPath);
  } else {
    let updated = false;

    // Only update hubUrl if it's different (avoid unnecessary overwrites)
    if (hubUrl && config.hubUrl !== hubUrl) {
      config.hubUrl = hubUrl;
      updated = true;
    }
    if (apiKey && config.apiKey !== apiKey) {
      config.apiKey = apiKey;
      updated = true;
    }
    if (label && config.label !== label) {
      config.label = label;
      updated = true;
    }
    if (name !== undefined && config.name !== name) {
      config.name = name;
      updated = true;
    }

    if (updated) {
      saveConfig(config, customPath);
    }
  }
  return config;
}

export function getDefaultLabel(): string {
  return os.hostname();
}

export function clearConfig(customPath?: string): boolean {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  try {
    if (fs.existsSync(configFile)) {
      fs.unlinkSync(configFile);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Token Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Update the agent token (used for token rotation)
 * @returns true if successful, false if config not found or token invalid
 */
export function updateToken(
  newToken: string,
  expiresAt?: string,
  customPath?: string
): { success: boolean; error?: string } {
  // Validate token format
  if (!isValidToken(newToken)) {
    return { success: false, error: 'Invalid token format (expected 64 hex characters)' };
  }

  // Validate expiry date if provided
  if (expiresAt !== undefined && !isValidISODate(expiresAt)) {
    return { success: false, error: 'Invalid expiry date format (expected ISO 8601)' };
  }

  const config = loadConfig(customPath);
  if (!config) {
    return { success: false, error: 'Config not found' };
  }

  config.token = newToken;
  config.tokenExpiresAt = expiresAt;
  saveConfig(config, customPath);
  return { success: true };
}

/**
 * Check token expiry status
 * @returns Object with expired, expiringSoon, daysLeft, and invalidDate flags
 */
export function isTokenExpiringSoon(customPath?: string): TokenExpiryStatus {
  const config = loadConfig(customPath);
  if (!config?.tokenExpiresAt) {
    // No expiry date set - token doesn't expire
    return { expired: false, expiringSoon: false };
  }

  const expiryDate = new Date(config.tokenExpiresAt);

  // Check for invalid date
  if (isNaN(expiryDate.getTime())) {
    return { expired: false, expiringSoon: false, invalidDate: true };
  }

  const now = new Date();
  const msLeft = expiryDate.getTime() - now.getTime();
  const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

  // Already expired
  if (daysLeft <= 0) {
    return { expired: true, expiringSoon: false, daysLeft: 0 };
  }

  // Expiring within 7 days
  if (daysLeft <= 7) {
    return { expired: false, expiringSoon: true, daysLeft };
  }

  // Not expiring soon
  return { expired: false, expiringSoon: false, daysLeft };
}

/**
 * Check if token is expired
 */
export function isTokenExpired(customPath?: string): boolean {
  return isTokenExpiringSoon(customPath).expired;
}
