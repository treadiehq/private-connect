/**
 * Unified `connect` command - The primitive layer
 * 
 * This is the "one command" that contextually routes to expose or reach.
 * All existing functionality remains available via explicit commands.
 * 
 * Usage:
 *   connect localhost:5432      # Expose (auto-named "postgres")
 *   connect :3000               # Expose localhost:3000
 *   connect prod-db             # Reach a service
 *   connect postgres.alice      # Reach teammate's service
 *   connect                     # Show status / interactive picker
 */

import chalk from 'chalk';
import { loadConfig } from '../config';
import { detectService, resolveTarget, isLocallyReachable, makeNameUnique } from '../detect';
import { exposeCommand } from './expose';
import { reachCommand } from './reach';
import { statusCommand } from './doctor';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ConnectOptions {
  hub: string;
  name?: string;
  port?: string;
  timeout?: number;
  public?: boolean;
  protocol?: string;
  check?: boolean;
  json?: boolean;
  config?: string;
  share?: boolean;
  ttl?: string;
  link?: boolean;
  linkExpires?: string;
}

interface ServiceInfo {
  id: string;
  name: string;
  targetPort: number;
  status: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Command
// ─────────────────────────────────────────────────────────────────────────────

export async function connectCommand(target: string | undefined, options: ConnectOptions) {
  const resolution = resolveTarget(target);

  // No target = show status
  if (!target || target.trim() === '') {
    await showStatus(options);
    return;
  }

  // Route to appropriate command
  if (resolution.action === 'expose') {
    await handleExpose(resolution.target, resolution.port!, options);
  } else {
    await handleReach(resolution.target, resolution.serviceName, resolution.teammate, options);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Expose Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleExpose(target: string, port: number, options: ConnectOptions) {
  const config = loadConfig();
  
  // Check if agent is configured
  if (!config) {
    console.log(chalk.yellow('\n[!] First time? Let\'s get you connected.\n'));
    console.log(chalk.gray('  Run: ') + chalk.cyan('connect up') + chalk.gray(' to authenticate\n'));
    console.log(chalk.gray('  Or provide an API key:\n'));
    console.log(chalk.cyan('    connect up --api-key <your-api-key>\n'));
    process.exit(1);
  }

  // Check if the target is actually reachable locally
  const [host] = target.split(':');
  const isReachable = await isLocallyReachable(host, port);
  
  if (!isReachable) {
    console.log(chalk.yellow(`\n[!] Nothing seems to be running on ${target}`));
    console.log(chalk.gray('  Start your service first, then run this command again.\n'));
    process.exit(1);
  }

  // Use provided name or auto-detect
  let serviceName = options.name;
  
  if (!serviceName) {
    const detected = await detectService(port, host);
    
    // Get existing service names to avoid conflicts
    const existingNames = await getExistingServiceNames(config.hubUrl, config.apiKey);
    serviceName = makeNameUnique(detected.name, port, existingNames);
    
    if (detected.confidence === 'low') {
      console.log(chalk.gray(`\n  Auto-naming as "${serviceName}" (use -n <name> to override)`));
    } else {
      console.log(chalk.gray(`\n  Detected: ${detected.source} → "${serviceName}"`));
    }
  }

  // Delegate to expose command
  const exposeResult = await exposeCommand(target, {
    name: serviceName,
    hub: options.hub,
    protocol: options.protocol || 'auto',
    public: options.public,
    link: options.link,
    linkExpires: options.linkExpires,
    config: options.config,
  });

  // Create share link if --share flag was passed
  if (options.share && exposeResult?.serviceId) {
    await createShareLink(config.hubUrl, config.apiKey, exposeResult.serviceId, serviceName!, options.ttl);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reach Handler
// ─────────────────────────────────────────────────────────────────────────────

async function handleReach(
  target: string,
  serviceName: string | undefined,
  teammate: string | undefined,
  options: ConnectOptions
) {
  const config = loadConfig();
  
  if (!config) {
    console.log(chalk.yellow('\n[!] First time? Let\'s get you connected.\n'));
    console.log(chalk.gray('  Run: ') + chalk.cyan('connect up') + chalk.gray(' to authenticate\n'));
    process.exit(1);
  }

  // If teammate is specified, we need to look up their service
  if (teammate && serviceName) {
    const teammateService = await findTeammateService(
      config.hubUrl,
      config.apiKey,
      teammate,
      serviceName
    );
    
    if (teammateService) {
      target = teammateService;
    } else {
      console.log(chalk.red(`\n[x] Service "${serviceName}" not found for teammate "${teammate}"`));
      console.log(chalk.gray('\n  Check available services with: ') + chalk.cyan('connect clone --list\n'));
      process.exit(1);
    }
  }

  // Delegate to reach command
  await reachCommand(target, {
    hub: options.hub,
    timeout: options.timeout || 5000,
    port: options.port,
    check: options.check || false,
    json: options.json || false,
    config: options.config,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Handler
// ─────────────────────────────────────────────────────────────────────────────

async function showStatus(options: ConnectOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.log(chalk.cyan('\n✨ Private Connect\n'));
    console.log(chalk.gray('  The fastest way to securely expose & use a private service.\n'));
    console.log(chalk.white('  Get started:\n'));
    console.log(chalk.cyan('    connect up') + chalk.gray('                # Authenticate'));
    console.log(chalk.cyan('    connect localhost:5432') + chalk.gray('    # Expose a service'));
    console.log(chalk.cyan('    connect prod-db') + chalk.gray('           # Connect to a service\n'));
    console.log(chalk.gray('  Learn more: https://privateconnect.co\n'));
    return;
  }

  // Show quick status
  await statusCommand({ json: options.json || false });
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

async function getExistingServiceNames(hubUrl: string, apiKey: string): Promise<Set<string>> {
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': apiKey },
    });
    
    if (!response.ok) return new Set();
    
    const services = await response.json() as ServiceInfo[];
    return new Set(services.map(s => s.name));
  } catch {
    return new Set();
  }
}

async function findTeammateService(
  hubUrl: string,
  apiKey: string,
  teammate: string,
  serviceName: string
): Promise<string | null> {
  try {
    // Find the teammate's agent
    const agentsResponse = await fetch(`${hubUrl}/v1/agents`, {
      headers: { 'x-api-key': apiKey },
    });
    
    if (!agentsResponse.ok) return null;
    
    const agents = await agentsResponse.json() as Array<{
      id: string;
      label: string;
      name?: string;
    }>;
    
    const teammateAgent = agents.find(a => 
      a.label.toLowerCase() === teammate.toLowerCase() ||
      a.name?.toLowerCase() === teammate.toLowerCase()
    );
    
    if (!teammateAgent) return null;

    // Find the service
    const servicesResponse = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': apiKey },
    });
    
    if (!servicesResponse.ok) return null;
    
    const services = await servicesResponse.json() as Array<{
      id: string;
      name: string;
      agentId: string;
    }>;
    
    const service = services.find(s => 
      s.agentId === teammateAgent.id &&
      s.name.toLowerCase() === serviceName.toLowerCase()
    );
    
    return service?.name || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Link Creator
// ─────────────────────────────────────────────────────────────────────────────

function parseTtl(ttl: string): Date {
  const now = new Date();
  const match = ttl.match(/^(\d+)(m|h|d)$/);
  
  if (!match) {
    // Default to 30 minutes
    return new Date(now.getTime() + 30 * 60 * 1000);
  }
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  switch (unit) {
    case 'm':
      return new Date(now.getTime() + value * 60 * 1000);
    case 'h':
      return new Date(now.getTime() + value * 60 * 60 * 1000);
    case 'd':
      return new Date(now.getTime() + value * 24 * 60 * 60 * 1000);
    default:
      return new Date(now.getTime() + 30 * 60 * 1000);
  }
}

async function createShareLink(
  hubUrl: string,
  apiKey: string,
  serviceId: string,
  serviceName: string,
  ttl?: string
): Promise<void> {
  try {
    const expiresAt = parseTtl(ttl || '30m');
    
    const response = await fetch(`${hubUrl}/v1/services/${serviceId}/shares`, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: `Quick share`,
        expiresAt: expiresAt.toISOString(),
      }),
    });
    
    if (!response.ok) {
      console.log(chalk.yellow('\n[!] Could not create share link'));
      return;
    }
    
    const share = await response.json() as { token: string; shareUrl?: string };
    // Use ngrok-style subdomain URL: {token}.privateconnect.co
    const baseDomain = process.env.BASE_DOMAIN || 'privateconnect.co';
    const shareUrl = share.shareUrl?.startsWith('http') 
      ? share.shareUrl 
      : `https://${share.token}.${baseDomain}`;
    
    // Calculate human-readable TTL
    const minutes = Math.round((expiresAt.getTime() - Date.now()) / 60000);
    const ttlDisplay = minutes >= 60 
      ? `${Math.round(minutes / 60)} hour${minutes >= 120 ? 's' : ''}`
      : `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    
    console.log();
    console.log(chalk.gray('────────────────────────────────────────'));
    console.log();
    console.log(chalk.bold('  Secure link created:'));
    console.log();
    console.log(`  ${chalk.cyan(shareUrl)}`);
    console.log();
    console.log(chalk.gray(`  Expires in ${ttlDisplay}`));
    console.log();
    console.log(chalk.gray('────────────────────────────────────────'));
    console.log();
  } catch {
    console.log(chalk.yellow('\n[!] Could not create share link'));
  }
}

