#!/usr/bin/env node

import { program, InvalidArgumentError } from 'commander';
import { upCommand } from './commands/up';
import { exposeCommand } from './commands/expose';
import { reachCommand } from './commands/reach';
import { proxyCommand } from './commands/proxy';
import { whoamiCommand } from './commands/whoami';
import { logoutCommand } from './commands/logout';
import { updateCommand } from './commands/update';
import { shareCommand, listSharesCommand, revokeShareCommand, pendingShareCommand, approveShareCommand, denyShareCommand } from './commands/share';
import { joinCommand } from './commands/join';
import { daemonCommand } from './commands/daemon';
import { devCommand, devInitCommand } from './commands/dev';
import { linkCommand } from './commands/link';
import { deleteCommand } from './commands/delete';
import { doctorCommand, cleanupCommand, statusCommand } from './commands/doctor';
import { shellInitCommand, shellSetupCommand } from './commands/shell';
import { dnsCommand, serveDns } from './commands/dns';
import { mcpCommand } from './commands/mcp';
import { cloneCommand, cloneListCommand } from './commands/clone';
import { runCommand } from './commands/run';
import { hostsCommand } from './commands/hosts';
import { grantCommand } from './commands/grant';
import { connectCommand } from './commands/connect';
import { debugCommand } from './commands/debug';
import { loginCommand } from './commands/login';
import { resourceCommand } from './commands/resource';
import { resourcesCommand } from './commands/resources';
import { sshCommand } from './commands/ssh';
import { setConfigPath } from './config';
import { validateHubUrl } from './security';

// Read version from package.json to avoid drift
const pkg = require('../package.json') as { version: string };
const VERSION = pkg.version;

// ─────────────────────────────────────────────────────────────────────────────
// Bypass Check
// ─────────────────────────────────────────────────────────────────────────────
// CONNECT=0 or CONNECT=skip disables Private Connect entirely.
// Useful for CI pipelines or environments where tunneling is not wanted.

const connectEnv = process.env.CONNECT;
if (connectEnv === '0' || connectEnv === 'skip') {
  process.exit(0);
}

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
  if (isNaN(timeout) || timeout <= 0) {
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
  .version(VERSION)
  .enablePositionalOptions();

// ─────────────────────────────────────────────────────────────────────────────
// Default Command - The Primitive
// ─────────────────────────────────────────────────────────────────────────────
// This is the "one command" that does the right thing contextually.
// All explicit commands (expose, reach, etc.) remain available for power users.

program
  .command('run [target]', { isDefault: true, hidden: true })
  .description('Smart connect - expose or reach based on target')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-n, --name <name>', 'Service name (auto-detected if not provided)')
  .option('-p, --port <port>', 'Local port for reach (default: same as service)')
  .option('-t, --timeout <ms>', 'Timeout for reach', parseTimeout, 5000)
  .option('--public', 'Make exposed service publicly accessible')
  .option('--protocol <type>', 'Protocol: auto|tcp|udp|http|https', 'auto')
  .option('--tcp', 'Use TCP protocol (shortcut for --protocol tcp)')
  .option('--udp', 'Use UDP protocol (shortcut for --protocol udp)')
  .option('--check', 'Only run diagnostics, do not create tunnel')
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path')
  .option('-s, --share', 'Create shareable link after exposing')
  .option('--ttl <duration>', 'Share link TTL: 30m, 1h, 24h, 7d (default: 30m)', '30m')
  .option('-l, --link', 'Create a public URL automatically after exposing')
  .option('--link-expires <duration>', 'Public link expiry: 1h, 24h, 7d, 30d, never (default: 24h)', '24h')
  .action(async (target, options) => {
    if (options.config) setConfigPath(options.config);
    // Handle protocol shortcuts
    if (options.tcp) options.protocol = 'tcp';
    if (options.udp) options.protocol = 'udp';
    await connectCommand(target, options);
  });

program
  .command('up')
  .description('Start the agent and connect to the hub')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-k, --api-key <key>', 'Workspace API key')
  .option('-l, --label <label>', 'Environment label (default: hostname)')
  .option('-n, --name <name>', 'Agent name')
  .option('-t, --token <token>', 'Pre-authenticated token (for CI/CD)')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .addHelpText('after', `
Examples:
  $ connect up
  $ connect up --api-key pc_xxx
  $ connect up --name my-server --label staging
  $ connect up --token <pre-auth-token>
`)
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    upCommand(options);
  });

