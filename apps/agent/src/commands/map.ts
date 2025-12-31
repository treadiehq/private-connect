import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';

interface MapOptions {
  hub: string;
  config?: string;
  port?: number;
  remove?: boolean;
}

interface ServiceMapping {
  serviceName: string;
  localPort: number;
  protocol: string;
  addedAt: string;
}

interface MappingsFile {
  mappings: ServiceMapping[];
  proxyPort: number;
}

const MAPPINGS_FILE = 'mappings.json';

function getMappingsPath(): string {
  return path.join(getConfigDir(), MAPPINGS_FILE);
}

function loadMappings(): MappingsFile {
  const mappingsPath = getMappingsPath();
  try {
    if (fs.existsSync(mappingsPath)) {
      return JSON.parse(fs.readFileSync(mappingsPath, 'utf-8'));
    }
  } catch {
    // Ignore errors, return default
  }
  return { mappings: [], proxyPort: 3000 };
}

function saveMappings(data: MappingsFile): void {
  const mappingsPath = getMappingsPath();
  const configDir = getConfigDir();
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  fs.writeFileSync(mappingsPath, JSON.stringify(data, null, 2));
}

/**
 * connect map <service> [localPort]
 * Maps a service to a local port
 * 
 * Examples:
 *   connect map staging-db 5432
 *   connect map staging-db              # uses default port from service
 *   connect map --remove staging-db     # removes mapping
 *   connect map --list                  # shows all mappings
 */
export async function mapCommand(service: string | undefined, localPort: string | undefined, options: MapOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n✗ Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  // Handle --remove flag
  if (options.remove && service) {
    return removeMapping(service);
  }

  // If no service specified, list mappings
  if (!service) {
    return listMappings();
  }

  // Add or update mapping
  await addMapping(hubUrl, config.apiKey, service, localPort ? parseInt(localPort, 10) : undefined);
}

async function addMapping(hubUrl: string, apiKey: string, serviceName: string, localPort?: number) {
  console.log(chalk.cyan(`\n📍 Mapping ${serviceName}...\n`));

  try {
    // Fetch service info to get default port if not specified
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      console.error(chalk.red(`✗ Failed to fetch services: ${response.statusText}`));
      process.exit(1);
    }

    const services = await response.json() as Array<{
      id: string;
      name: string;
      targetPort: number;
      tunnelPort?: number;
      protocol: string;
      status: string;
    }>;

    const service = services.find(s => s.name.toLowerCase() === serviceName.toLowerCase());
    
    if (!service) {
      console.error(chalk.red(`✗ Service "${serviceName}" not found`));
      console.log(chalk.gray('\n  Available services:'));
      services.forEach(s => {
        console.log(chalk.gray(`    • ${s.name}`));
      });
      console.log();
      process.exit(1);
    }

    // Determine local port
    const port = localPort || service.targetPort;

    // Check if port is available
    const portAvailable = await isPortAvailable(port);
    if (!portAvailable) {
      console.error(chalk.yellow(`⚠ Port ${port} is already in use`));
      console.log(chalk.gray(`  Try: ${chalk.cyan(`connect map ${serviceName} <other-port>`)}\n`));
      process.exit(1);
    }

    // Save mapping
    const mappings = loadMappings();
    
    // Remove existing mapping for this service if any
    mappings.mappings = mappings.mappings.filter(m => m.serviceName !== service.name);
    
    // Add new mapping
    mappings.mappings.push({
      serviceName: service.name,
      localPort: port,
      protocol: service.protocol,
      addedAt: new Date().toISOString(),
    });

    saveMappings(mappings);

    console.log(chalk.green(`✓ Mapped ${chalk.white(service.name)} → ${chalk.cyan(`localhost:${port}`)}\n`));
    
    // Show usage hint
    console.log(chalk.gray('  To activate all mappings, run:'));
    console.log(chalk.cyan(`    connect proxy\n`));
    
    console.log(chalk.gray('  Or access directly via subdomain:'));
    console.log(chalk.cyan(`    http://${service.name}.localhost:3000\n`));

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n✗ Error: ${err.message}\n`));
    process.exit(1);
  }
}

function removeMapping(serviceName: string) {
  const mappings = loadMappings();
  const before = mappings.mappings.length;
  
  mappings.mappings = mappings.mappings.filter(m => m.serviceName.toLowerCase() !== serviceName.toLowerCase());
  
  if (mappings.mappings.length === before) {
    console.log(chalk.yellow(`\n⚠ No mapping found for "${serviceName}"\n`));
    return;
  }

  saveMappings(mappings);
  console.log(chalk.green(`\n✓ Removed mapping for ${chalk.white(serviceName)}\n`));
}

function listMappings() {
  const mappings = loadMappings();

  if (mappings.mappings.length === 0) {
    console.log(chalk.gray('\n  No mappings configured.\n'));
    console.log(chalk.gray('  Add a mapping:'));
    console.log(chalk.cyan('    connect map <service-name> [local-port]\n'));
    console.log(chalk.gray('  Example:'));
    console.log(chalk.cyan('    connect map staging-db 5432\n'));
    return;
  }

  console.log(chalk.cyan('\n📍 Current Mappings\n'));
  
  mappings.mappings.forEach(mapping => {
    console.log(chalk.white(`  ${mapping.serviceName}`) + chalk.gray(` → localhost:${mapping.localPort}`));
  });
  
  console.log();
  console.log(chalk.gray('  Start proxy to activate:'));
  console.log(chalk.cyan('    connect proxy\n'));
}

async function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    
    server.once('error', () => {
      resolve(false);
    });
    
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Status command to show all active mappings and their connection status
 */
export async function mapStatusCommand(options: MapOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n✗ Agent not configured'));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;
  const mappings = loadMappings();

  if (mappings.mappings.length === 0) {
    console.log(chalk.gray('\n  No mappings configured.\n'));
    return;
  }

  console.log(chalk.cyan('\n📍 Mapping Status\n'));

  try {
    // Fetch current service status
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    const services = response.ok 
      ? await response.json() as Array<{ name: string; status: string; tunnelPort?: number }>
      : [];

    for (const mapping of mappings.mappings) {
      const service = services.find(s => s.name === mapping.serviceName);
      const isOnline = service?.status === 'ONLINE' && service.tunnelPort;
      const portAvailable = await isPortAvailable(mapping.localPort);

      const statusIcon = isOnline ? chalk.green('✓') : chalk.red('✗');
      const portStatus = portAvailable ? chalk.gray('(port free)') : chalk.yellow('(port in use)');

      console.log(`  ${statusIcon} ${chalk.white(mapping.serviceName)} → localhost:${mapping.localPort} ${portStatus}`);
    }

    console.log();

  } catch {
    // Show mappings without status on error
    mappings.mappings.forEach(mapping => {
      console.log(chalk.gray(`  ? ${mapping.serviceName} → localhost:${mapping.localPort}`));
    });
    console.log();
  }
}

