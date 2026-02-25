import chalk from 'chalk';
import { loadConfig } from '../config';
import { detectService, makeNameUnique, isLocallyReachable } from '../detect';
import { discoverServices } from '../discovery';
import { exposeCommand } from './expose';

interface LinkOptions {
  hub: string;
  expires?: string;
  methods?: string;
  paths?: string;
  rateLimit?: string;
  name?: string;
  config?: string;
}

interface LinkResponse {
  success: boolean;
  share?: {
    id: string;
    token: string;
    name: string;
    expiresAt: string;
    shareUrl: string;
  };
  error?: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  protocol?: string;
}

const DB_PORTS: Record<number, string> = {
  5432: 'PostgreSQL',
  3306: 'MySQL',
  27017: 'MongoDB',
  6379: 'Redis',
  9200: 'Elasticsearch',
  5984: 'CouchDB',
  8529: 'ArangoDB',
  7687: 'Neo4j',
  9042: 'Cassandra',
};

const isDatabase = (port: number): boolean => port in DB_PORTS;
const getDatabaseType = (port: number): string => DB_PORTS[port] || 'Database';

export async function linkCommand(target: string | undefined, options: LinkOptions) {
  const config = loadConfig();

  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;
  const existingServices = await fetchServices(hubUrl, config.apiKey);

  if (target) {
    // Could be a service name, a port number, or host:port
    const portOnly = target.match(/^(\d+)$/);
    const hostPort = target.match(/^([^:]+):(\d+)$/);

    if (portOnly || hostPort) {
      // It's a target (port or host:port) — resolve and handle
      const host = hostPort ? hostPort[1] : 'localhost';
      const port = parseInt(portOnly ? portOnly[1] : hostPort![2], 10);
      await handleTarget(host, port, existingServices, hubUrl, config, options);
    } else {
      // It's a service name — check if already exposed
      await handleServiceName(target, existingServices, hubUrl, config, options);
    }
  } else {
    // No target — auto-detect
    await handleAutoDetect(existingServices, hubUrl, config, options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow: explicit host:port or port number
// ─────────────────────────────────────────────────────────────────────────────

async function handleTarget(
  host: string,
  port: number,
  existingServices: ServiceInfo[],
  hubUrl: string,
  config: { agentId: string; apiKey: string; hubUrl: string; label: string },
  options: LinkOptions,
) {
  const localHosts = ['localhost', '127.0.0.1', '::1'];

  // Check if this port is already exposed
  const alreadyExposed = existingServices.find(s =>
    s.targetPort === port && localHosts.includes(s.targetHost)
  );

  if (alreadyExposed) {
    console.log(chalk.cyan(`\n🔗 "${alreadyExposed.name}" is already exposed on port ${port}\n`));
    await createAndPrintLink(alreadyExposed, hubUrl, config.apiKey, options);
    return;
  }

  // Not exposed — check if something is actually running
  const reachable = await isLocallyReachable(host, port);
  if (!reachable) {
    console.error(chalk.red(`\n[x] Nothing is running on ${host}:${port}\n`));
    console.log(chalk.gray('  Start your service first, then run this command again.\n'));
    process.exit(1);
  }

  // Auto-detect a name, then expose + link
  await exposeAndLink(host, port, existingServices, hubUrl, config, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow: service name provided (e.g. "my-app")
// ─────────────────────────────────────────────────────────────────────────────

async function handleServiceName(
  serviceName: string,
  existingServices: ServiceInfo[],
  hubUrl: string,
  config: { agentId: string; apiKey: string; hubUrl: string; label: string },
  options: LinkOptions,
) {
  const existing = existingServices.find(
    s => s.name.toLowerCase() === serviceName.toLowerCase()
  );

  if (existing) {
    console.log(chalk.cyan(`\n🔗 Creating public link for "${serviceName}"...\n`));
    await createAndPrintLink(existing, hubUrl, config.apiKey, options);
    return;
  }

  // Service name not found — show helpful error
  console.error(chalk.red(`\n[x] Service "${serviceName}" not found\n`));
  if (existingServices.length > 0) {
    console.log(chalk.gray('  Exposed services:'));
    existingServices.forEach(s => {
      console.log(chalk.gray(`    • ${s.name} (${s.targetHost}:${s.targetPort})`));
    });
    console.log();
  }
  console.log(chalk.gray('  To expose and link a local service:\n'));
  console.log(chalk.cyan(`    connect link 3000`));
  console.log(chalk.cyan(`    connect link localhost:8080\n`));
  process.exit(1);
}

// ─────────────────────────────────────────────────────────────────────────────
// Flow: no target — auto-detect what's running
// ─────────────────────────────────────────────────────────────────────────────

async function handleAutoDetect(
  existingServices: ServiceInfo[],
  hubUrl: string,
  config: { agentId: string; apiKey: string; hubUrl: string; label: string },
  options: LinkOptions,
) {
  console.log(chalk.cyan('\n🔍 Scanning for local services...\n'));

  const discovered = await discoverServices('localhost');

  if (discovered.length === 0) {
    console.error(chalk.red('[x] No services found running locally\n'));
    console.log(chalk.gray('  Start your service, then run:'));
    console.log(chalk.cyan(`    connect link\n`));
    console.log(chalk.gray('  Or specify a target directly:'));
    console.log(chalk.cyan(`    connect link 3000\n`));
    process.exit(1);
  }

  // Prefer HTTP services for public links, but allow databases too
  const httpServices = discovered.filter(s => s.type === 'http' || s.type === 'https');
  const pick = httpServices[0] || discovered[0];

  if (discovered.length > 1) {
    console.log(chalk.gray(`  Found ${discovered.length} services, using port ${pick.port}`));
    console.log(chalk.gray(`  To pick a different one: ${chalk.cyan(`connect link ${discovered.map(s => s.port).join(' | ')}`)}\n`));
  }

  const localHosts = ['localhost', '127.0.0.1', '::1'];

  // Check if already exposed
  const alreadyExposed = existingServices.find(s =>
    s.targetPort === pick.port && localHosts.includes(s.targetHost)
  );

  if (alreadyExposed) {
    console.log(chalk.gray(`  "${alreadyExposed.name}" on port ${pick.port} is already exposed\n`));
    await createAndPrintLink(alreadyExposed, hubUrl, config.apiKey, options);
    return;
  }

  await exposeAndLink('localhost', pick.port, existingServices, hubUrl, config, options);
}

// ─────────────────────────────────────────────────────────────────────────────
// Expose + Link (for services not yet exposed)
// ─────────────────────────────────────────────────────────────────────────────

async function exposeAndLink(
  host: string,
  port: number,
  existingServices: ServiceInfo[],
  hubUrl: string,
  config: { agentId: string; apiKey: string; hubUrl: string; label: string },
  options: LinkOptions,
) {
  // Pick a name
  let serviceName = options.name;
  if (!serviceName) {
    const detected = await detectService(port, host);
    const existingNames = new Set(existingServices.map(s => s.name));
    serviceName = makeNameUnique(detected.name, port, existingNames);
    console.log(chalk.gray(`  Auto-detected: "${serviceName}" on ${host}:${port}\n`));
  }

  console.log(chalk.cyan(`🔗 Exposing and creating public link for "${serviceName}"...\n`));

  // exposeCommand stays alive (WebSocket tunnel) and --link creates the share
  // once the tunnel is established
  await exposeCommand(`${host}:${port}`, {
    name: serviceName,
    hub: hubUrl,
    protocol: 'auto',
    link: true,
    linkExpires: options.expires || '24h',
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Create link for an already-exposed service
// ─────────────────────────────────────────────────────────────────────────────

async function createAndPrintLink(
  service: ServiceInfo,
  hubUrl: string,
  apiKey: string,
  options: LinkOptions,
) {
  const allowedMethods = options.methods?.split(',').map(m => m.trim().toUpperCase());
  const allowedPaths = options.paths?.split(',').map(p => p.trim());
  const rateLimitPerMin = options.rateLimit ? parseInt(options.rateLimit, 10) : undefined;

  try {
    const response = await fetch(`${hubUrl}/v1/services/${service.id}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
      body: JSON.stringify({
        name: options.name || `${service.name}-link`,
        expiresIn: options.expires || '24h',
        allowedMethods,
        allowedPaths,
        rateLimitPerMin,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`[x] Failed to create link: ${error.message || response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as LinkResponse;

    if (!data.success || !data.share) {
      console.error(chalk.red(`[x] Failed to create link: ${data.error || 'Unknown error'}`));
      process.exit(1);
    }

    const share = data.share;
    const expiresAt = new Date(share.expiresAt);
    const isDbService = service.targetPort && isDatabase(service.targetPort);

    const token = share.token;
    const webDomain = 'https://app.privateconnect.co';
    const proxyUrl = `https://${token}.privateconnect.co`;
    const webUrl = `${webDomain}/share/${token}`;

    console.log(chalk.green('[ok] Public link created\n'));

    if (isDbService) {
      const dbType = getDatabaseType(service.targetPort);
      console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────────┐'));
      console.log(chalk.gray('  │') + chalk.white(`  ${dbType} Web Console                                       `) + chalk.gray('│'));
      console.log(chalk.gray('  │') + chalk.cyan(`  ${webUrl}`) + chalk.gray('│'));
      console.log(chalk.gray('  └─────────────────────────────────────────────────────────────┘\n'));

      console.log(chalk.gray('  Settings:'));
      console.log(chalk.gray(`    Expires:     ${expiresAt.toLocaleString()}`));
      console.log();

      console.log(chalk.gray('  Usage:'));
      console.log(chalk.gray('    Open the link in a browser to access the database.'));
      console.log(chalk.gray('    No installation required - includes a web-based SQL client!\n'));

      console.log(chalk.gray('  Features:'));
      console.log(chalk.gray('    • Run SQL queries directly in the browser'));
      console.log(chalk.gray('    • Export results as CSV or JSON'));
      console.log(chalk.gray('    • Query history preserved in session\n'));
    } else {
      console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────────┐'));
      console.log(chalk.gray('  │') + chalk.white('  Public URL                                                  ') + chalk.gray('│'));
      console.log(chalk.gray('  │') + chalk.cyan(`  ${proxyUrl}`) + chalk.gray('                             │'));
      console.log(chalk.gray('  └─────────────────────────────────────────────────────────────┘\n'));

      console.log(chalk.gray('  Settings:'));
      console.log(chalk.gray(`    Expires:     ${expiresAt.toLocaleString()}`));
      if (allowedMethods) {
        console.log(chalk.gray(`    Methods:     ${allowedMethods.join(', ')}`));
      }
      if (allowedPaths) {
        console.log(chalk.gray(`    Paths:       ${allowedPaths.join(', ')}`));
      }
      if (rateLimitPerMin) {
        console.log(chalk.gray(`    Rate limit:  ${rateLimitPerMin}/min`));
      }
      console.log();

      console.log(chalk.gray('  Usage:'));
      console.log(chalk.gray('    Share the URL - visitors see your app directly.\n'));

      console.log(chalk.gray('  curl example:'));
      console.log(chalk.cyan(`    curl ${proxyUrl}/api/health\n`));
    }

  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('ECONNREFUSED')) {
      console.error(chalk.red(`\n[x] Cannot connect to hub at ${hubUrl}`));
      console.log(chalk.gray('  Make sure the hub is running and accessible.\n'));
    } else {
      console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    }
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function fetchServices(hubUrl: string, apiKey: string): Promise<ServiceInfo[]> {
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': apiKey },
    });

    if (!response.ok) return [];

    return await response.json() as ServiceInfo[];
  } catch {
    return [];
  }
}
