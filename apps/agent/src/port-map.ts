import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getConfigDir } from './config';
import { isPortAvailable } from './ports';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PortMapping {
  serviceName: string;
  port: number;
  assignedAt: string;
}

interface PortMapFile {
  version: 1;
  mappings: PortMapping[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const PORT_MAP_FILE = 'port-map.json';
const STABLE_PORT_MIN = 10000;
const STABLE_PORT_MAX = 49151;
const FILE_MODE = 0o600;

// ─────────────────────────────────────────────────────────────────────────────
// File I/O
// ─────────────────────────────────────────────────────────────────────────────

function getPortMapPath(): string {
  return path.join(getConfigDir(), PORT_MAP_FILE);
}

function loadPortMap(): PortMapFile {
  const filePath = getPortMapPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      if (data.version === 1 && Array.isArray(data.mappings)) {
        return data;
      }
    }
  } catch {
    // Corrupted file; start fresh
  }
  return { version: 1, mappings: [] };
}

function savePortMap(data: PortMapFile): void {
  const filePath = getPortMapPath();
  const dir = path.dirname(filePath);

  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
  }

  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), { mode: FILE_MODE });
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Assignment
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Deterministic port from service name. Used as a fallback when the preferred
 * port and the original service port are both unavailable. Hashing gives us a
 * stable port that's always the same for a given name.
 */
function hashPort(serviceName: string): number {
  const hash = crypto.createHash('sha256').update(serviceName).digest();
  const value = hash.readUInt16BE(0);
  return STABLE_PORT_MIN + (value % (STABLE_PORT_MAX - STABLE_PORT_MIN));
}

/**
 * Get the saved port for a service, or null if none exists.
 */
export function getSavedPort(serviceName: string): number | null {
  const map = loadPortMap();
  const entry = map.mappings.find(
    m => m.serviceName.toLowerCase() === serviceName.toLowerCase()
  );
  return entry?.port ?? null;
}

/**
 * Save a port mapping for a service.
 */
export function savePort(serviceName: string, port: number): void {
  const map = loadPortMap();
  map.mappings = map.mappings.filter(
    m => m.serviceName.toLowerCase() !== serviceName.toLowerCase()
  );
  map.mappings.push({
    serviceName,
    port,
    assignedAt: new Date().toISOString(),
  });
  savePortMap(map);
}

/**
 * Get a stable port for a service. Resolution order:
 *
 * 1. Previously saved port (if available)
 * 2. Preferred port — typically the original service port (if available)
 * 3. Hash-derived port from service name (if available)
 * 4. First available port scanning from the hash-derived port
 *
 * The chosen port is persisted so future calls return the same value.
 */
export async function getStablePort(
  serviceName: string,
  preferredPort?: number
): Promise<number> {
  // 1. Check saved mapping
  const saved = getSavedPort(serviceName);
  if (saved !== null && await isPortAvailable(saved)) {
    return saved;
  }

  // 2. Try preferred (original service) port
  if (preferredPort && await isPortAvailable(preferredPort)) {
    savePort(serviceName, preferredPort);
    return preferredPort;
  }

  // 3. Try hash-derived stable port
  const hashed = hashPort(serviceName);
  if (await isPortAvailable(hashed)) {
    savePort(serviceName, hashed);
    return hashed;
  }

  // 4. Scan from hash port
  for (let offset = 1; offset < 200; offset++) {
    const candidate = hashed + offset;
    if (candidate > STABLE_PORT_MAX) break;
    if (await isPortAvailable(candidate)) {
      savePort(serviceName, candidate);
      return candidate;
    }
  }

  throw new Error(`No available port found for service "${serviceName}"`);
}

/**
 * Remove a saved port mapping.
 */
export function removePort(serviceName: string): boolean {
  const map = loadPortMap();
  const before = map.mappings.length;
  map.mappings = map.mappings.filter(
    m => m.serviceName.toLowerCase() !== serviceName.toLowerCase()
  );
  if (map.mappings.length < before) {
    savePortMap(map);
    return true;
  }
  return false;
}

/**
 * List all saved port mappings.
 */
export function listPorts(): PortMapping[] {
  return loadPortMap().mappings;
}
