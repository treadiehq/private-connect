import chalk from 'chalk';
import { loadConfig } from '../config';

interface GrantOptions {
  hub: string;
  db?: string;
  api?: string;
  path?: string;
  ttl?: string;
  persistent?: boolean;
  scope: string;
  config?: string;
  list?: boolean;
  revoke?: string;
}

interface GrantResponse {
  success: boolean;
  grant?: {
    id: string;
    agentLabel: string;
    resourceType: string;
    resourceName: string;
    scope: string;
    persistent: boolean;
    expiresAt: string | null;
    expiresInMinutes: number | null;
    token: string;
    tokenPrefix: string;
    endpoint: string;
  };
  error?: string;
  message?: string;
}

interface ListGrantsResponse {
  success: boolean;
  grants: Array<{
    id: string;
    agentLabel: string;
    resourceType: string;
    resourceName: string;
    scope: string;
    tokenPrefix: string;
    persistent: boolean;
    expiresAt: string | null;
    expired: boolean;
    endpoint: string;
    accessLogCount: number;
    createdAt: string;
  }>;
}

export async function grantCommand(agentLabel: string | undefined, options: GrantOptions) {
  if (options.list) {
    return listGrantsCommand(options);
  }

  if (options.revoke) {
    return revokeGrantCommand(options.revoke, options);
  }

  if (!agentLabel) {
    console.error(chalk.red('\n[x] Agent label is required'));
    console.log(chalk.gray(`  Example: ${chalk.cyan('connect grant claude --db postgres --ttl 5m')}`));
    console.log(chalk.gray(`          ${chalk.cyan('connect grant cursor --db postgres --persistent')}\n`));
    process.exit(1);
  }

  let resourceType: string;
  let resourceName: string;

  if (options.db) {
    resourceType = 'db';
    resourceName = options.db;
  } else if (options.api) {
    resourceType = 'api';
    resourceName = options.api;
  } else if (options.path) {
    resourceType = 'path';
    resourceName = options.path;
  } else {
    console.error(chalk.red('\n[x] Resource is required'));
    console.log(chalk.gray('  Specify one of: --db <name>, --api <name>, or --path <path>'));
    console.log(chalk.gray(`  Example: ${chalk.cyan('connect grant claude --db postgres --ttl 5m')}\n`));
    process.exit(1);
  }

  if (!options.persistent && !options.ttl) {
    options.ttl = '5m';
  }

  if (options.persistent && options.ttl) {
    console.error(chalk.red('\n[x] Cannot use both --ttl and --persistent'));
    console.log(chalk.gray('  Use --ttl for time-limited or --persistent for never-expiring grants.\n'));
    process.exit(1);
  }

  const config = loadConfig();

  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    const body: Record<string, string> = {
      agentLabel,
      resourceType,
      resourceName,
      scope: options.scope,
    };
    if (options.ttl) {
      body.ttl = options.ttl;
    }

    const response = await fetch(`${hubUrl}/v1/grants`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`\n[x] Failed to create grant: ${error.message || response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as GrantResponse;

    if (!data.success || !data.grant) {
      console.error(chalk.red(`\n[x] Failed to create grant: ${data.message || 'Unknown error'}`));
      process.exit(1);
    }

    const g = data.grant;

    console.log(chalk.green('\n  Grant created.\n'));
    console.log(`  ${chalk.gray('Agent:')}     ${chalk.white(g.agentLabel)}`);
    console.log(`  ${chalk.gray('Resource:')}  ${chalk.white(g.resourceName)} ${chalk.dim(`(${g.resourceType})`)}`);
    console.log(`  ${chalk.gray('Scope:')}     ${chalk.white(g.scope)}`);

    if (g.persistent) {
      console.log(`  ${chalk.gray('Expires:')}   ${chalk.yellow('persistent')} ${chalk.dim('(revoke manually)')}`);
    } else {
      console.log(`  ${chalk.gray('Expires:')}   ${chalk.white(g.expiresInMinutes + ' minutes')}`);
    }

    console.log('');
    console.log(`  ${chalk.gray('Endpoint:')}  ${chalk.cyan(g.endpoint)}`);
    console.log(`  ${chalk.gray('Token:')}     ${chalk.yellow(g.token)}`);
    console.log('');
    console.log(chalk.dim('  Give the endpoint and token to the AI agent.'));
    if (g.persistent) {
      console.log(chalk.dim(`  This grant never expires. Revoke with: connect grant --revoke ${g.id}\n`));
    } else {
      console.log(chalk.dim(`  Access expires in ${g.expiresInMinutes} minutes.\n`));
    }
  } catch (err: any) {
    if (err.cause?.code === 'ECONNREFUSED') {
      console.error(chalk.red(`\n[x] Cannot connect to hub at ${hubUrl}`));
      console.log(chalk.gray('  Is the hub running? Check with: connect doctor\n'));
    } else {
      console.error(chalk.red(`\n[x] ${err.message}`));
    }
    process.exit(1);
  }
}

async function listGrantsCommand(options: GrantOptions) {
  const config = loadConfig();

  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    const response = await fetch(`${hubUrl}/v1/grants`, {
      headers: { 'x-api-key': config.apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`\n[x] Failed to list grants: ${error.message || response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as ListGrantsResponse;

    if (data.grants.length === 0) {
      console.log(chalk.gray('\n  No active grants.\n'));
      return;
    }

    console.log(chalk.white('\n  Active grants:\n'));

    for (const g of data.grants) {
      const expiryLabel = g.persistent
        ? chalk.yellow('persistent')
        : `${chalk.dim(`expires in ${Math.max(0, Math.round((new Date(g.expiresAt!).getTime() - Date.now()) / 60000))}m`)}`;

      const logCount = g.accessLogCount > 0 ? chalk.dim(` ${g.accessLogCount} requests`) : '';

      console.log(`  ${chalk.cyan(g.agentLabel)} → ${chalk.white(g.resourceName)} ${chalk.dim(`(${g.resourceType})`)}  ${chalk.gray(g.scope)}  ${expiryLabel}${logCount}  ${chalk.dim(g.tokenPrefix + '...')}  ${chalk.dim(g.id.slice(0, 8))}`);
    }
    console.log('');
  } catch (err: any) {
    console.error(chalk.red(`\n[x] ${err.message}`));
    process.exit(1);
  }
}

async function revokeGrantCommand(grantId: string, options: GrantOptions) {
  const config = loadConfig();

  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    const response = await fetch(`${hubUrl}/v1/grants/${grantId}`, {
      method: 'DELETE',
      headers: { 'x-api-key': config.apiKey },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`\n[x] Failed to revoke grant: ${error.message || response.statusText}`));
      process.exit(1);
    }

    console.log(chalk.green(`\n  Grant ${grantId.slice(0, 8)}... revoked.\n`));
  } catch (err: any) {
    console.error(chalk.red(`\n[x] ${err.message}`));
    process.exit(1);
  }
}