program
  .command('login <api-key>')
  .description('Save your API key so you don\'t need --api-key on every command')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect login pc_xxx
`)
  .action((apiKey, options) => {
    if (options.config) setConfigPath(options.config);
    loginCommand(apiKey, options);
  });

program
  .command('run <name> [cmd...]')
  .enablePositionalOptions()
  .passThroughOptions()
  .description('Run a command and make it available via the local proxy')
  .option('--port <port>', 'Use a specific port instead of auto-assigning', parsePort)
  .option('--https', 'Ensure proxy uses HTTPS')
  .addHelpText('after', `
Examples:
  $ connect run api next dev
  $ connect run frontend vite
  $ connect run --https api node server.js
  $ connect run --port 4000 api next dev
`)
  .action((name, cmd, options) => {
    if (cmd.length === 0) {
      console.error('[x] No command specified. Usage: connect run <name> <command>');
      process.exit(1);
    }
    runCommand(name, cmd, options);
  });

program
  .command('expose <target>')
  .description('Expose a local service through the tunnel (make something private available)')
  .option('-n, --name <name>', 'Service name', 'default')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-k, --api-key <key>', 'Workspace API key')
  .option('-p, --protocol <protocol>', 'Protocol hint: auto|tcp|udp|http|https', 'auto')
  .option('--tcp', 'Use TCP protocol (shortcut for --protocol tcp)')
  .option('--udp', 'Use UDP protocol (shortcut for --protocol udp)')
  .option('--public', 'Generate a public URL for the service (default: true)', true)
  .option('--no-public', 'Do not generate a public URL')
  .option('-l, --link', 'Create a public URL automatically after exposing')
  .option('--link-expires <duration>', 'Public link expiry: 1h, 24h, 7d, 30d, never (default: 24h)', '24h')
  .option('-d, --debug', 'Enable debug mode with shareable live traffic viewer')
  .option('--ai', 'Enable AI Copilot for debug session (requires --debug)')
  .option('--no-e2e', 'Disable end-to-end encryption for tunnel data')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .option('--json', 'Output as JSON (machine-readable)')
  .addHelpText('after', `
Examples:
  $ connect expose localhost:3000
  $ connect expose localhost:8080 --name api
  $ connect expose localhost:5432 --name db --protocol tcp
  $ connect expose localhost:3000 --public --debug
  $ connect expose localhost:3000 --name api --json
`)
  .action((target, options) => {
    if (options.config) setConfigPath(options.config);
    // Map --ai to aiEnabled for the expose command
    if (options.ai) options.aiEnabled = true;
    // Handle protocol shortcuts
    if (options.tcp) options.protocol = 'tcp';
    if (options.udp) options.protocol = 'udp';
    exposeCommand(target, options);
  });

program
  .command('shell [port]')
  .description('Expose your local shell (SSH) so others can terminal-in from anywhere')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-k, --api-key <key>', 'Workspace API key')
  .option('-c, --config <path>', 'Config file path')
  .action((portArg, options) => {
    if (options.config) setConfigPath(options.config);
    const port = portArg ? parseInt(String(portArg), 10) : 22;
    if (isNaN(port) || port < 1 || port > 65535) {
      console.error('Invalid port. Use a number 1-65535 (default: 22 for SSH).');
      process.exit(1);
    }
    exposeCommand(`localhost:${port}`, {
      name: 'shell',
      hub: options.hub || DEFAULT_HUB_URL,
      apiKey: options.apiKey,
      protocol: 'tcp',
      public: false,
      config: options.config,
    });
  });

program
  .command('ssh <target> [remoteCommand...]')
  .description('SSH into a machine exposing a service (e.g. connect ssh shell)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-u, --user <user>', 'SSH username (default: current OS user)')
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect ssh shell
  $ connect ssh root@shell
  $ connect ssh shell -- whoami
  $ connect ssh shell -- cat /etc/hostname | claude
`)
  .action((target, remoteCommand, options) => {
    if (options.config) setConfigPath(options.config);
    sshCommand(target, remoteCommand, options);
  });

