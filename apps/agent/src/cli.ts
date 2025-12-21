#!/usr/bin/env node

import { program } from 'commander';
import { upCommand } from './commands/up';
import { exposeCommand } from './commands/expose';
import { reachCommand } from './commands/reach';
import { whoamiCommand } from './commands/whoami';
import { discoverCommand } from './commands/discover';
import { logoutCommand } from './commands/logout';
import { updateCommand } from './commands/update';
import { setConfigPath } from './config';

// Version - keep in sync with package.json
const VERSION = '0.1.5';

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
  .description('Test connectivity to an exposed service (access something private)')
  .option('-h, --hub <url>', 'Hub URL', DEFAULT_HUB_URL)
  .option('-t, --timeout <ms>', 'Timeout in milliseconds', '5000')
  .option('--json', 'Output as JSON')
  .option('-c, --config <path>', 'Config file path (for multiple agents)')
  .action((service, options) => {
    if (options.config) setConfigPath(options.config);
    reachCommand(service, options);
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

program.parse();
