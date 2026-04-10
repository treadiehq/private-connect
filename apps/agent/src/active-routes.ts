import * as fs from 'fs';
import * as path from 'path';
import { getConfigDir } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface ActiveRoute {
  serviceName: string;
  localPort: number;
  pid: number;
  protocol: string;
  startedAt: string;
}

interface ActiveRoutesFile {
  version: 1;
  routes: ActiveRoute[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const ROUTES_FILE = 'active-routes.json';
const FILE_MODE = 0o644;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getRoutesPath(): string {
  return path.join(getConfigDir(), ROUTES_FILE);
}

function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// File I/O
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Load active routes, filtering out stale entries whose process has exited.
 */
export function loadActiveRoutes(): ActiveRoute[] {
  const filePath = getRoutesPath();
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ActiveRoutesFile;
    if (data.version !== 1 || !Array.isArray(data.routes)) return [];

    const alive = data.routes.filter(r => isProcessAlive(r.pid));

    // Persist cleanup if stale routes were removed
    if (alive.length !== data.routes.length) {
      saveRoutesFile({ version: 1, routes: alive });
    }

    return alive;
  } catch {
    return [];
  }
}

function saveRoutesFile(data: ActiveRoutesFile): void {
  const filePath = getRoutesPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: FILE_MODE });
}

// ─────────────────────────────────────────────────────────────────────────────
// Validation
// ─────────────────────────────────────────────────────────────────────────────

const VALID_SERVICE_NAME = /^[a-zA-Z0-9_-]+$/;

function validateServiceName(name: string): void {
  if (!VALID_SERVICE_NAME.test(name)) {
    throw new Error(
      `Service name "${name}" contains invalid characters. Use only letters, numbers, hyphens, and underscores.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Register a locally running reach tunnel so the proxy can discover it.
 */
export function registerRoute(
  serviceName: string,
  localPort: number,
  protocol: string = 'tcp'
): void {
  validateServiceName(serviceName);
  const routes = loadActiveRoutes();

  // Remove any existing route for the same service
  const filtered = routes.filter(
    r => r.serviceName.toLowerCase() !== serviceName.toLowerCase()
  );

  filtered.push({
    serviceName,
    localPort,
    pid: process.pid,
    protocol,
    startedAt: new Date().toISOString(),
  });

  saveRoutesFile({ version: 1, routes: filtered });
}

/**
 * Unregister a route (called on reach shutdown).
 */
export function unregisterRoute(serviceName: string): void {
  const routes = loadActiveRoutes();
  const filtered = routes.filter(
    r => r.serviceName.toLowerCase() !== serviceName.toLowerCase()
  );
  saveRoutesFile({ version: 1, routes: filtered });
}

/**
 * Get the routes file path so the proxy can watch it for changes.
 */
export function getActiveRoutesPath(): string {
  return getRoutesPath();
}
