import * as fs from 'fs';
import * as path from 'path';
import * as net from 'net';
import chalk from 'chalk';
import { loadConfig } from '../config';
import { findAvailablePort, isPortAvailable } from '../ports';
import { updateShellState, clearShellState } from './shell';

interface CloneOptions {
  hub: string;
  output?: string;  // .env output path
  noEnv?: boolean;  // Skip .env generation
  background?: boolean;
  config?: string;
}

interface AgentInfo {
  id: string;
  label: string;
  name?: string;
  status: string;
  lastSeen: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort?: number;
  protocol: string;
  agentId: string;
  agentLabel?: string;
  status: string;
}

interface ClonableEnvironment {
  agent: AgentInfo;
  services: ServiceInfo[];
}

/**
 * connect clone <teammate> - Clone a teammate's environment
 */
export async function cloneCommand(target: string, options: CloneOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.cyan(`\n🧬 Cloning environment from ${chalk.bold(target)}...\n`));

  try {
    // Step 1: Find the teammate's agent
    const environment = await findTeammateEnvironment(hubUrl, config.apiKey, target);
    
    if (!environment) {
      console.error(chalk.red(`[x] Could not find teammate "${target}"`));
      console.log();
      console.log(chalk.gray('  Tips:'));
      console.log(chalk.gray('    • Use their agent label (shown in their terminal/dashboard)'));
      console.log(chalk.gray('    • They might need to be online: connect up'));
      console.log(chalk.gray('    • List available teammates: connect clone --list'));
      console.log();
      process.exit(1);
    }

    if (environment.services.length === 0) {
      console.error(chalk.red(`[x] ${target} has no services exposed`));
      console.log(chalk.gray('  They need to expose services first: connect expose <target>\n'));
      process.exit(1);
    }

    // Step 2: Show what we're cloning
    console.log(chalk.white(`  Found ${chalk.bold(environment.agent.label)}'s environment:\n`));
    
    environment.services.forEach(service => {
      const status = service.tunnelPort ? chalk.green('●') : chalk.red('○');
      console.log(`    ${status} ${chalk.white(service.name)} → ${service.targetHost}:${service.targetPort}`);
    });
    console.log();

    // Step 3: Connect to each service
    const onlineServices = environment.services.filter(s => s.tunnelPort);
    
    if (onlineServices.length === 0) {
      console.error(chalk.red(`[x] No services are currently online`));
      console.log(chalk.gray(`  ${target} may have disconnected.\n`));
      process.exit(1);
    }

    console.log(chalk.white('  Connecting to services...\n'));

    const tunnels: Array<{ server: net.Server; name: string; port: number; originalPort: number }> = [];
    const results: Array<{ name: string; success: boolean; port?: number; error?: string }> = [];

    for (const service of onlineServices) {
      try {
        let localPort = service.targetPort;
        let portChanged = false;
        
        // Check if port is available
        if (!(await isPortAvailable(localPort))) {
          const altPort = await findAvailablePort(localPort + 1);
          if (altPort) {
            localPort = altPort;
            portChanged = true;
          } else {
            throw new Error(`Port ${service.targetPort} in use, no alternatives`);
          }
        }

        const server = await createTunnel(
          hubUrl,
          service.tunnelPort!,
          localPort,
        );

        tunnels.push({ 
          server, 
          name: service.name, 
          port: localPort,
          originalPort: service.targetPort,
        });
        
        const portInfo = portChanged 
          ? chalk.yellow(` → localhost:${localPort} (was ${service.targetPort})`)
          : chalk.gray(` → localhost:${localPort}`);
        console.log(chalk.green(`    [ok] ${service.name}`) + portInfo);
        
        results.push({ name: service.name, success: true, port: localPort });
      } catch (error) {
        const err = error as Error;
        console.log(chalk.yellow(`    [!] ${service.name}`) + chalk.gray(` → ${err.message}`));
        results.push({ name: service.name, success: false, error: err.message });
      }
    }

    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);

    if (tunnels.length === 0) {
      console.error(chalk.red('\n[x] Could not connect to any services.\n'));
      process.exit(1);
    }

    console.log();
    console.log(chalk.green.bold(`[ok] Cloned ${successful.length} service(s) from ${environment.agent.label}\n`));

    // Step 4: Generate .env file
    if (!options.noEnv) {
      const envPath = options.output || '.env.pconnect';
      const envContent = generateEnvFile(successful, environment.agent.label);
      
      try {
        fs.writeFileSync(envPath, envContent);
        console.log(chalk.gray(`  Generated: ${chalk.cyan(envPath)}`));
        console.log(chalk.gray('  Use with: source .env.pconnect or copy to your .env\n'));
      } catch {
        console.log(chalk.yellow(`  [!] Could not write ${envPath}\n`));
      }
    }

    // Update shell state
    updateShellState(
      successful.map(r => ({ name: r.name, port: r.port! })),
      process.cwd()
    );

    // Show connection examples
    console.log(chalk.gray('  Connection examples:'));
    successful.slice(0, 3).forEach(r => {
      const envName = r.name.toUpperCase().replace(/-/g, '_');
      console.log(chalk.cyan(`    ${envName}_URL=localhost:${r.port}`));
    });
    if (successful.length > 3) {
      console.log(chalk.gray(`    ... and ${successful.length - 3} more (see ${options.output || '.env.pconnect'})`));
    }
    console.log();

    if (failed.length > 0) {
      console.log(chalk.yellow(`  [!] ${failed.length} service(s) could not connect (may be offline)`));
      console.log();
    }

    console.log(chalk.gray('  Press Ctrl+C to disconnect all services\n'));

    // Handle cleanup
    const cleanup = () => {
      console.log(chalk.yellow('\n👋 Disconnecting cloned environment...'));
      tunnels.forEach(t => {
        t.server.close();
      });
      clearShellState();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep process alive
    await new Promise(() => {});

  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('ECONNREFUSED')) {
      console.error(chalk.red(`\n[x] Cannot connect to hub at ${hubUrl}`));
      console.log(chalk.gray('  Make sure the hub is running.\n'));
    } else {
      console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    }
    process.exit(1);
  }
}

