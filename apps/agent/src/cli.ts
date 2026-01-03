#!/usr/bin/env node

import { program, InvalidArgumentError } from 'commander';
import { upCommand } from './commands/up';
import { exposeCommand } from './commands/expose';
import { reachCommand } from './commands/reach';
import { proxyCommand } from './commands/proxy';
import { whoamiCommand } from './commands/whoami';
import { discoverCommand } from './commands/discover';
import { logoutCommand } from './commands/logout';
import { updateCommand } from './commands/update';
import { shareCommand, listSharesCommand, revokeShareCommand } from './commands/share';
import { joinCommand } from './commands/join';
import { mapCommand, mapStatusCommand } from './commands/map';
import { daemonCommand } from './commands/daemon';
import { devCommand, devInitCommand } from './commands/dev';
import { linkCommand } from './commands/link';
import { doctorCommand, cleanupCommand, statusCommand } from './commands/doctor';
import { shellInitCommand, shellSetupCommand } from './commands/shell';
import { dnsCommand, serveDns } from './commands/dns';
import { mcpCommand } from './commands/mcp';
import { cloneCommand, cloneListCommand } from './commands/clone';
import { brokerCommand } from './commands/broker';
import { setConfigPath } from './config';
import { validateHubUrl } from './security';

// Read version from package.json to avoid drift
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

// ─────────────────────────────────────────────────────────────────────────────
// Validation & Coercion Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parse and validate a port number
 */
function parsePort(value: string, defaultValue?: number): number {
  const port = parseInt(value, 10);
  if (isNaN(port)) {
    if (defaultValue !== undefined) return defaultValue;
    throw new InvalidArgumentError(`Invalid port: "${value}" is not a number`);
  }
  if (port < 1 || port > 65535) {
    throw new InvalidArgumentError(`Invalid port: ${port} (must be 1-65535)`);
  }
  return port;
}

/**
 * Parse and validate a timeout in milliseconds
 */
function parseTimeout(value: string): number {
  const timeout = parseInt(value, 10);
  if (isNaN(timeout) || timeout < 0) {
    throw new InvalidArgumentError(`Invalid timeout: "${value}" (must be a positive number)`);
  }
  return timeout;
}

/**
 * Parse and validate a limit (positive integer)
 */
function parseLimit(value: string): number {
  const limit = parseInt(value, 10);
  if (isNaN(limit) || limit < 1) {
    throw new InvalidArgumentError(`Invalid limit: "${value}" (must be a positive number)`);
  }
  return limit;
}

/**
 * Parse and validate comma-separated ports
 */
function parsePorts(value: string): number[] {
  const ports = value.split(',').map(p => p.trim()).filter(Boolean);
  return ports.map(p => {
    const port = parseInt(p, 10);
    if (isNaN(port) || port < 1 || port > 65535) {
      throw new InvalidArgumentError(`Invalid port in list: "${p}"`);
    }
    return port;
  });
}

/**
 * Parse and validate expiration duration
 */
function parseDuration(value: string): string {
  const validDurations = /^(\d+[hd]|never)$/i;
  if (!validDurations.test(value)) {
    throw new InvalidArgumentError(
      `Invalid duration: "${value}" (use format: 1h, 24h, 7d, 30d, or "never")`
    );
  }
  return value.toLowerCase();
}

/**
 * Parse and validate HTTP methods
 */
function parseMethods(value: string): string[] {
  const validMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
  const methods = value.split(',').map(m => m.trim().toUpperCase()).filter(Boolean);
  
  for (const method of methods) {
    if (!validMethods.includes(method)) {
      throw new InvalidArgumentError(
        `Invalid HTTP method: "${method}" (allowed: ${validMethods.join(', ')})`
      );
    }
  }
  return methods;
}

/**
 * Parse and validate URL paths
 */
function parsePaths(value: string): string[] {
  const paths = value.split(',').map(p => p.trim()).filter(Boolean);
  
  for (const path of paths) {
    if (!path.startsWith('/')) {
      throw new InvalidArgumentError(`Invalid path: "${path}" (paths must start with /)`);
    }
  }
  return paths;
}

/**
 * Validate hub URL from environment or option
 */
function getValidatedHubUrl(): string {
  const envUrl = process.env.CONNECT_HUB_URL;
  const defaultUrl = 'https://api.privateconnect.co';
  
  if (envUrl) {
    const result = validateHubUrl(envUrl);
    if (!result.valid) {
      console.error(`[!] Invalid CONNECT_HUB_URL: ${result.error}`);
      console.error(`    Using default: ${defaultUrl}`);
      return defaultUrl;
    }
    return envUrl;
  }
  return defaultUrl;
}

// Validated default hub URL
const DEFAULT_HUB_URL = getValidatedHubUrl();

// Valid daemon actions
const DAEMON_ACTIONS = ['install', 'uninstall', 'start', 'stop', 'restart', 'status', 'logs'] as const;
type DaemonAction = typeof DAEMON_ACTIONS[number];

/**
 * Validate daemon action
 */
