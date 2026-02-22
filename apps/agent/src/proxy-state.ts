import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import * as https from 'https';
import { getConfigDir } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PROXY_PID_FILE = 'proxy.pid';
const PROXY_PORT_FILE = 'proxy.port';
const PROXY_TLS_MARKER = 'proxy.tls';
const PROXY_LOG_FILE = 'proxy.log';
const DEFAULT_PROXY_PORT = 3000;
const SOCKET_TIMEOUT_MS = 500;
const PROXY_HEADER = 'x-private-connect-proxy';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ProxyState {
  running: boolean;
  pid?: number;
  port?: number;
  tls?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Path Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getProxyDir(): string {
  return getConfigDir();
}

export function getProxyPidPath(): string {
  return path.join(getProxyDir(), PROXY_PID_FILE);
}

export function getProxyPortPath(): string {
  return path.join(getProxyDir(), PROXY_PORT_FILE);
}

export function getProxyTlsPath(): string {
  return path.join(getProxyDir(), PROXY_TLS_MARKER);
}

export function getProxyLogPath(): string {
  return path.join(getProxyDir(), PROXY_LOG_FILE);
}

export function getDefaultProxyPort(): number {
  const envPort = process.env.CONNECT_PROXY_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!isNaN(port) && port >= 1 && port <= 65535) return port;
  }
  return DEFAULT_PROXY_PORT;
}

export function getProxyHeader(): string {
  return PROXY_HEADER;
}

// ─────────────────────────────────────────────────────────────────────────────
// State Read/Write
// ─────────────────────────────────────────────────────────────────────────────

export function writeProxyState(pid: number, port: number, tls: boolean): void {
  const dir = getProxyDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(getProxyPidPath(), pid.toString(), { mode: 0o644 });
  fs.writeFileSync(getProxyPortPath(), port.toString(), { mode: 0o644 });

  if (tls) {
    fs.writeFileSync(getProxyTlsPath(), '1', { mode: 0o644 });
  } else {
    try { fs.unlinkSync(getProxyTlsPath()); } catch { /* absent is fine */ }
  }
}

export function clearProxyState(): void {
  for (const filePath of [getProxyPidPath(), getProxyPortPath(), getProxyTlsPath()]) {
    try { fs.unlinkSync(filePath); } catch { /* already absent */ }
  }
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read the proxy's current state from disk. Validates that the PID is alive.
 * Cleans up stale state files if the process is dead.
 */
export function readProxyState(): ProxyState {
  const pidPath = getProxyPidPath();

  let pid: number | undefined;
  try {
    const raw = fs.readFileSync(pidPath, 'utf-8').trim();
    pid = parseInt(raw, 10);
    if (isNaN(pid)) pid = undefined;
  } catch {
    return { running: false };
  }

  if (!pid || !isProcessAlive(pid)) {
    // Stale PID file — clean up
    clearProxyState();
    return { running: false };
  }

  let port: number | undefined;
  try {
    const raw = fs.readFileSync(getProxyPortPath(), 'utf-8').trim();
    port = parseInt(raw, 10);
    if (isNaN(port)) port = undefined;
  } catch { /* missing port file */ }

  let tls = false;
  try {
    tls = fs.existsSync(getProxyTlsPath());
  } catch { /* treat as no TLS */ }

  return { running: true, pid, port, tls };
}

/**
 * Check if the proxy is actually responding on the expected port.
 * Uses a HEAD request and checks for our identification header.
 */
export function isProxyResponding(port: number, tls = false): Promise<boolean> {
  return new Promise((resolve) => {
    const requestFn = tls ? https.request : http.request;
    const req = requestFn({
      hostname: '127.0.0.1',
      port,
      path: '/',
      method: 'HEAD',
      timeout: SOCKET_TIMEOUT_MS,
      ...(tls ? { rejectUnauthorized: false } : {}),
    }, (res) => {
      res.resume();
      resolve(res.headers[PROXY_HEADER] === '1');
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.end();
  });
}

/**
 * Wait for the proxy to become responsive, polling at intervals.
 */
export async function waitForProxy(
  port: number,
  tls = false,
  maxAttempts = 20,
  intervalMs = 250,
): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, intervalMs));
    if (await isProxyResponding(port, tls)) return true;
  }
  return false;
}

/**
 * Build the correct base URL for a service given current proxy state.
 * Returns null if the proxy is not running.
 */
export function getProxyUrl(serviceName: string): string | null {
  const state = readProxyState();
  if (!state.running || !state.port) return null;

  const proto = state.tls ? 'https' : 'http';
  return `${proto}://${serviceName}.localhost:${state.port}`;
}