/**
 * connect clone --list - List teammates with clonable environments
 */
export async function cloneListCommand(options: CloneOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.cyan('\n👥 Teammates with clonable environments\n'));

  try {
    // Fetch all agents in the workspace
    const agentsResponse = await fetch(`${hubUrl}/v1/agents`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!agentsResponse.ok) {
      console.error(chalk.red(`[x] Failed to fetch agents: ${agentsResponse.statusText}`));
      process.exit(1);
    }

    const agents = await agentsResponse.json() as AgentInfo[];
    
    // Fetch all services to see what each agent has
    const servicesResponse = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    const services = servicesResponse.ok 
      ? await servicesResponse.json() as ServiceInfo[]
      : [];

    // Group services by agent
    const agentServices = new Map<string, ServiceInfo[]>();
    for (const service of services) {
      const existing = agentServices.get(service.agentId) || [];
      existing.push(service);
      agentServices.set(service.agentId, existing);
    }

    // Filter to agents with services (excluding self)
    const clonableAgents = agents.filter(agent => {
      if (agent.id === config.agentId) return false;
      const svcList = agentServices.get(agent.id) || [];
      return svcList.length > 0;
    });

    if (clonableAgents.length === 0) {
      console.log(chalk.gray('  No teammates with exposed services found.\n'));
      console.log(chalk.gray('  Teammates need to expose services: connect expose <target>\n'));
      return;
    }

    for (const agent of clonableAgents) {
      const svcList = agentServices.get(agent.id) || [];
      const onlineCount = svcList.filter(s => s.tunnelPort).length;
      const status = agent.status === 'online' ? chalk.green('●') : chalk.gray('○');
      
      console.log(`  ${status} ${chalk.white.bold(agent.label)}${agent.name ? chalk.gray(` (${agent.name})`) : ''}`);
      console.log(chalk.gray(`    Services: ${svcList.length} (${onlineCount} online)`));
      
      svcList.slice(0, 3).forEach(svc => {
        const svcStatus = svc.tunnelPort ? chalk.green('●') : chalk.gray('○');
        console.log(chalk.gray(`      ${svcStatus} ${svc.name}`));
      });
      
      if (svcList.length > 3) {
        console.log(chalk.gray(`      ... and ${svcList.length - 3} more`));
      }
      console.log();
    }

    console.log(chalk.gray('  Clone with: connect clone <label>\n'));

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    process.exit(1);
  }
}