program
  .command('reach <service>')
  .description('Connect to an exposed service and create a local tunnel')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', parseTimeout, 5000)
  .option('-p, --port <port>', 'Local port to listen on (default: same as service port)')
  .option('--check', 'Only run diagnostics, do not create local tunnel')
  .option('--json', 'Output as JSON')
  .option('--no-e2e', 'Disable end-to-end encryption for tunnel data')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .addHelpText('after', `
Examples:
  $ connect reach api
  $ connect reach postgres --port 5432
  $ connect reach api --json
  $ connect reach api --check
`)
  .action((service, options) => {
    if (options.config) setConfigPath(options.config);
    reachCommand(service, options);
  });

program
  .command('proxy [action]')
  .description('Manage the local subdomain proxy (start|stop|status|trust)')
  .option('-p, --port <port>', 'Port to listen on', parsePort, 3000)
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .option('-r, --replace', 'Kill existing proxy on the same port and take over')
  .option('--https', 'Enable HTTPS with auto-generated local CA certificates')
  .option('--cert <path>', 'Path to custom TLS certificate (implies --https)')
  .option('--key <path>', 'Path to custom TLS private key (implies --https)')
  .option('--trust', 'Add the local CA to system trust store')
  .option('--lan', 'Expose proxy on LAN with mDNS (implies --https)')
  .option('--wildcard', 'Allow unregistered subdomains to fall back to parent route')
  .option('--foreground', 'Run in foreground (default: daemonize)')
  .addHelpText('after', `
Examples:
  $ connect proxy start
  $ connect proxy start --https --trust
  $ connect proxy start --lan
  $ connect proxy start --wildcard
  $ connect proxy stop
  $ connect proxy status
`)
  .action((action, options) => {
    if (options.config) setConfigPath(options.config);
    if (options.trust && !action) action = 'trust';
    proxyCommand(action, options);
  });

program
  .command('link [target]')
  .description('Create a public URL — auto-detects and exposes the service if needed')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-e, --expires <duration>', 'Expiration: 1h, 24h, 7d, 30d, never', parseDuration, '24h')
  .option('-m, --methods <methods>', 'Allowed HTTP methods (comma-separated)', parseMethods)
  .option('-p, --paths <paths>', 'Allowed paths (comma-separated, e.g., /api,/health)', parsePaths)
  .option('-r, --rate-limit <rpm>', 'Rate limit per minute', parseLimit)
  .option('-n, --name <name>', 'Service name (auto-detected if not provided)')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .option('--json', 'Output as JSON (machine-readable)')
  .addHelpText('after', `
Examples:
  $ connect link 3000
  $ connect link localhost:8080
  $ connect link api --expires 7d
  $ connect link 3000 --methods GET,POST --paths /api
`)
  .action((target, options) => {
    if (options.config) setConfigPath(options.config);
    linkCommand(target, options);
  });

program
  .command('delete <service>')
  .description('Delete a service and stop all its tunnels')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-f, --force', 'Skip confirmation prompt')
  .option('--dry-run', 'Preview what would be deleted without making changes')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .addHelpText('after', `
Examples:
  $ connect delete my-service
  $ connect delete my-service --force
  $ connect delete my-service --dry-run
`)
  .action((service, options) => {
    if (options.config) setConfigPath(options.config);
    deleteCommand(service, options);
  });

