import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

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

const DEFAULT_CONFIG_DIR = path.join(os.homedir(), '.private-connect');
const DEFAULT_CONFIG_FILE = path.join(DEFAULT_CONFIG_DIR, 'config.json');

// Active config path (can be overridden)
let activeConfigPath: string = DEFAULT_CONFIG_FILE;

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

/**
 * Validate token format (64 hex characters)
 */
function isValidToken(token: string): boolean {
  return typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token);
}

/**
 * Validate UUID format
 */
function isValidUUID(id: string): boolean {
  return typeof id === 'string' && 
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validate config structure and fields
 */
function validateConfig(config: unknown): config is AgentConfig {
  if (!config || typeof config !== 'object') return false;
  const c = config as Record<string, unknown>;
  
  // Required fields
  if (!c.agentId || !isValidUUID(c.agentId as string)) return false;
  if (!c.token || !isValidToken(c.token as string)) return false;
  if (!c.apiKey || typeof c.apiKey !== 'string' || c.apiKey.length < 10) return false;
  if (!c.hubUrl || typeof c.hubUrl !== 'string') return false;
  if (!c.label || typeof c.label !== 'string') return false;
  
  return true;
}

export function loadConfig(customPath?: string): AgentConfig | null {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  try {
    if (!fs.existsSync(configFile)) {
      return null;
    }
    const data = fs.readFileSync(configFile, 'utf-8');
    const config = JSON.parse(data);
    
    // Validate config structure
    if (!validateConfig(config)) {
      console.error('Warning: Config file has invalid format. Run "connect up" to reconfigure.');
      return null;
    }
    
    return config;
  } catch {
    return null;
  }
}

export function saveConfig(config: AgentConfig, customPath?: string): void {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  const configDir = path.dirname(configFile);
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
}

export function generateConfig(hubUrl: string, apiKey: string, label?: string, name?: string, customPath?: string): AgentConfig {
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

export function ensureConfig(hubUrl: string, apiKey?: string, label?: string, name?: string, customPath?: string): AgentConfig {
  let config = loadConfig(customPath);
  
  if (!config) {
    if (!apiKey) {
      throw new Error('API key required for first-time setup. Use --api-key flag.');
    }
    config = generateConfig(hubUrl, apiKey, label, name, customPath);
  } else {
    // Update hub URL and optional fields if provided
    config.hubUrl = hubUrl;
    if (apiKey) config.apiKey = apiKey;
    if (label) config.label = label;
    if (name) config.name = name;
    saveConfig(config, customPath);
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

/**
 * Update the agent token (used for token rotation)
 */
export function updateToken(newToken: string, expiresAt?: string, customPath?: string): boolean {
  const config = loadConfig(customPath);
  if (!config) return false;
  
  config.token = newToken;
  config.tokenExpiresAt = expiresAt;
  saveConfig(config, customPath);
  return true;
}

/**
 * Check if the stored token is close to expiry
 */
export function isTokenExpiringSoon(customPath?: string): { expiringSoon: boolean; daysLeft?: number } {
  const config = loadConfig(customPath);
  if (!config?.tokenExpiresAt) {
    return { expiringSoon: false };
  }
  
  const expiryDate = new Date(config.tokenExpiresAt);
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  return {
    expiringSoon: daysLeft <= 7 && daysLeft > 0,
    daysLeft: daysLeft > 0 ? daysLeft : 0,
  };
}