function validateDaemonAction(action: string | undefined): DaemonAction | undefined {
  if (!action) return undefined;
  if (!DAEMON_ACTIONS.includes(action as DaemonAction)) {
    console.error(`[x] Invalid daemon action: "${action}"`);
    console.error(`    Valid actions: ${DAEMON_ACTIONS.join(', ')}`);
    process.exit(1);
  }
  return action as DaemonAction;
}

// ─────────────────────────────────────────────────────────────────────────────
// CLI Program Definition
// ─────────────────────────────────────────────────────────────────────────────

program
  .name('connect')
  .description('Private Connect Agent - Securely expose local services')
  .version(VERSION);

program
  .command('up')
  .description('Start the agent and connect to the hub')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-k, --api-key <key>', 'Workspace API key')
  .option('-l, --label <label>', 'Environment label (default: hostname)')
  .option('-n, --name <name>', 'Agent name')
  .option('-t, --token <token>', 'Pre-authenticated token (for CI/CD)')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    upCommand(options);
  });

program
  .command('expose <target>')
  .description('Expose a local service through the tunnel (make something private available)')
  .option('-n, --name <name>', 'Service name', 'default')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-k, --api-key <key>', 'Workspace API key')
  .option('-p, --protocol <protocol>', 'Protocol hint: auto|tcp|http|https', 'auto')
  .option('--public', 'Make service publicly accessible via URL (for webhooks)')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((target, options) => {
    if (options.config) setConfigPath(options.config);
    exposeCommand(target, options);
  });

program
  .command('reach <service>')
  .description('Connect to an exposed service and create a local tunnel')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', parseTimeout, 5000)
  .option('-p, --port <port>', 'Local port to listen on (default: same as service port)')
  .option('--check', 'Only run diagnostics, do not create local tunnel')
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((service, options) => {
    if (options.config) setConfigPath(options.config);
    reachCommand(service, options);
  });

program
  .command('proxy')
  .description('Start a local HTTP proxy to access services via subdomains (e.g., my-api.localhost:3000)')
  .option('-p, --port <port>', 'Port to listen on', parsePort, 3000)
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .option('-r, --replace', 'Kill existing proxy on the same port and take over')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    proxyCommand(options);
  });

program
  .command('link <service>')
  .description('Create a public URL for a service (no account needed to access)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-e, --expires <duration>', 'Expiration: 1h, 24h, 7d, 30d, never', parseDuration, '24h')
  .option('-m, --methods <methods>', 'Allowed HTTP methods (comma-separated)', parseMethods)
  .option('-p, --paths <paths>', 'Allowed paths (comma-separated, e.g., /api,/health)', parsePaths)
  .option('-r, --rate-limit <rpm>', 'Rate limit per minute', parseLimit)
  .option('-n, --name <name>', 'Link name (for identification)')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((service, options) => {
    if (options.config) setConfigPath(options.config);
    linkCommand(service, options);
  });

program
  .command('whoami')
  .description('Print agent identity and workspace membership')
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    whoamiCommand(options);
  });

program
  .command('discover')
  .description('Scan for local services and optionally expose them')
  .option('--host <host>', 'Host to scan', 'localhost')
  .option('--ports <ports>', 'Comma-separated list of ports to scan', parsePorts)
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    discoverCommand(options);
  });

program
  .command('logout')
  .description('Clear local credentials and log out')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    logoutCommand(options);
  });

program
  .command('update')
  .description('Update the CLI to the latest version')
  .option('-f, --force', 'Force update even if already on latest version')
  .action((options) => {
    updateCommand(options);
  });

// Environment Sharing Commands
program
  .command('share')
  .description('Share your current environment with teammates')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-n, --name <name>', 'Friendly name for the share')
  .option('-e, --expires <duration>', 'Expiry duration (e.g., 4h, 24h, 7d)', parseDuration, '24h')
  .option('-c, --config <path>', 'Config file path')
  .option('-l, --list', 'List active shares')
  .option('-r, --revoke <code>', 'Revoke a share by code')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    
    // Enforce mutual exclusivity
    if (options.list && options.revoke) {
      console.error('[x] Cannot use --list and --revoke together');
      process.exit(1);
    }
    
    if (options.list) {
      listSharesCommand(options);
    } else if (options.revoke) {
      revokeShareCommand(options.revoke, options);
    } else {
      shareCommand(options);
    }
  });

program
  .command('join <code>')
  .description('Join a shared environment from a teammate')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .action((code, options) => {
    if (options.config) setConfigPath(options.config);
    joinCommand(code, options);
  });

