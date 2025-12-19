import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

export interface AgentConfig {
  agentId: string;
  token: string;
  apiKey: string;        // Workspace API key
  hubUrl: string;
  label: string;         // Environment label
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

export function loadConfig(customPath?: string): AgentConfig | null {
  const configFile = customPath ? path.resolve(customPath) : activeConfigPath;
  try {
    if (!fs.existsSync(configFile)) {
      return null;
    }
    const data = fs.readFileSync(configFile, 'utf-8');
    return JSON.parse(data) as AgentConfig;
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
