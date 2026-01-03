import * as net from 'net';
import { spawnSync } from 'child_process';
import * as os from 'os';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface PortCheckResult {
  available: boolean;
  error?: 'EADDRINUSE' | 'EACCES' | 'EINVAL' | 'UNKNOWN';
}

export interface PortUser {
  pid: number;
  command: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const MIN_PORT = 1;
const MAX_PORT = 65535;
const MIN_USER_PORT = 1024; // Ports below this require root/admin
const DEFAULT_POLL_INTERVAL = 100;
const MAX_POLL_INTERVAL = 2000;
const BACKOFF_MULTIPLIER = 1.5;

// ─────────────────────────────────────────────────────────────────────────────
// Validation Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate port number
 */
export function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT;
}

/**
 * Validate port is in user range (non-privileged)
 */
export function isUserPort(port: number): boolean {
  return isValidPort(port) && port >= MIN_USER_PORT;
}

/**
 * Validate PID
 */
function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0;
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Availability
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if a port is available with detailed error info
 */
export function checkPort(port: number, host: string = '127.0.0.1'): Promise<PortCheckResult> {
  return new Promise((resolve) => {
    // Validate port range
    if (!isValidPort(port)) {
      resolve({ available: false, error: 'EINVAL' });
      return;
    }

    const server = net.createServer();

    // Set exclusive to prevent false positives from SO_REUSEADDR
    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        resolve({ available: false, error: 'EADDRINUSE' });
      } else if (err.code === 'EACCES') {
        resolve({ available: false, error: 'EACCES' });
      } else {
        resolve({ available: false, error: 'UNKNOWN' });
      }
    });

    server.once('listening', () => {
      // Wait for close callback before resolving
      server.close(() => {
        resolve({ available: true });
      });
    });

    // Use exclusive: true to get accurate availability
    server.listen({ port, host, exclusive: true });
  });
}

/**
 * Check if a port is available (simple boolean version)
 */
export async function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  const result = await checkPort(port, host);
  return result.available;
}

/**
 * Get a random available port (race-free)
 * Uses port 0 binding which lets the OS assign an available port
 */
export function getAutoPort(host: string = '127.0.0.1'): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.once('error', (err) => {
      reject(err);
    });

    server.once('listening', () => {
      const addr = server.address();
      if (!addr || typeof addr === 'string') {
        server.close();
        reject(new Error('Failed to get assigned port'));
        return;
      }

      const port = addr.port;
      server.close(() => {
        resolve(port);
      });
    });

    // Port 0 tells OS to assign any available port
    server.listen({ port: 0, host, exclusive: true });
  });
}

/**
 * Find an available port starting from the given port
 * Returns the first available port, or null if none found within range
 * 
 * Note: This has inherent TOCTOU race. For race-free port allocation,
 * use getAutoPort() or bind directly to port 0.
 */