program
  .command('whoami')
  .description('Print agent identity and workspace membership')
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .addHelpText('after', `
Examples:
  $ connect whoami
  $ connect whoami --json
`)
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    whoamiCommand(options);
  });

program
  .command('logout')
  .description('Clear local credentials and log out')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .addHelpText('after', `
Examples:
  $ connect logout
`)
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    logoutCommand(options);
  });

program
  .command('update')
  .description('Update the CLI to the latest version')
  .option('-f, --force', 'Force update even if already on latest version')
  .addHelpText('after', `
Examples:
  $ connect update
  $ connect update --force
`)
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
  .option('--require-approval', 'Require host to approve each device before they can join')
  .option('-c, --config <path>', 'Config file path')
  .option('-l, --list', 'List active shares')
  .option('-r, --revoke <code>', 'Revoke a share by code')
  .option('-p, --pending <code>', 'List pending join requests for a share (host only)')
  .option('--approve <code>', 'Approve a device to join (use with --agent)')
  .option('--deny <code>', 'Deny a pending device (use with --agent)')
  .option('--agent <id>', 'Agent ID (for use with --approve or --deny)')
  .option('--json', 'Output as JSON (machine-readable)')
  .option('--dry-run', 'Preview what would be revoked (use with --revoke)')
  .addHelpText('after', `
Examples:
  $ connect share
  $ connect share --name "staging env" --expires 7d
  $ connect share --list
  $ connect share --revoke ABC123
  $ connect share --revoke ABC123 --dry-run
  $ connect share --require-approval
  $ connect share --json
`)
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    
    if (options.pending) {
      pendingShareCommand(options.pending, options);
      return;
    }
    if (options.approve && options.agent) {
      approveShareCommand(options.approve, options.agent, options);
      return;
    }
    if (options.deny && options.agent) {
      denyShareCommand(options.deny, options.agent, options);
      return;
    }
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
  .addHelpText('after', `
Examples:
  $ connect join ABC123
`)
  .action((code, options) => {
    if (options.config) setConfigPath(options.config);
    joinCommand(code, options);
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
  .addHelpText('after', `
Examples:
  $ connect daemon install
  $ connect daemon start
  $ connect daemon status
  $ connect daemon logs
  $ connect daemon stop
`)
  .action((action, options) => {
    if (options.config) setConfigPath(options.config);
    const validatedAction = validateDaemonAction(action);
    daemonCommand(validatedAction, options);
  });

// Dev Mode Commands
program
  .command('dev')
  .description('Provision resources and expose services from pconnect.yml')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-f, --file <path>', 'Path to pconnect.yml file')
  .option('-c, --config <path>', 'Agent config file path')
  .option('-b, --background', 'Run in background')
  .option('--init', 'Create a pconnect.yml manifest in the current directory')
  .addHelpText('after', `
Examples:
  $ connect dev
  $ connect dev --init
  $ connect dev --file custom.yml
  $ connect dev --background
`)
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
  .addHelpText('after', `
Examples:
  $ connect doctor
  $ connect doctor --fix
  $ connect doctor --json
`)
  .action((options) => {
    doctorCommand(options);
  });

program
  .command('cleanup')
  .description('Clean up orphaned processes and stale files')
  .option('-f, --force', 'Actually perform cleanup (dry-run by default)')
  .addHelpText('after', `
Examples:
  $ connect cleanup
  $ connect cleanup --force
`)
  .action((options) => {
    cleanupCommand(options);
  });

program
  .command('status')
  .description('Quick status overview')
  .option('--json', 'Output as JSON')
  .addHelpText('after', `
Examples:
  $ connect status
  $ connect status --json
`)
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
  .option('--json', 'Output as JSON (machine-readable)')
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect clone alice
  $ connect clone --list
  $ connect clone alice --no-env
`)
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
  .addHelpText('after', `
Examples:
  $ connect dns install
  $ connect dns status
  $ connect dns test
  $ connect dns uninstall
`)
  .action(async (action, options) => {
    if (options.config) setConfigPath(options.config);
    
    // Handle internal 'serve' action for background DNS server
    if (action === 'serve') {
      await serveDns(options);
    } else {
      await dnsCommand(action, options);
    }
  });

// Hosts Management
program
  .command('hosts [action]')
  .description('Manage /etc/hosts entries for Safari compatibility (sync|clean)')
  .addHelpText('after', `
Examples:
  $ connect hosts sync     # Add proxy routes to /etc/hosts
  $ connect hosts clean    # Remove Private Connect entries
`)
  .action(async (action) => {
    await hostsCommand(action);
  });

// AI/MCP Integration Commands
program
  .command('mcp [action]')
  .description('AI assistant integration via MCP (setup|serve)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect mcp setup
  $ connect mcp serve
`)
  .action(async (action, options) => {
    if (options.config) setConfigPath(options.config);
    await mcpCommand(action, options);
  });

// Grant Commands - AI agent access (time-limited or persistent)
program
  .command('grant [agent]')
  .description('Grant an AI agent scoped access to a private resource')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('--db <name>', 'Database resource name (e.g., postgres)')
  .option('--api <name>', 'API resource name (e.g., staging)')
  .option('--path <path>', 'File path resource')
  .option('--ttl <duration>', 'Time to live: 60s, 5m, 1h, 1d (default: 5m)')
  .option('--persistent', 'Grant never expires (revoke manually)')
  .option('--scope <scope>', 'Access scope: read-only, full (default: read-only)', 'read-only')
  .option('-l, --list', 'List active grants')
  .option('-r, --revoke <id>', 'Revoke a grant by ID')
  .option('--dry-run', 'Preview what would be revoked (use with --revoke)')
  .option('--json', 'Output as JSON (machine-readable)')
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect grant claude --db postgres --ttl 5m
  $ connect grant cursor --api staging --persistent
  $ connect grant --list
  $ connect grant --revoke <id>
  $ connect grant claude --db postgres --json
`)
  .action(async (agent, options) => {
    if (options.config) setConfigPath(options.config);
    await grantCommand(agent, options);
  });

// Debug Commands
program
  .command('debug [session]')
  .description('View live debug sessions (connect debug <token> to watch)')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-l, --list', 'List active debug sessions')
  .option('-s, --stop <token>', 'Stop a debug session')
  .option('-c, --config <path>', 'Config file path')
  .addHelpText('after', `
Examples:
  $ connect debug --list
  $ connect debug <session-token>
  $ connect debug --stop <token>
`)
  .action(async (session, options) => {
    if (options.config) setConfigPath(options.config);
    await debugCommand(session, options);
  });

// Resource Access Commands
program
  .command('resource <name>')
  .description('Connect to a named resource from pconnect.yml')
  .option('-H, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('--json', 'Output as JSON (machine-friendly, no extra logs)')
  .option('--local', 'Force direct connection (skip hub even if config says via: hub)')
  .option('-n, --name <alias>', 'Override display name for this session')
  .option('--ttl <duration>', 'Session TTL: 15m, 1h, 300s (default: 15m)', '15m')
  .option('-p, --port <port>', 'Local port to bind (default: same as resource target port)')
  .option('-f, --file <path>', 'Path to pconnect.yml')
  .option('-c, --config <path>', 'Agent config file path')
  .action(async (name, options) => {
    if (options.config) setConfigPath(options.config);
    await resourceCommand(name, options);
  });

program
  .command('resources')
  .description('List all named resources from pconnect.yml')
  .option('--json', 'Output as JSON')
  .option('-f, --file <path>', 'Path to pconnect.yml')
  .action(async (options) => {
    await resourcesCommand(options);
  });

program.parse(process.argv);
