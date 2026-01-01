import * as net from 'net';
import { execSync } from 'child_process';
import * as os from 'os';

/**
 * Check if a port is available
 */
export function isPortAvailable(port: number, host: string = '127.0.0.1'): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, host);
  });
}

/**
 * Find an available port starting from the given port
 * Returns the first available port, or null if none found within range
 */
export async function findAvailablePort(
  startPort: number,
  host: string = '127.0.0.1',
  maxAttempts: number = 100
): Promise<number | null> {
  for (let i = 0; i < maxAttempts; i++) {
    const port = startPort + i;
    if (port > 65535) return null;
    
    if (await isPortAvailable(port, host)) {
      return port;
    }
  }
  return null;
}

/**
 * Get info about what's using a port
 */
export function getPortUser(port: number): { pid: number; command: string } | null {
  const platform = os.platform();
  
  try {
    if (platform === 'darwin' || platform === 'linux') {
      // Use lsof to find what's using the port
      const output = execSync(`lsof -i :${port} -t 2>/dev/null`, { encoding: 'utf-8' }).trim();
      if (!output) return null;
      
      const pid = parseInt(output.split('\n')[0], 10);
      if (isNaN(pid)) return null;
      
      // Get the command name
      const command = execSync(`ps -p ${pid} -o comm= 2>/dev/null`, { encoding: 'utf-8' }).trim();
      
      return { pid, command };
    }
  } catch {
    // Command failed, port might not be in use or we don't have permission
  }
  
  return null;
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
    // Find all node/connect processes that are listening on ports
    const output = execSync(
      `lsof -i -P -n 2>/dev/null | grep -E '(node|connect)' | grep LISTEN || true`,
      { encoding: 'utf-8' }
    );
    
    const lines = output.trim().split('\n').filter(l => l);
    
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      
      const command = parts[0];
      const pid = parseInt(parts[1], 10);
      const portMatch = parts[8]?.match(/:(\d+)$/);
      
      if (portMatch && !isNaN(pid)) {
        const port = parseInt(portMatch[1], 10);
        
        // Check if this is a Private Connect process
        try {
          const cmdline = execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf-8' });
          if (cmdline.includes('connect') || cmdline.includes('private-connect')) {
            results.push({ port, pid, command: cmdline.trim() });
          }
        } catch {
          // Process might have died
        }
      }
    }
  } catch {
    // lsof might not be available
  }
  
  return results;
}

/**
 * Kill a process by PID
 */
export function killProcess(pid: number, signal: 'SIGTERM' | 'SIGKILL' = 'SIGTERM'): boolean {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a process is running
 */
export function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Wait for a port to become available (with timeout)
 */
export async function waitForPort(
  port: number,
  host: string = '127.0.0.1',
  timeoutMs: number = 5000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeoutMs) {
    if (await isPortAvailable(port, host)) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return false;
}

/**
 * Create a server with auto port selection
 * Returns the actual port used
 */
export async function createServerWithAutoPort(
  createFn: (port: number) => Promise<net.Server>,
  preferredPort: number,
  host: string = '127.0.0.1'
): Promise<{ server: net.Server; port: number; wasAutoSelected: boolean }> {
  // First, try the preferred port
  if (await isPortAvailable(preferredPort, host)) {
    const server = await createFn(preferredPort);
    return { server, port: preferredPort, wasAutoSelected: false };
  }
  
  // Find an alternative port
  const alternativePort = await findAvailablePort(preferredPort + 1, host);
  
  if (!alternativePort) {
    throw new Error(`No available ports found starting from ${preferredPort}`);
  }
  
  const server = await createFn(alternativePort);
  return { server, port: alternativePort, wasAutoSelected: true };
}

