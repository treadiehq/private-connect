import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { findAvailablePort, isPortAvailable } from '../ports';
import { updateShellState, clearShellState } from './shell';
import {
  findProjectConfig,
  parseResourceConfig,
  resolveResource,
  ConfigValidationError,
  ParsedProjectConfig,
} from '../resources/parser';
import { ResolvedResource } from '../resources/types';
import { createDirectForwarder, ForwarderHandle } from '../resources/forwarder';
import { formatEndpoint } from '../resources/endpoint';

interface DevOptions {
  hub: string;
  file?: string;
  background?: boolean;
  config?: string;
}

/**
 * connect dev - Provision all resources / services from pconnect.yml
 *
 * Supports both config formats:
 *   resources:  (new — named map with type, host, port, access)
 *   services:   (legacy — array with name + port, requires hub lookup)
 */
export async function devCommand(options: DevOptions) {
  const agentConfig = loadConfig();

  if (!agentConfig) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const configPath = options.file || findProjectConfig();

  if (!configPath) {
    console.log(chalk.yellow('\n[!] No pconnect.yml found.\n'));
    console.log(chalk.gray('  Create a manifest with:\n'));
    console.log(chalk.cyan('    connect dev --init'));
    console.log();
    process.exit(1);
  }

  let config: ParsedProjectConfig;
  try {
    config = parseResourceConfig(configPath);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      console.error(chalk.red(`\n[x] ${err.message}\n`));
      process.exit(1);
    }
    throw err;
  }

  const hasResources = Object.keys(config.resources).length > 0;
  const hasServices = config.services.length > 0;

  if (!hasResources && !hasServices) {
    console.error(chalk.red('\n[x] No resources or services defined in config.\n'));
    console.log(chalk.gray('  Add a resources: section to your pconnect.yml:\n'));
    console.log(chalk.cyan('    resources:'));
    console.log(chalk.cyan('      staging-db:'));
    console.log(chalk.cyan('        type: postgres'));
    console.log(chalk.cyan('        host: internal-db'));
    console.log(chalk.cyan('        port: 5432'));
    console.log(chalk.cyan('        access:'));
    console.log(chalk.cyan('          mode: tcp'));
    console.log();
    process.exit(1);
  }

  const hubUrl = config.hub || agentConfig.hubUrl || options.hub;

  console.log(chalk.cyan('\n🚀 Private Connect Dev Mode\n'));
  console.log(chalk.gray(`  Config: ${configPath}`));
  console.log(chalk.gray(`  Hub:    ${hubUrl}`));
  console.log();

  if (hasResources) {
    if (hasServices) {
      console.log(chalk.gray('  Using resources: section (services: is ignored when resources: is present)\n'));
    }
    await devWithResources(config, hubUrl, agentConfig);
  } else {
    await devWithLegacyServices(config, hubUrl, agentConfig);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// New path — resources: format
// ─────────────────────────────────────────────────────────────────────────────

interface DevConnection {
  name: string;
  handle: ForwarderHandle | { server: net.Server; localPort: number; close: () => Promise<void> };
}

async function devWithResources(
  config: ParsedProjectConfig,
  hubUrl: string,
  agentConfig: ReturnType<typeof loadConfig> & {},
) {
  const resolved: ResolvedResource[] = [];
  for (const [name, rc] of Object.entries(config.resources)) {
    resolved.push(resolveResource(name, rc));
  }

  const connections: DevConnection[] = [];
  const results: Array<{ name: string; success: boolean; port?: number; type?: string; error?: string; autoSelected?: boolean; requestedPort?: number }> = [];

  console.log(chalk.white('  Provisioning resources...\n'));

  for (const resource of resolved) {
    if (resource.via === 'hub') {
      // Hub-mediated: look up service on hub and tunnel through it
      const result = await connectResourceViaHub(resource, hubUrl, agentConfig);
      if (result.success && result.connection) {
        connections.push(result.connection);
      }
      results.push(result.result);
    } else {
      // Direct: TCP forwarder to targetHost:targetPort
      try {
        const handle = await createDirectForwarder(
          resource.targetHost,
          resource.targetPort,
          resource.targetPort,
        );
        connections.push({ name: resource.name, handle });
        const wasAutoSelected = handle.localPort !== resource.targetPort;
        results.push({
          name: resource.name,
          success: true,
          port: handle.localPort,
          type: resource.type,
          autoSelected: wasAutoSelected,
          requestedPort: wasAutoSelected ? resource.targetPort : undefined,
        });
      } catch (error) {
        const err = error as Error;
        results.push({ name: resource.name, success: false, error: err.message });
      }
    }
  }

  printResultsAndWait(connections, results);
}

type DevResultEntry = { name: string; success: boolean; port?: number; type?: string; error?: string; autoSelected?: boolean; requestedPort?: number };

async function connectResourceViaHub(
  resource: ResolvedResource,
  hubUrl: string,
  agentConfig: ReturnType<typeof loadConfig> & {},
): Promise<{ success: boolean; connection?: DevConnection; result: DevResultEntry }> {

  // Look up the service on the hub
  let tunnelPort: number | undefined;
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': agentConfig.apiKey },
    });
    if (response.ok) {
      const services = await response.json() as Array<{ name: string; tunnelPort?: number }>;
      const match = services.find(s => s.name.toLowerCase() === resource.name.toLowerCase());
      tunnelPort = match?.tunnelPort;
    }
  } catch {
    // Fall through to error
  }

  if (!tunnelPort) {
    return {
      success: false,
      result: { name: resource.name, success: false, error: 'Service not found on hub (via: hub requires a matching exposed service)' },
    };
  }

  try {
    const preferredPort = resource.targetPort;
    let localPort = preferredPort;
    let wasAutoSelected = false;

    if (!(await isPortAvailable(preferredPort))) {
      const alt = await findAvailablePort(preferredPort + 1);
      if (!alt) throw new Error(`Port ${preferredPort} is in use and no alternatives available`);
      localPort = alt;
      wasAutoSelected = true;
    }

    const server = await createHubTunnel(hubUrl, tunnelPort, localPort);
    const handle: ForwarderHandle = {
      server,
      localPort,
      close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
    };

    return {
      success: true,
      connection: { name: resource.name, handle },
      result: {
        name: resource.name,
        success: true,
        port: localPort,
        type: resource.type,
        autoSelected: wasAutoSelected,
        requestedPort: wasAutoSelected ? preferredPort : undefined,
      } ,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      result: { name: resource.name, success: false, error: err.message },
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Legacy path — services: format (hub lookup)
// ─────────────────────────────────────────────────────────────────────────────

async function devWithLegacyServices(
  config: ParsedProjectConfig,
  hubUrl: string,
  agentConfig: ReturnType<typeof loadConfig> & {},
) {
  let availableServices: Array<{
    name: string;
    targetPort: number;
    tunnelPort?: number;
    status: string;
  }> = [];

  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': agentConfig.apiKey },
    });
    if (response.ok) {
      availableServices = await response.json() as typeof availableServices;
    }
  } catch {
    console.log(chalk.yellow('  [!] Could not fetch service list from hub'));
  }

  const connections: DevConnection[] = [];
  const results: Array<{ name: string; success: boolean; port?: number; error?: string; autoSelected?: boolean; requestedPort?: number }> = [];

  console.log(chalk.white('  Connecting to services...\n'));

  for (const service of config.services) {
    const availableService = availableServices.find(
      s => s.name.toLowerCase() === service.name.toLowerCase()
    );

    const localPort = service.port || service.localPort || availableService?.targetPort || 0;

    if (!localPort) {
      results.push({ name: service.name, success: false, error: 'No port specified and service not found on hub' });
      continue;
    }

    if (!availableService) {
      results.push({ name: service.name, success: false, error: 'Service not found on hub' });
      continue;
    }

    if (!availableService.tunnelPort) {
      results.push({ name: service.name, success: false, error: 'Service has no active tunnel' });
      continue;
    }

    try {
      let actualPort = localPort;
      let wasAutoSelected = false;

      if (!(await isPortAvailable(localPort))) {
        const alternativePort = await findAvailablePort(localPort + 1);
        if (alternativePort) {
          actualPort = alternativePort;
          wasAutoSelected = true;
        } else {
          throw new Error(`Port ${localPort} is in use and no alternatives available`);
        }
      }

      const server = await createHubTunnel(hubUrl, availableService.tunnelPort, actualPort);
      const handle: ForwarderHandle = {
        server,
        localPort: actualPort,
        close: () => new Promise<void>((resolve) => { server.close(() => resolve()); }),
      };

      connections.push({ name: service.name, handle });
      results.push({
        name: service.name,
        success: true,
        port: actualPort,
        autoSelected: wasAutoSelected,
        requestedPort: wasAutoSelected ? localPort : undefined,
      });
    } catch (error) {
      const err = error as Error;
      results.push({ name: service.name, success: false, error: err.message });
    }
  }

  printResultsAndWait(connections, results);
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared output + lifecycle
// ─────────────────────────────────────────────────────────────────────────────