export async function findAvailablePort(
  startPort: number,
  host: string = '127.0.0.1',
  maxAttempts: number = 100
): Promise<number | null> {
  // Validate start port
  if (!isValidPort(startPort)) {
    return null;
  }

  // Skip privileged ports if not root
  const effectiveStart = Math.max(startPort, MIN_USER_PORT);

  for (let i = 0; i < maxAttempts; i++) {
    const port = effectiveStart + i;
    if (port > MAX_PORT) return null;

    const result = await checkPort(port, host);
    if (result.available) {
      return port;
    }

    // Don't bother checking more if we got permission denied
    if (result.error === 'EACCES') {
      continue;
    }
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process Information (Platform-Specific)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get info about what's using a port
 * Uses spawnSync with array args to prevent command injection
 */
export function getPortUser(port: number): PortUser | null {
  // Validate port to prevent any injection
  if (!isValidPort(port)) {
    return null;
  }

  const platform = os.platform();

  if (platform !== 'darwin' && platform !== 'linux') {
    return null; // Windows not supported
  }

  try {
    // Use lsof with explicit args array (no shell interpolation)
    const lsofResult = spawnSync('lsof', ['-i', `:${port}`, '-t'], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (lsofResult.status !== 0 || !lsofResult.stdout) {
      return null;
    }

    const output = lsofResult.stdout.trim();
    if (!output) return null;

    const pid = parseInt(output.split('\n')[0], 10);
    if (!isValidPid(pid)) return null;

    // Get the command name using ps with args array
    const psResult = spawnSync('ps', ['-p', String(pid), '-o', 'comm='], {
      encoding: 'utf-8',
      timeout: 5000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const command = psResult.stdout?.trim() || 'unknown';

    return { pid, command };
  } catch {
    // Tools might not be available or permission denied
    return null;
  }
}

/**
 * Find all ports used by Private Connect processes
 */
export function findPrivateConnectPorts(): Array<{ port: number; pid: number; command: string }> {
  const results: Array<{ port: number; pid: number; command: string }> = [];
  const platform = os.platform();

  if (platform !== 'darwin' && platform !== 'linux') {
    return results;
  }

  try {
    // Use lsof with explicit args (no shell)
    const lsofResult = spawnSync('lsof', ['-i', '-P', '-n'], {
      encoding: 'utf-8',
      timeout: 10000,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    if (lsofResult.status !== 0 || !lsofResult.stdout) {
      return results;
    }

    const lines = lsofResult.stdout.trim().split('\n').filter(l => l);

    for (const line of lines) {
      // Only interested in LISTEN sockets
      if (!line.includes('LISTEN')) continue;

      // Check if it's a node/connect process
      if (!line.includes('node') && !line.includes('connect')) continue;

      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const pid = parseInt(parts[1], 10);
      if (!isValidPid(pid)) continue;

      // Find port in the address column (varies by platform)
      // Look for pattern like *:3000 or 127.0.0.1:3000
      let port: number | null = null;
      for (const part of parts) {
        const portMatch = part.match(/:(\d+)$/);
        if (portMatch) {
          port = parseInt(portMatch[1], 10);
          break;
        }
      }

      if (!port || !isValidPort(port)) continue;

      // Get full command line using ps with args array
      const psResult = spawnSync('ps', ['-p', String(pid), '-o', 'args='], {
        encoding: 'utf-8',
        timeout: 5000,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const cmdline = psResult.stdout?.trim() || '';

      // Only include if it's a Private Connect process
      if (cmdline.includes('connect') || cmdline.includes('private-connect')) {
        results.push({ port, pid, command: cmdline });
      }
    }
  } catch {
    // lsof might not be available
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// Process Management
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Kill a process by PID
 * @returns true if signal was sent successfully, false otherwise
 */
export function killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): boolean {
  // Validate PID
  if (!isValidPid(pid)) {
    return false;
  }

  try {
    process.kill(pid, signal);
    return true;
  } catch {
    // Process might not exist or we don't have permission
    return false;
  }
}

/**
 * Check if a process is running
 * Note: PID reuse can cause false positives in rare cases
 */
export function isProcessRunning(pid: number): boolean {
  if (!isValidPid(pid)) {
    return false;
  }

  try {
    // Signal 0 doesn't kill, just checks if process exists
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a process to exit
 */
export async function waitForProcessExit(
  pid: number,
  timeoutMs: number = 5000
): Promise<boolean> {
  if (!isValidPid(pid)) {
    return true; // Invalid PID counts as "not running"
  }

  const startTime = Date.now();
  let interval = DEFAULT_POLL_INTERVAL;

  while (Date.now() - startTime < timeoutMs) {
    if (!isProcessRunning(pid)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
    // Exponential backoff
    interval = Math.min(interval * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL);
  }

  return !isProcessRunning(pid);
}

// ─────────────────────────────────────────────────────────────────────────────
// Port Waiting
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Wait for a port to become available (with timeout and exponential backoff)
 */
export async function waitForPort(
  port: number,
  host: string = '127.0.0.1',
  timeoutMs: number = 5000
): Promise<boolean> {
  if (!isValidPort(port)) {
    return false;
  }

  const startTime = Date.now();
  let interval = DEFAULT_POLL_INTERVAL;

  while (Date.now() - startTime < timeoutMs) {
    if (await isPortAvailable(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
    // Exponential backoff to reduce CPU usage
    interval = Math.min(interval * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL);
  }

  return false;
}

/**
 * Wait for a port to become occupied (service started)
 */
export async function waitForPortOccupied(
  port: number,
  host: string = '127.0.0.1',
  timeoutMs: number = 5000
): Promise<boolean> {
  if (!isValidPort(port)) {
    return false;
  }

  const startTime = Date.now();
  let interval = DEFAULT_POLL_INTERVAL;

  while (Date.now() - startTime < timeoutMs) {
    if (!(await isPortAvailable(port, host))) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
    interval = Math.min(interval * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL);
  }

  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Server Creation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a server with auto port selection
 * Returns the actual port used
 *
 * Note: For truly race-free allocation, consider having createFn
 * bind to port 0 and return server.address().port
 */
export async function createServerWithAutoPort(
  createFn: (port: number) => Promise<net.Server>,
  preferredPort: number,
  host: string = '127.0.0.1'
): Promise<{ server: net.Server; port: number; wasAutoSelected: boolean }> {
  // Validate preferred port
  if (!isValidPort(preferredPort)) {
    throw new Error(`Invalid port: ${preferredPort}`);
  }

  // First, try the preferred port
  const checkResult = await checkPort(preferredPort, host);
  if (checkResult.available) {
    try {
      const server = await createFn(preferredPort);
      return { server, port: preferredPort, wasAutoSelected: false };
    } catch {
      // Port was taken between check and bind (race)
      // Fall through to find alternative
    }
  }

  // Provide helpful error for permission issues
  if (checkResult.error === 'EACCES') {
    throw new Error(
      `Permission denied for port ${preferredPort}. ` +
      `Ports below ${MIN_USER_PORT} require root/admin privileges.`
    );
  }

  // Find an alternative port
  const alternativePort = await findAvailablePort(preferredPort + 1, host);

  if (!alternativePort) {
    throw new Error(
      `No available ports found starting from ${preferredPort} on ${host}`
    );
  }

  try {
    const server = await createFn(alternativePort);
    return { server, port: alternativePort, wasAutoSelected: true };
  } catch (error) {
    // Race condition - try one more time with auto port
    const autoPort = await getAutoPort(host);
    const server = await createFn(autoPort);
    return { server, port: autoPort, wasAutoSelected: true };
  }
}
