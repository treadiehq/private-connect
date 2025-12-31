import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import chalk from 'chalk';
import { loadConfig } from '../config';

interface DevOptions {
  hub: string;
  file?: string;
  background?: boolean;
  config?: string;
}

interface ProjectService {
  name: string;
  port?: number;
  localPort?: number; // alias for port
  protocol?: string;
}

interface ProjectConfig {
  services: ProjectService[];
  hub?: string;
}

const CONFIG_FILENAMES = [
  'pconnect.yml',
  'pconnect.yaml',
  'pconnect.json',
  '.pconnect.yml',
  '.pconnect.yaml',
  '.pconnect.json',
];

function findProjectConfig(startDir?: string): string | null {
  const dir = startDir || process.cwd();
  
  for (const filename of CONFIG_FILENAMES) {
    const configPath = path.join(dir, filename);
    if (fs.existsSync(configPath)) {
      return configPath;
    }
  }
  
  // Check parent directory (up to 3 levels)
  const parent = path.dirname(dir);
  if (parent !== dir && dir.split(path.sep).length > 3) {
    return findProjectConfig(parent);
  }
  
  return null;
}

function parseYaml(content: string): ProjectConfig {
  // Simple YAML parser for our limited use case
  const lines = content.split('\n');
  const config: ProjectConfig = { services: [] };
  let currentService: ProjectService | null = null;
  let inServices = false;

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (trimmed.startsWith('#') || trimmed === '') continue;
    
    if (trimmed === 'services:') {
      inServices = true;
      continue;
    }
    
    if (trimmed.startsWith('hub:')) {
      config.hub = trimmed.split(':').slice(1).join(':').trim().replace(/['"]/g, '');
      continue;
    }
    
    if (inServices) {
      // New service entry
      if (trimmed.startsWith('- name:')) {
        if (currentService) {
          config.services.push(currentService);
        }
        currentService = {
          name: trimmed.replace('- name:', '').trim().replace(/['"]/g, ''),
        };
      } else if (currentService) {
        // Service property
        if (trimmed.startsWith('port:') || trimmed.startsWith('local_port:') || trimmed.startsWith('localPort:')) {
          const value = trimmed.split(':')[1].trim();
          currentService.port = parseInt(value, 10);
        } else if (trimmed.startsWith('protocol:')) {
          currentService.protocol = trimmed.split(':')[1].trim().replace(/['"]/g, '');
        }
      }
    }
  }
  
  if (currentService) {
    config.services.push(currentService);
  }
  
  return config;
}

function loadProjectConfig(configPath: string): ProjectConfig | null {
  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    
    if (configPath.endsWith('.json')) {
      return JSON.parse(content) as ProjectConfig;
    } else {
      return parseYaml(content);
    }
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`✗ Failed to parse config: ${err.message}`));
    return null;
  }
}

/**
 * connect dev - Connect to all services defined in project config
 */
export async function devCommand(options: DevOptions) {
  const agentConfig = loadConfig();
  
  if (!agentConfig) {
    console.error(chalk.red('\n✗ Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  // Find project config
  const configPath = options.file || findProjectConfig();
  
  if (!configPath) {
    console.log(chalk.yellow('\n⚠ No project config found.\n'));
    console.log(chalk.gray('  Create a pconnect.yml file:\n'));
    console.log(chalk.cyan('    services:'));
    console.log(chalk.cyan('      - name: staging-db'));
    console.log(chalk.cyan('        port: 5432'));
    console.log(chalk.cyan('      - name: redis'));
    console.log(chalk.cyan('        port: 6379'));
    console.log();
    process.exit(1);
  }

  const projectConfig = loadProjectConfig(configPath);
  
  if (!projectConfig || projectConfig.services.length === 0) {
    console.error(chalk.red('\n✗ No services defined in config.\n'));
    process.exit(1);
  }

  const hubUrl = projectConfig.hub || agentConfig.hubUrl || options.hub;

  console.log(chalk.cyan('\n🚀 Private Connect Dev Mode\n'));
  console.log(chalk.gray(`  Config: ${configPath}`));
  console.log(chalk.gray(`  Hub:    ${hubUrl}`));
  console.log();

  // Fetch available services from hub
  let availableServices: Array<{
    name: string;
    targetPort: number;
    tunnelPort?: number;
    status: string;
  }> = [];

  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'x-api-key': agentConfig.apiKey,
      },
    });

    if (response.ok) {
      availableServices = await response.json() as typeof availableServices;
    }
  } catch {
    console.log(chalk.yellow('  ⚠ Could not fetch service list from hub'));
  }

  // Connect to each service
  const tunnels: Array<{ server: net.Server; name: string; port: number }> = [];
  const results: Array<{ name: string; success: boolean; port?: number; error?: string }> = [];

  console.log(chalk.white('  Connecting to services...\n'));

  for (const service of projectConfig.services) {
    const availableService = availableServices.find(
      s => s.name.toLowerCase() === service.name.toLowerCase()
    );

    const localPort = service.port || service.localPort || availableService?.targetPort || 0;

    if (!localPort) {
      results.push({
        name: service.name,
        success: false,
        error: 'No port specified and service not found on hub',
      });
      continue;
    }

    // Check if service exists and is online
    if (!availableService) {
      results.push({
        name: service.name,
        success: false,
        error: 'Service not found on hub',
      });
      continue;
    }

    if (!availableService.tunnelPort) {
      results.push({
        name: service.name,
        success: false,
        error: 'Service has no active tunnel',
      });
      continue;
    }

    // Create local tunnel
    try {
      const server = await createTunnel(
        hubUrl,
        availableService.tunnelPort,
        localPort,
      );
      
      tunnels.push({ server, name: service.name, port: localPort });
      results.push({ name: service.name, success: true, port: localPort });
    } catch (error) {
      const err = error as Error;
      results.push({
        name: service.name,
        success: false,
        error: err.message,
      });
    }
  }

  // Display results
  console.log();
  
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  if (successful.length > 0) {
    console.log(chalk.green(`  ✓ ${successful.length} service(s) connected:\n`));
    successful.forEach(r => {
      console.log(chalk.white(`    ${r.name}`) + chalk.gray(` → localhost:${r.port}`));
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`  ⚠ ${failed.length} service(s) failed:\n`));
    failed.forEach(r => {
      console.log(chalk.gray(`    ${r.name}: ${r.error}`));
    });
    console.log();
  }

  if (tunnels.length === 0) {
    console.error(chalk.red('  ✗ No services connected.\n'));
    process.exit(1);
  }

  // Show environment variable suggestions
  console.log(chalk.gray('  Set in your .env:'));
  successful.forEach(r => {
    const envName = r.name.toUpperCase().replace(/-/g, '_');
    console.log(chalk.cyan(`    ${envName}_URL=localhost:${r.port}`));
  });
  console.log();

  console.log(chalk.gray('  Press Ctrl+C to disconnect all services\n'));

  // Handle cleanup
  const cleanup = () => {
    console.log(chalk.yellow('\n👋 Disconnecting services...'));
    tunnels.forEach(t => {
      t.server.close();
    });
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Keep process alive
  await new Promise(() => {});
}

async function createTunnel(
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

      proxySocket.on('error', () => {
        clientSocket.destroy();
      });

      clientSocket.on('error', () => {
        proxySocket.destroy();
      });
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        reject(new Error(`Port ${localPort} is already in use`));
      } else {
        reject(err);
      }
    });

    server.listen(localPort, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

/**
 * Initialize a new project config file
 */
export async function devInitCommand(options: DevOptions) {
  const configPath = path.join(process.cwd(), 'pconnect.yml');
  
  if (fs.existsSync(configPath)) {
    console.log(chalk.yellow('\n⚠ Config file already exists: pconnect.yml\n'));
    return;
  }

  const agentConfig = loadConfig();
  const hubUrl = agentConfig?.hubUrl || options.hub;

  // Try to fetch available services
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
      // Ignore
    }
  }

  // Generate config
  let configContent = `# Private Connect project config
# Run: connect dev

services:
`;

  if (services.length > 0) {
    services.forEach(s => {
      configContent += `  - name: ${s.name}
    port: ${s.targetPort}
`;
    });
  } else {
    configContent += `  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
`;
  }

  fs.writeFileSync(configPath, configContent);
  
  console.log(chalk.green('\n✓ Created pconnect.yml\n'));
  console.log(chalk.gray('  Edit the file to configure your services, then run:'));
  console.log(chalk.cyan('    connect dev\n'));
}