function printResultsAndWait(
  connections: DevConnection[],
  results: Array<{ name: string; success: boolean; port?: number; type?: string; error?: string; autoSelected?: boolean; requestedPort?: number }>,
) {
  console.log();

  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log(chalk.green(`  [ok] ${successful.length} resource(s) connected:\n`));
    successful.forEach(r => {
      const portInfo = r.autoSelected
        ? chalk.yellow(` → localhost:${r.port} (was ${r.requestedPort})`)
        : chalk.gray(` → localhost:${r.port}`);
      const typeTag = r.type ? chalk.gray(` [${r.type}]`) : '';
      console.log(chalk.white(`    ${r.name}`) + typeTag + portInfo);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`  [!] ${failed.length} resource(s) failed:\n`));
    failed.forEach(r => {
      console.log(chalk.gray(`    ${r.name}: ${r.error}`));
    });
    console.log();
  }

  if (connections.length === 0) {
    console.error(chalk.red('  [x] No resources connected.\n'));
    process.exit(1);
  }

  updateShellState(
    successful.map(r => ({ name: r.name, port: r.port! })),
    process.cwd()
  );

  console.log(chalk.gray('  Set in your .env:'));
  successful.forEach(r => {
    const envName = r.name.toUpperCase().replace(/-/g, '_');
    console.log(chalk.cyan(`    ${envName}_URL=localhost:${r.port}`));
  });
  console.log();

  console.log(chalk.gray('  Press Ctrl+C to disconnect all resources\n'));

  const cleanup = async () => {
    console.log(chalk.yellow('\n👋 Disconnecting resources...'));
    for (const conn of connections) {
      await conn.handle.close().catch(() => {});
    }
    clearShellState();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process alive
  return new Promise(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub tunnel — TCP proxy through the hub's tunnel port
// ─────────────────────────────────────────────────────────────────────────────

function createHubTunnel(
  hubUrl: string,
  tunnelPort: number,
  localPort: number,
): Promise<net.Server> {
  return new Promise((resolve, reject) => {
    const hubHost = new URL(hubUrl).hostname;

    const server = net.createServer((clientSocket) => {
      const proxySocket = net.createConnection({
        host: hubHost,
        port: tunnelPort,
      }, () => {
        clientSocket.pipe(proxySocket);
        proxySocket.pipe(clientSocket);
      });

      proxySocket.on('error', () => clientSocket.destroy());
      clientSocket.on('error', () => proxySocket.destroy());
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${localPort} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(localPort, '127.0.0.1', () => resolve(server));
  });
}

/**
 * connect dev --init — scaffold a new pconnect.yml in the current directory
 */
export async function devInitCommand(options: DevOptions) {
  const configPath = path.join(process.cwd(), 'pconnect.yml');

  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('\n[!] Config file already exists: pconnect.yml\n'));
    return;
  }

  const agentConfig = loadConfig();
  const hubUrl = agentConfig?.hubUrl || options.hub;

  // Try to fetch available services from hub to pre-populate
  let services: Array<{ name: string; targetPort: number }> = [];

  if (agentConfig) {
    try {
      const response = await fetch(`${hubUrl}/v1/services`, {
        headers: { 'x-api-key': agentConfig.apiKey },
      });
      if (response.ok) {
        services = await response.json() as typeof services;
      }
    } catch {
      // Ignore — we'll use the template defaults
    }
  }

  let configContent: string;

  if (services.length > 0) {
    configContent = `# pconnect.yml — your project's connection manifest
#
# Define what your software connects to. Run: connect dev
# Docs: https://github.com/treadiehq/private-connect

resources:
`;
    services.forEach(s => {
      const type = guessResourceType(s.name, s.targetPort);
      configContent += `  ${s.name}:
    type: ${type}
    host: ${s.name}
    port: ${s.targetPort}
    access:
      mode: tcp
`;
    });
  } else {
    configContent = `# pconnect.yml — your project's connection manifest
#
# Define what your software connects to. Run: connect dev
# Docs: https://github.com/treadiehq/private-connect

resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp

  redis-cache:
    type: redis
    host: redis.internal
    port: 6379
    access:
      mode: tcp
`;
  }

  fs.writeFileSync(configPath, configContent);

  console.log(chalk.green('\n[ok] Created pconnect.yml\n'));
  console.log(chalk.gray('  Edit the manifest to declare your resources, then run:'));
  console.log(chalk.cyan('    connect dev\n'));
}

function guessResourceType(name: string, port: number): string {
  const lower = name.toLowerCase();
  if (lower.includes('postgres') || lower.includes('pg') || port === 5432) return 'postgres';
  if (lower.includes('mysql') || lower.includes('maria') || port === 3306) return 'mysql';
  if (lower.includes('redis') || port === 6379) return 'redis';
  if (lower.includes('http') || lower.includes('api') || port === 80 || port === 443 || port === 3000 || port === 8080) return 'http';
  return 'generic-tcp';
}
