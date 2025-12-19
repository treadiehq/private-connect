import * as net from 'net';
import * as http from 'http';
import * as https from 'https';

export interface DiscoveredService {
  port: number;
  host: string;
  type: 'http' | 'https' | 'redis' | 'postgres' | 'mysql' | 'mongodb' | 'ssh' | 'unknown';
  name?: string;
  details?: {
    serverHeader?: string;
    statusCode?: number;
    title?: string;
  };
}

// Common ports to scan with their likely service types
const COMMON_PORTS: { port: number; likely: DiscoveredService['type'] }[] = [
  // Web servers
  { port: 80, likely: 'http' },
  { port: 443, likely: 'https' },
  { port: 3000, likely: 'http' },
  { port: 3001, likely: 'http' },
  { port: 4000, likely: 'http' },
  { port: 5000, likely: 'http' },
  { port: 5173, likely: 'http' }, // Vite
  { port: 5174, likely: 'http' }, // Vite
  { port: 8000, likely: 'http' },
  { port: 8080, likely: 'http' },
  { port: 8443, likely: 'https' },
  { port: 9000, likely: 'http' },
  // Databases
  { port: 5432, likely: 'postgres' },
  { port: 3306, likely: 'mysql' },
  { port: 27017, likely: 'mongodb' },
  { port: 6379, likely: 'redis' },
  // Other
  { port: 22, likely: 'ssh' },
];

const TIMEOUT_MS = 1000;

/**
 * Check if a port is open
 */
async function isPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, TIMEOUT_MS);

    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(true);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Identify HTTP service and extract details
 */
async function identifyHttpService(
  host: string,
  port: number,
  useHttps: boolean = false
): Promise<DiscoveredService['details'] | null> {
  return new Promise((resolve) => {
    const protocol = useHttps ? https : http;
    const timeout = setTimeout(() => {
      resolve(null);
    }, TIMEOUT_MS);

    const req = protocol.request(
      {
        hostname: host,
        port,
        path: '/',
        method: 'GET',
        timeout: TIMEOUT_MS,
        rejectUnauthorized: false,
      },
      (res) => {
        clearTimeout(timeout);
        let body = '';
        res.on('data', (chunk) => {
          body += chunk.toString().slice(0, 1000); // Limit body read
        });
        res.on('end', () => {
          // Try to extract title from HTML
          const titleMatch = body.match(/<title[^>]*>([^<]+)<\/title>/i);
          resolve({
            serverHeader: res.headers['server'] as string,
            statusCode: res.statusCode,
            title: titleMatch?.[1]?.trim(),
          });
        });
      }
    );

    req.on('error', () => {
      clearTimeout(timeout);
      resolve(null);
    });

    req.on('timeout', () => {
      req.destroy();
      resolve(null);
    });

    req.end();
  });
}

/**
 * Identify Redis service
 */
async function isRedis(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, TIMEOUT_MS);

    socket.on('connect', () => {
      socket.write('PING\r\n');
    });

    socket.on('data', (data) => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(data.toString().includes('+PONG'));
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Identify PostgreSQL service
 */
async function isPostgres(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, TIMEOUT_MS);

    socket.on('connect', () => {
      // Send SSL request packet
      const sslRequest = Buffer.alloc(8);
      sslRequest.writeInt32BE(8, 0);
      sslRequest.writeInt32BE(80877103, 4); // SSL request code
      socket.write(sslRequest);
    });

    socket.on('data', (data) => {
      clearTimeout(timeout);
      socket.destroy();
      // PostgreSQL responds with 'S' (SSL supported) or 'N' (not supported)
      resolve(data[0] === 83 || data[0] === 78);
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

/**
 * Generate a friendly name for the service
 */
function generateServiceName(service: DiscoveredService): string {
  if (service.details?.title) {
    // Clean up the title
    return service.details.title
      .replace(/[^\w\s-]/g, '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .slice(0, 30);
  }

  // Generate based on type and port
  const typeNames: Record<string, string> = {
    http: 'web',
    https: 'web-secure',
    redis: 'redis',
    postgres: 'postgres',
    mysql: 'mysql',
    mongodb: 'mongodb',
    ssh: 'ssh',
    unknown: 'service',
  };

  return `${typeNames[service.type]}-${service.port}`;
}

/**
 * Discover services running on localhost
 */
export async function discoverServices(
  host: string = 'localhost',
  customPorts?: number[]
): Promise<DiscoveredService[]> {
  const portsToScan = customPorts
    ? customPorts.map((port) => ({ port, likely: 'unknown' as const }))
    : COMMON_PORTS;

  const discovered: DiscoveredService[] = [];

  // Scan ports in parallel (batches of 10)
  const batchSize = 10;
  for (let i = 0; i < portsToScan.length; i += batchSize) {
    const batch = portsToScan.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async ({ port, likely }) => {
        const open = await isPortOpen(host, port);
        if (!open) return null;

        let type: DiscoveredService['type'] = likely;
        let details: DiscoveredService['details'] | undefined;

        // Try to identify the service
        if (likely === 'redis' || port === 6379) {
          if (await isRedis(host, port)) {
            type = 'redis';
          }
        } else if (likely === 'postgres' || port === 5432) {
          if (await isPostgres(host, port)) {
            type = 'postgres';
          }
        } else if (likely === 'https' || port === 443 || port === 8443) {
          const httpDetails = await identifyHttpService(host, port, true);
          if (httpDetails) {
            type = 'https';
            details = httpDetails;
          }
        } else if (
          likely === 'http' ||
          [80, 3000, 3001, 4000, 5000, 5173, 5174, 8000, 8080, 9000].includes(port)
        ) {
          const httpDetails = await identifyHttpService(host, port, false);
          if (httpDetails) {
            type = 'http';
            details = httpDetails;
          } else {
            // Try HTTPS as fallback
            const httpsDetails = await identifyHttpService(host, port, true);
            if (httpsDetails) {
              type = 'https';
              details = httpsDetails;
            }
          }
        }

        const service: DiscoveredService = {
          port,
          host,
          type,
          details,
        };
        service.name = generateServiceName(service);

        return service;
      })
    );

    discovered.push(...results.filter((r): r is DiscoveredService => r !== null));
  }

  return discovered;
}

/**
 * Format discovered services for display
 */
export function formatDiscoveredServices(services: DiscoveredService[]): string {
  if (services.length === 0) {
    return 'No services discovered.';
  }

  const lines = ['', `🔍 Discovered ${services.length} service(s):`, ''];

  for (const service of services) {
    const icon = getServiceIcon(service.type);
    const name = service.name || `port-${service.port}`;
    const details = service.details?.title
      ? ` (${service.details.title})`
      : service.details?.serverHeader
        ? ` (${service.details.serverHeader})`
        : '';

    lines.push(`  ${icon} ${name}`);
    lines.push(`     ${service.host}:${service.port} • ${service.type}${details}`);
    lines.push('');
  }

  return lines.join('\n');
}

function getServiceIcon(type: DiscoveredService['type']): string {
  const icons: Record<string, string> = {
    http: '🌐',
    https: '🔒',
    redis: '📦',
    postgres: '🐘',
    mysql: '🐬',
    mongodb: '🍃',
    ssh: '🔑',
    unknown: '❓',
  };
  return icons[type] || '❓';
}