// Mapping Commands
program
  .command('map [service] [localPort]')
  .description('Map a service to a local port (e.g., staging-db → localhost:5432)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .option('-r, --remove', 'Remove the mapping')
  .option('-s, --status', 'Show status of all mappings')
  .action((service, localPort, options) => {
    if (options.config) setConfigPath(options.config);
    if (options.status) {
      mapStatusCommand(options);
    } else {
      // Coerce localPort to number if provided
      const port = localPort ? parsePort(localPort) : undefined;
      mapCommand(service, port, options);
    }
  });

// Daemon Commands
program
  .command('daemon [action]')
  .description('Manage the background daemon (install|uninstall|start|stop|restart|status|logs)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .option('--proxy', 'Also run the proxy server')
  .option('--proxy-port <port>', 'Proxy port', parsePort, 3000)
  .option('-r, --replace', 'Kill existing daemon and start a new one')
  .action((action, options) => {
    if (options.config) setConfigPath(options.config);
    const validatedAction = validateDaemonAction(action);
    daemonCommand(validatedAction, options);
  });

// Dev Mode Commands
program
  .command('dev')
  .description('Connect to all services defined in pconnect.yml')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-f, --file <path>', 'Path to pconnect.yml file')
  .option('-c, --config <path>', 'Agent config file path')
  .option('-b, --background', 'Run in background')
  .option('--init', 'Initialize a new pconnect.yml file (cannot be used with other options)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    
    // Enforce --init exclusivity
    if (options.init && (options.file || options.background)) {
      console.error('[x] --init cannot be used with --file or --background');
      process.exit(1);
    }
    
    if (options.init) {
      devInitCommand(options);
    } else {
      devCommand(options);
    }
  });

// Health & Diagnostics Commands
program
  .command('doctor')
  .description('Check system health and fix common issues')
  .option('--fix', 'Auto-fix detected issues')
  .option('--json', 'Output as JSON')
  .action((options) => {
    doctorCommand(options);
  });

program
  .command('cleanup')
  .description('Clean up orphaned processes and stale files')
  .option('-f, --force', 'Actually perform cleanup (dry-run by default)')
  .action((options) => {
    cleanupCommand(options);
  });

program
  .command('status')
  .description('Quick status overview')
  .option('--json', 'Output as JSON')
  .action((options) => {
    statusCommand(options);
  });

// Clone Command
program
  .command('clone [target]')
  .description('Clone a teammate\'s environment (connect clone alice)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-o, --output <path>', 'Output .env file path', '.env.pconnect')
  .option('--no-env', 'Skip .env file generation')
  .option('-l, --list', 'List teammates with clonable environments')
  .option('-c, --config <path>', 'Config file path')
  .action(async (target, options) => {
    if (options.config) setConfigPath(options.config);
    
    if (options.list || !target) {
      await cloneListCommand(options);
    } else {
      await cloneCommand(target, options);
    }
  });

// Shell Integration Commands
program
  .command('shell-init [shell]')
  .description('Output shell initialization script (eval "$(connect shell-init)")')
  .option('--auto-connect', 'Enable auto-connect on directory change (default: true)')
  .option('--no-auto-connect', 'Disable auto-connect on directory change')
  .action((shell, options) => {
    shellInitCommand(shell, options);
  });

program
  .command('shell-setup')
  .description('Interactive shell integration setup')
  .action((options) => {
    shellSetupCommand(options);
  });

// DNS Commands
program
  .command('dns [action]')
  .description('Manage local DNS for *.connect domains (install|uninstall|start|stop|status|test)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-p, --port <port>', 'DNS server port', parsePort, 15353)
  .option('-d, --domain <domain>', 'Domain suffix', 'connect')
  .option('-c, --config <path>', 'Config file path')
  .action(async (action, options) => {
    if (options.config) setConfigPath(options.config);
    
    // Handle internal 'serve' action for background DNS server
    if (action === 'serve') {
      await serveDns(options);
    } else {
      await dnsCommand(action, options);
    }
  });

// AI/MCP Integration Commands
program
  .command('mcp [action]')
  .description('AI assistant integration via MCP (setup|serve)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .action(async (action, options) => {
    if (options.config) setConfigPath(options.config);
    await mcpCommand(action, options);
  });

// Agent Permission Broker Commands
program
  .command('broker [action] [args...]')
  .description('Agent Permission Broker - Zero Trust for AI agents (init|status|run|exec|hooks|audit)')
  .option('-w, --working-dir <path>', 'Working directory')
  .option('-a, --agent <id>', 'Agent identifier')
  .option('-o, --observe', 'Observe mode - log but do not enforce')
  .option('-l, --limit <n>', 'Limit audit entries', parseLimit, 50)
  .option('-t, --type <type>', 'Filter by type (file|command|git)')
  .option('--action <action>', 'Filter by action (allow|block|review)')
  .option('-s, --stats', 'Show audit statistics')
  .option('-u, --uninstall', 'Uninstall hooks')
  .action(async (action, args, options) => {
    await brokerCommand(action, args, options);
  });

program
  .command('audit')
  .description('View agent action audit log')
  .option('-l, --limit <n>', 'Number of entries to show', parseLimit, 50)
  .option('-t, --type <type>', 'Filter by type (file|command|git)')
  .option('--action <action>', 'Filter by action (allow|block|review)')
  .option('-s, --stats', 'Show audit statistics')
  .action(async (options) => {
    const { brokerAuditCommand } = await import('./commands/broker');
    await brokerAuditCommand(options);
  });

program.parse(process.argv);
