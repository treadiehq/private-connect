import chalk from 'chalk';
import { loadConfig } from '../config';

interface ShareOptions {
  hub: string;
  name?: string;
  expires?: string;
  config?: string;
}

interface ShareRoute {
  serviceName: string;
  targetHost: string;
  targetPort: number;
  localPort?: number;
  protocol: string;
}

interface ShareResponse {
  success: boolean;
  share?: {
    code: string;
    name?: string;
    expiresAt: string;
    routes: ShareRoute[];
  };
  error?: string;
}

export async function shareCommand(options: ShareOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.cyan('\n🤝 Creating environment share...\n'));

  // Parse expiry option
  let expiresInHours = 24; // default
  if (options.expires) {
    const match = options.expires.match(/^(\d+)(h|d)$/);
    if (match) {
      const value = parseInt(match[1], 10);
      const unit = match[2];
      expiresInHours = unit === 'd' ? value * 24 : value;
    } else {
      console.error(chalk.red('[x] Invalid expires format. Use: 1h, 4h, 24h, 7d, etc.'));
      process.exit(1);
    }
  }

  try {
    const response = await fetch(`${hubUrl}/v1/env-shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
      body: JSON.stringify({
        name: options.name,
        expiresInHours,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`[x] Failed to create share: ${error.message || response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as ShareResponse;
    
    if (!data.success || !data.share) {
      console.error(chalk.red(`[x] Failed to create share: ${data.error || 'Unknown error'}`));
      process.exit(1);
    }

    const share = data.share;
    const expiresAt = new Date(share.expiresAt);
    const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));

    // Success output
    console.log(chalk.green.bold('[ok] Environment share created!\n'));
    
    // Share code box
    console.log(chalk.gray('  ┌─────────────────────────────────────────────────┐'));
    console.log(chalk.gray('  │') + chalk.white.bold(`  Share Code: ${chalk.cyan.bold(share.code)}`) + chalk.gray('                           │'));
    console.log(chalk.gray('  └─────────────────────────────────────────────────┘\n'));

    // Instructions
    console.log(chalk.white('  Your teammate can join with:\n'));
    console.log(chalk.cyan(`    connect join ${share.code}\n`));

    // Routes being shared
    if (share.routes.length > 0) {
      console.log(chalk.gray('  Routes being shared:'));
      share.routes.forEach(route => {
        const localPort = route.localPort || route.targetPort;
        console.log(chalk.gray(`    • ${chalk.white(route.serviceName)} → localhost:${localPort}`));
      });
      console.log();
    }

    // Expiry info
    console.log(chalk.gray(`  Expires in ${hoursLeft} hours (${expiresAt.toLocaleString()})`));
    if (share.name) {
      console.log(chalk.gray(`  Name: ${share.name}`));
    }
    console.log();

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

export async function listSharesCommand(options: ShareOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    const response = await fetch(`${hubUrl}/v1/env-shares`, {
      headers: {
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
    });

    if (!response.ok) {
      console.error(chalk.red(`[x] Failed to list shares: ${response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as { shares: Array<{
      code: string;
      name?: string;
      expiresAt: string;
      routeCount: number;
      joinCount: number;
      createdAt: string;
    }> };

    if (data.shares.length === 0) {
      console.log(chalk.gray('\n  No active shares.\n'));
      console.log(chalk.gray(`  Create one with: ${chalk.cyan('connect share')}\n`));
      return;
    }

    console.log(chalk.cyan('\n📋 Active Environment Shares\n'));
    
    data.shares.forEach(share => {
      const expiresAt = new Date(share.expiresAt);
      const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      
      console.log(chalk.white.bold(`  ${share.code}`) + (share.name ? chalk.gray(` (${share.name})`) : ''));
      console.log(chalk.gray(`    Routes: ${share.routeCount} | Joined: ${share.joinCount} | Expires: ${hoursLeft}h`));
      console.log();
    });

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    process.exit(1);
  }
}

export async function revokeShareCommand(code: string, options: ShareOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    const response = await fetch(`${hubUrl}/v1/env-shares/${code}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
    });

    if (!response.ok) {
      console.error(chalk.red(`[x] Failed to revoke share: ${response.statusText}`));
      process.exit(1);
    }

    console.log(chalk.green(`\n[ok] Share ${chalk.cyan(code)} revoked.\n`));

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    process.exit(1);
  }
}

