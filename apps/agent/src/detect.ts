/**
 * Auto-detection utilities for service naming and target resolution
 * 
 * This module enables the "primitive" experience by automatically:
 * - Detecting what's running on a port
 * - Generating intelligent service names
 * - Resolving whether a target should be exposed or reached
 */

import * as net from 'net';
import * as fs from 'fs';
import * as path from 'path';
import { getPortUser } from './ports';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface DetectedService {
  name: string;
  port: number;
  protocol: 'tcp' | 'http' | 'https';
  confidence: 'high' | 'medium' | 'low';
  source: 'well-known' | 'process' | 'package' | 'pconnect' | 'fallback';
}

export interface TargetResolution {
  action: 'expose' | 'reach';
  target: string;
  serviceName?: string;
  port?: number;
  teammate?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Well-Known Ports Database
// ─────────────────────────────────────────────────────────────────────────────

const WELL_KNOWN_PORTS: Record<number, { name: string; protocol: 'tcp' | 'http' | 'https' }> = {
  // Databases
  5432: { name: 'postgres', protocol: 'tcp' },
  3306: { name: 'mysql', protocol: 'tcp' },
  27017: { name: 'mongodb', protocol: 'tcp' },
  6379: { name: 'redis', protocol: 'tcp' },
  11211: { name: 'memcached', protocol: 'tcp' },
  9200: { name: 'elasticsearch', protocol: 'http' },
  5984: { name: 'couchdb', protocol: 'http' },
  8529: { name: 'arangodb', protocol: 'http' },
  26257: { name: 'cockroachdb', protocol: 'tcp' },
  9042: { name: 'cassandra', protocol: 'tcp' },
  
  // Message queues
  5672: { name: 'rabbitmq', protocol: 'tcp' },
  15672: { name: 'rabbitmq-mgmt', protocol: 'http' },
  9092: { name: 'kafka', protocol: 'tcp' },
  4222: { name: 'nats', protocol: 'tcp' },
  
  // Caches & Storage
  8500: { name: 'consul', protocol: 'http' },
  2379: { name: 'etcd', protocol: 'http' },
  8200: { name: 'vault', protocol: 'http' },
  9000: { name: 'minio', protocol: 'http' },
  
  // Common app ports
  3000: { name: 'app', protocol: 'http' },
  3001: { name: 'api', protocol: 'http' },
  4000: { name: 'graphql', protocol: 'http' },
  5000: { name: 'flask', protocol: 'http' },
  5173: { name: 'vite', protocol: 'http' },
  8000: { name: 'django', protocol: 'http' },
  8080: { name: 'api', protocol: 'http' },
  8443: { name: 'api', protocol: 'https' },
  
  // Infrastructure
  80: { name: 'http', protocol: 'http' },
  443: { name: 'https', protocol: 'https' },
  22: { name: 'ssh', protocol: 'tcp' },
  
  // Monitoring
  3100: { name: 'loki', protocol: 'http' },
  9090: { name: 'prometheus', protocol: 'http' },
  9093: { name: 'alertmanager', protocol: 'http' },
  3030: { name: 'grafana', protocol: 'http' },
  16686: { name: 'jaeger', protocol: 'http' },
  9411: { name: 'zipkin', protocol: 'http' },
};

// Process name to service name mapping
const PROCESS_NAME_MAP: Record<string, string> = {
  'postgres': 'postgres',
  'postgresql': 'postgres',
  'mysqld': 'mysql',
  'mongod': 'mongodb',
  'redis-server': 'redis',
  'memcached': 'memcached',
  'nginx': 'nginx',
  'httpd': 'apache',
  'node': 'node',
  'python': 'python',
  'python3': 'python',
  'java': 'java',
  'ruby': 'ruby',
  'go': 'go',
  'beam.smp': 'erlang',
  'rabbitmq-server': 'rabbitmq',
};

// ─────────────────────────────────────────────────────────────────────────────
// Detection Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Detect what's running on a port and generate a service name
 */
export async function detectService(
  port: number,
  _host: string = 'localhost'
): Promise<DetectedService> {
  // Priority 1: Check pconnect.yml in current directory
  const pconnectName = getPconnectServiceName(port);
  if (pconnectName) {
    return {
      name: pconnectName,
      port,
      protocol: guessProtocol(port),
      confidence: 'high',
      source: 'pconnect',
    };
  }

  // Priority 2: Well-known ports
  const wellKnown = WELL_KNOWN_PORTS[port];
  if (wellKnown) {
    return {
      name: wellKnown.name,
      port,
      protocol: wellKnown.protocol,
      confidence: 'high',
      source: 'well-known',
    };
  }

  // Priority 3: Process detection
  const portUser = getPortUser(port);
  if (portUser) {
    const processName = getProcessBaseName(portUser.command);
    const mappedName = PROCESS_NAME_MAP[processName];
    
    if (mappedName) {
      return {
        name: mappedName,
        port,
        protocol: guessProtocol(port),
        confidence: 'medium',
        source: 'process',
      };
    }

    // Use process name directly if reasonable
    if (processName && processName.length > 1 && processName.length < 20) {
      return {
        name: sanitizeName(processName),
        port,
        protocol: guessProtocol(port),
        confidence: 'medium',
        source: 'process',
      };
    }
  }

  // Priority 4: package.json name in current directory
  const packageName = getPackageJsonName();
  if (packageName) {
    return {
      name: sanitizeName(packageName),
      port,
      protocol: guessProtocol(port),
      confidence: 'medium',
      source: 'package',
    };
  }

  // Priority 5: Fallback to service-{port}
  return {
    name: `service-${port}`,
    port,
    protocol: guessProtocol(port),
    confidence: 'low',
    source: 'fallback',
  };
}

/**
 * Make a name unique if there are conflicts
 * Appends port number if the base name already exists
 */
export function makeNameUnique(
  baseName: string,
  port: number,
  existingNames: Set<string>
): string {
  if (!existingNames.has(baseName)) {
    return baseName;
  }

  // Try with port suffix
  const withPort = `${baseName}-${port}`;
  if (!existingNames.has(withPort)) {
    return withPort;
  }

  // Try with incrementing suffix
  let i = 2;
  while (existingNames.has(`${baseName}-${i}`)) {
    i++;
  }
  return `${baseName}-${i}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Target Resolution
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse a target string and determine what action to take
 * 
 * Examples:
 *   "localhost:5432" -> expose
 *   "127.0.0.1:8080" -> expose
 *   ":3000" -> expose (shorthand for localhost:3000)
 *   "3000" -> expose (shorthand for localhost:3000)
 *   "prod-db" -> reach (service name)
 *   "postgres.alice" -> reach (teammate's service)
 *   "" or undefined -> status (no target)
 */
export function resolveTarget(target: string | undefined): TargetResolution {
  // No target = status mode
  if (!target || target.trim() === '') {
    return { action: 'reach', target: '' }; // Will trigger status/list
  }

  target = target.trim();

  // Shorthand: purely numeric -> localhost:port
  // e.g., "3000" -> "localhost:3000"
  if (/^\d+$/.test(target)) {
    const port = parseInt(target, 10);
    if (port > 0 && port <= 65535) {
      return {
        action: 'expose',
        target: `localhost:${port}`,
        port,
      };
    }
  }

  // Shorthand :port -> localhost:port
  if (target.startsWith(':')) {
    const port = parseInt(target.slice(1), 10);
    if (!isNaN(port) && port > 0 && port <= 65535) {
      return {
        action: 'expose',
        target: `localhost:${port}`,
        port,
      };
    }
  }

  // Check if it's a host:port pattern (expose)
  const hostPortMatch = target.match(/^([a-zA-Z0-9._-]+):(\d+)$/);
  if (hostPortMatch) {
    const host = hostPortMatch[1];
    const port = parseInt(hostPortMatch[2], 10);
    
    // localhost, 127.0.0.1, or local IPs -> expose
    if (isLocalHost(host)) {
      return {
        action: 'expose',
        target,
        port,
      };
    }
    
    // Could be exposing a remote internal service
    // For now, assume expose if it has a port
    return {
      action: 'expose',
      target,
      port,
    };
  }

  // Check if it's a URL (http:// or https://)
  if (target.startsWith('http://') || target.startsWith('https://')) {
    // This is a direct reach (external service check)
    return {
      action: 'reach',
      target,
    };
  }

  // Check if it's teammate.service format
  const teammateMatch = target.match(/^([a-zA-Z0-9_-]+)\.([a-zA-Z0-9_-]+)$/);
  if (teammateMatch) {
    // Could be service.teammate or teammate.service
    // We'll use service.teammate format (more natural: postgres.alice)
    return {
      action: 'reach',
      target: teammateMatch[2], // The service name
      serviceName: teammateMatch[2],
      teammate: teammateMatch[1],
    };
  }

  // Assume it's a service name (reach)
  return {
    action: 'reach',
    target,
    serviceName: target,
  };
}

/**
 * Check if target is reachable locally (to help decide expose vs reach)
 */
export async function isLocallyReachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = 1000;

    socket.setTimeout(timeout);

    socket.on('connect', () => {
      socket.destroy();
      resolve(true);
    });

    socket.on('timeout', () => {
      socket.destroy();
      resolve(false);
    });

    socket.on('error', () => {
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

function isLocalHost(host: string): boolean {
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host.startsWith('192.168.') ||
    host.startsWith('10.') ||
    host.startsWith('172.16.') ||
    host.startsWith('172.17.') ||
    host.startsWith('172.18.') ||
    host.startsWith('172.19.') ||
    host.startsWith('172.2') ||
    host.startsWith('172.30.') ||
    host.startsWith('172.31.')
  );
}

function guessProtocol(port: number): 'tcp' | 'http' | 'https' {
  const wellKnown = WELL_KNOWN_PORTS[port];
  if (wellKnown) return wellKnown.protocol;
  
  if (port === 443 || port === 8443) return 'https';
  if (port === 80 || (port >= 3000 && port < 10000)) return 'http';
  return 'tcp';
}

function getProcessBaseName(command: string): string {
  // Extract just the binary name from full path or command line
  const parts = command.split(/[\s/\\]/);
  for (const part of parts) {
    if (part && !part.startsWith('-')) {
      return part.toLowerCase();
    }
  }
  return command.toLowerCase();
}

function sanitizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

function getPconnectServiceName(port: number): string | null {
  const configPaths = ['pconnect.yml', 'pconnect.yaml', 'pconnect.json'];
  
  for (const configPath of configPaths) {
    const fullPath = path.join(process.cwd(), configPath);
    if (!fs.existsSync(fullPath)) continue;

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      if (configPath.endsWith('.json')) {
        const config = JSON.parse(content);
        const service = config.services?.find((s: { port: number }) => s.port === port);
        if (service?.name) return service.name;
      } else {
        // Simple YAML parsing for services
        const match = content.match(new RegExp(`name:\\s*([\\w-]+)[\\s\\S]*?port:\\s*${port}|port:\\s*${port}[\\s\\S]*?name:\\s*([\\w-]+)`));
        if (match) {
          return match[1] || match[2];
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  return null;
}

function getPackageJsonName(): string | null {
  const packagePath = path.join(process.cwd(), 'package.json');
  
  if (!fs.existsSync(packagePath)) return null;

  try {
    const content = fs.readFileSync(packagePath, 'utf-8');
    const pkg = JSON.parse(content);
    
    if (pkg.name && typeof pkg.name === 'string') {
      // Skip scoped package prefixes
      const name = pkg.name.replace(/^@[^/]+\//, '');
      if (name.length > 0 && name.length < 50) {
        return name;
      }
    }
  } catch {
    // Ignore parse errors
  }

  return null;
}

