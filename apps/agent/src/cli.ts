#!/usr/bin/env node

import { program } from 'commander';
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
import { setConfigPath } from './config';

// Version - keep in sync with package.json
const VERSION = '0.1.13';

// Default hub URL - can be overridden via CONNECT_HUB_URL env var
// Set CONNECT_HUB_URL or use --hub flag for production
const DEFAULT_HUB_URL = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';

program
  .name('connect')
  .description('Private Connect Agent - Securely expose local services')
  .version(VERSION);

program
  .command('up')
  .description('Start the agent and connect to the hub')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
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
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
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
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '5000')
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
  .option('-p, --port <port>', 'Port to listen on', '3000')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    proxyCommand({ ...options, port: parseInt(options.port, 10) });
  });

program
  .command('link <service>')
  .description('Create a public URL for a service (no account needed to access)')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-e, --expires <duration>', 'Expiration: 1h, 24h, 7d, 30d, never', '24h')
  .option('-m, --methods <methods>', 'Allowed HTTP methods (comma-separated, e.g., GET,POST)')
  .option('-p, --paths <paths>', 'Allowed paths (comma-separated, e.g., /api,/health)')
  .option('-r, --rate-limit <rpm>', 'Rate limit per minute')
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
  .option('--ports <ports>', 'Comma-separated list of ports to scan')
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
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-n, --name <name>', 'Friendly name for the share')
  .option('-e, --expires <duration>', 'Expiry duration (e.g., 4h, 24h, 7d)', '24h')
  .option('-c, --config <path>', 'Config file path')
  .option('-l, --list', 'List active shares')
  .option('-r, --revoke <code>', 'Revoke a share by code')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
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
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .action((code, options) => {
    if (options.config) setConfigPath(options.config);
    joinCommand(code, options);
  });

// Mapping Commands
program
  .command('map [service] [localPort]')
  .description('Map a service to a local port (e.g., staging-db → localhost:5432)')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .option('-r, --remove', 'Remove the mapping')
  .option('-s, --status', 'Show status of all mappings')
  .action((service, localPort, options) => {
    if (options.config) setConfigPath(options.config);
    if (options.status) {
      mapStatusCommand(options);
    } else {
      mapCommand(service, localPort, options);
    }
  });

// Daemon Commands
program
  .command('daemon [action]')
  .description('Manage the background daemon (install|uninstall|start|stop|restart|status|logs)')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-c, --config <path>', 'Config file path')
  .option('--proxy', 'Also run the proxy server')
  .option('--proxy-port <port>', 'Proxy port (default: 3000)')
  .action((action, options) => {
    if (options.config) setConfigPath(options.config);
    daemonCommand(action, options);
  });

// Dev Mode Commands
program
  .command('dev')
  .description('Connect to all services defined in pconnect.yml')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-f, --file <path>', 'Config file path')
  .option('-c, --config <path>', 'Agent config file path')
  .option('-b, --background', 'Run in background')
  .option('--init', 'Initialize a new .privateconnect.yml file')
  .action((options) => {
    if (options.config) setConfigPath(options.config);
    if (options.init) {
      devInitCommand(options);
    } else {
      devCommand(options);
    }
  });

program.parse();
