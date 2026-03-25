import chalk from 'chalk';
import { loadConfig } from '../config';

interface ShareOptions {
  hub: string;
  name?: string;
  expires?: string;
  config?: string;
  requireApproval?: boolean;
  pendingCode?: string;
  approveCode?: string;
  denyCode?: string;
  agentId?: string;
  json?: boolean;
  dryRun?: boolean;
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
    requireDeviceApproval?: boolean;
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

  if (!options.json) {
    console.log(chalk.cyan('\n🤝 Creating environment share...\n'));
  }

  // Parse expiry option (supports Nh, Nd, or "never")
  let expiresInHours = 24; // default
  let neverExpires = false;
  if (options.expires) {
    if (options.expires === 'never') {
      neverExpires = true;
    } else {
      const match = options.expires.match(/^(\d+)(h|d)$/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        expiresInHours = unit === 'd' ? value * 24 : value;
      } else {
        console.error(chalk.red('[x] Invalid expires format. Use: 1h, 4h, 24h, 7d, or "never".'));
        process.exit(1);
      }
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
        ...(neverExpires ? { neverExpires: true } : { expiresInHours }),
        requireDeviceApproval: options.requireApproval ?? false,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      const status = response.status;
      console.error(chalk.red(`[x] Failed to create share (HTTP ${status})`));
      if (status === 401 || status === 403) {
        console.log(chalk.gray(`  Check your API key: connect login <your-api-key>`));
      } else {
        console.log(chalk.gray(`  ${error.message || 'Unknown error'}. Run: connect doctor`));
      }
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

    if (options.json) {
      console.log(JSON.stringify({
        code: share.code,
        name: share.name || null,
        expiresAt: share.expiresAt,
        requireApproval: share.requireDeviceApproval || false,
        routes: share.routes,
      }));
      return;
    }

    // Success output
    console.log(chalk.green.bold('[ok] Environment share created!\n'));
    
    // Share code box
    console.log(chalk.gray('  ┌─────────────────────────────────────────────────┐'));
    console.log(chalk.gray('  │') + chalk.white.bold(`  Share Code: ${chalk.cyan.bold(share.code)}`) + chalk.gray('                           │'));
    console.log(chalk.gray('  └─────────────────────────────────────────────────┘\n'));

    if (share.requireDeviceApproval) {
      console.log(chalk.yellow('  Device approval is on. You must approve each device before they can join.'));
      console.log(chalk.gray('  See pending: ') + chalk.cyan(`connect share --pending ${share.code}`));
      console.log();
    }

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
      pendingCount?: number;
      requireDeviceApproval?: boolean;
      createdAt: string;
    }> };

    if (data.shares.length === 0) {
      console.log(chalk.gray('\n  No active shares.\n'));
      console.log(chalk.gray(`  Create one with: ${chalk.cyan('connect share')}\n`));
      return;
    }

    console.log(chalk.cyan('\n📋 Active Environment Shares\n'));
    
    data.shares.forEach((share: { code: string; name?: string; expiresAt: string; routeCount: number; joinCount: number; pendingCount?: number; requireDeviceApproval?: boolean }) => {
      const expiresAt = new Date(share.expiresAt);
      const hoursLeft = Math.round((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60));
      
      console.log(chalk.white.bold(`  ${share.code}`) + (share.name ? chalk.gray(` (${share.name})`) : ''));
      let meta = `Routes: ${share.routeCount} | Joined: ${share.joinCount}`;
      if (share.requireDeviceApproval && share.pendingCount !== undefined && share.pendingCount > 0) {
        meta += chalk.yellow(` | ${share.pendingCount} pending approval`);
      }
      meta += ` | Expires: ${hoursLeft}h`;
      console.log(chalk.gray(`    ${meta}`));
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

  if (options.dryRun) {
    console.log(chalk.cyan(`\n[dry-run] Would revoke share ${code}`));
    console.log(chalk.gray('  No changes made.\n'));
    return;
  }

  try {
    const response = await fetch(`${hubUrl}/v1/env-shares/${code}`, {
      method: 'DELETE',
      headers: {
        'x-api-key': config.apiKey,
        'x-agent-id': config.agentId,
      },
    });

    if (!response.ok) {
      console.error(chalk.red(`[x] Failed to revoke share (HTTP ${response.status})`));
      if (response.status === 404) {
        console.log(chalk.gray(`  Share "${code}" not found. List shares with: connect share --list`));
      }
      process.exit(1);
    }

    console.log(chalk.green(`\n[ok] Share ${chalk.cyan(code)} revoked.\n`));

  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    process.exit(1);
  }
}

export async function pendingShareCommand(code: string, options: ShareOptions) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured. Run connect up first.\n'));
    process.exit(1);
  }
  const hubUrl = config.hubUrl || options.hub;
  try {
    const response = await fetch(`${hubUrl}/v1/env-shares/${code}/pending`, {
      headers: { 'x-api-key': config.apiKey, 'x-agent-id': config.agentId },
    });
    if (!response.ok) {
      console.error(chalk.red(`[x] ${response.statusText}`));
      process.exit(1);
    }
    const data = await response.json() as { pending: Array<{ agentId: string; agentLabel?: string; requestedAt: string }> };
    if (data.pending.length === 0) {
      console.log(chalk.gray(`\n  No pending join requests for ${code}.\n`));
      return;
    }
    console.log(chalk.cyan(`\n  Pending join requests for ${code}:\n`));
    data.pending.forEach((p: { agentId: string; agentLabel?: string; requestedAt: string }) => {
      console.log(chalk.white(`  ${p.agentId}`) + (p.agentLabel ? chalk.gray(` (${p.agentLabel})`) : ''));
      console.log(chalk.gray(`    Requested: ${new Date(p.requestedAt).toLocaleString()}`));
      console.log(chalk.cyan(`    Approve: connect share --approve ${code} --agent ${p.agentId}`));
      console.log(chalk.gray(`    Deny:    connect share --deny ${code} --agent ${p.agentId}\n`));
    });
  } catch (err) {
    console.error(chalk.red(`\n[x] ${(err as Error).message}\n`));
    process.exit(1);
  }
}

export async function approveShareCommand(code: string, agentId: string, options: ShareOptions) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured. Run connect up first.\n'));
    process.exit(1);
  }
  const hubUrl = config.hubUrl || options.hub;
  try {
    const response = await fetch(`${hubUrl}/v1/env-shares/${code}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'x-agent-id': config.agentId },
      body: JSON.stringify({ agentId }),
    });
    if (!response.ok) {
      console.error(chalk.red(`[x] Failed to approve: ${response.statusText}`));
      process.exit(1);
    }
    console.log(chalk.green(`\n[ok] Device approved. They can join with: connect join ${code}\n`));
  } catch (err) {
    console.error(chalk.red(`\n[x] ${(err as Error).message}\n`));
    process.exit(1);
  }
}

export async function denyShareCommand(code: string, agentId: string, options: ShareOptions) {
  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured. Run connect up first.\n'));
    process.exit(1);
  }
  const hubUrl = config.hubUrl || options.hub;
  try {
    const response = await fetch(`${hubUrl}/v1/env-shares/${code}/deny`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey, 'x-agent-id': config.agentId },
      body: JSON.stringify({ agentId }),
    });
    if (!response.ok) {
      console.error(chalk.red(`[x] ${response.statusText}`));
      process.exit(1);
    }
    console.log(chalk.green(`\n[ok] Device denied.\n`));
  } catch (err) {
    console.error(chalk.red(`\n[x] ${(err as Error).message}\n`));
    process.exit(1);
  }
}