/**
 * Find a teammate's environment by label or name
 */
async function findTeammateEnvironment(
  hubUrl: string,
  apiKey: string,
  target: string,
): Promise<ClonableEnvironment | null> {
  // Normalize target
  const searchTarget = target.toLowerCase().trim();

  // Fetch all agents
  const agentsResponse = await fetch(`${hubUrl}/v1/agents`, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!agentsResponse.ok) {
    throw new Error(`Failed to fetch agents: ${agentsResponse.statusText}`);
  }

  const agents = await agentsResponse.json() as AgentInfo[];
  
  // Find matching agent
  const agent = agents.find(a => 
    a.label.toLowerCase() === searchTarget ||
    a.name?.toLowerCase() === searchTarget ||
    a.label.toLowerCase().includes(searchTarget)
  );

  if (!agent) {
    return null;
  }

  // Fetch services for this agent
  const servicesResponse = await fetch(`${hubUrl}/v1/services`, {
    headers: {
      'x-api-key': apiKey,
    },
  });

  if (!servicesResponse.ok) {
    throw new Error(`Failed to fetch services: ${servicesResponse.statusText}`);
  }

  const allServices = await servicesResponse.json() as ServiceInfo[];
  const services = allServices.filter(s => s.agentId === agent.id);

  return { agent, services };
}

/**
 * Create a TCP tunnel to a service
 */
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
        reject(new Error(`Port ${localPort} in use`));
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
 * Generate .env file content
 */
function generateEnvFile(
  services: Array<{ name: string; port?: number }>,
  sourceLabel: string,
): string {
  const lines: string[] = [
    `# Private Connect - Cloned from ${sourceLabel}`,
    `# Generated at ${new Date().toISOString()}`,
    `#`,
    `# Source these variables:`,
    `#   source .env.pconnect`,
    `#`,
    `# Or copy the ones you need to your .env`,
    ``,
  ];

  for (const service of services) {
    if (!service.port) continue;
    
    const envName = service.name.toUpperCase().replace(/-/g, '_').replace(/\./g, '_');
    
    // Generate common connection string patterns
    lines.push(`# ${service.name}`);
    lines.push(`${envName}_HOST=localhost`);
    lines.push(`${envName}_PORT=${service.port}`);
    lines.push(`${envName}_URL=localhost:${service.port}`);
    
    // Add protocol-specific hints
    if (service.name.includes('postgres') || service.name.includes('pg') || service.name.includes('db')) {
      lines.push(`# ${envName}_DATABASE_URL=postgres://user:pass@localhost:${service.port}/dbname`);
    } else if (service.name.includes('redis')) {
      lines.push(`# ${envName}_REDIS_URL=redis://localhost:${service.port}`);
    } else if (service.name.includes('mongo')) {
      lines.push(`# ${envName}_MONGODB_URL=mongodb://localhost:${service.port}/dbname`);
    } else if (service.name.includes('api') || service.name.includes('http')) {
      lines.push(`# ${envName}_API_URL=http://localhost:${service.port}`);
    }
    
    lines.push(``);
  }

  lines.push(`# Re-clone anytime with: connect clone ${sourceLabel}`);

  return lines.join('\n');
}

