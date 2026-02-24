import chalk from 'chalk';
import { loadConfig, ensureConfig, getConfigPath } from '../config';
import { enforceSecureConnection, SecurityError } from '../security';

interface LoginOptions {
  hub: string;
  config?: string;
}

export async function loginCommand(apiKey: string, options: LoginOptions): Promise<void> {
  try {
    enforceSecureConnection(options.hub);
  } catch (err) {
    if (err instanceof SecurityError) {
      process.exit(1);
    }
    throw err;
  }

  console.log(chalk.cyan('\n🔑 Logging in...\n'));

  // Validate the API key against the hub
  try {
    const response = await fetch(`${options.hub}/v1/workspace/validate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
      },
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        console.error(chalk.red('  [x] Invalid API key'));
        console.log(chalk.gray('  Check your key at https://app.privateconnect.co/settings/api-keys\n'));
        process.exit(1);
      }
      // Key might still be valid — hub may not have this endpoint yet
    }
  } catch {
    // Network error or endpoint doesn't exist — save anyway, it'll fail later if invalid
    console.log(chalk.yellow('  [!] Could not validate key (hub unreachable), saving anyway'));
  }

  // Save config with the API key
  const existing = loadConfig();
  if (existing) {
    // Update existing config with new API key
    existing.apiKey = apiKey;
    if (existing.hubUrl !== options.hub) {
      existing.hubUrl = options.hub;
    }
    const { saveConfig } = await import('../config');
    saveConfig(existing);
  } else {
    // First-time setup — generates agent ID, token, etc.
    ensureConfig(options.hub, apiKey);
  }

  console.log(chalk.green('  [ok] API key saved'));
  console.log(chalk.gray(`  Config: ${getConfigPath()}`));
  console.log();
  console.log(chalk.white('  You can now run commands without --api-key:'));
  console.log(chalk.cyan('  $ connect expose localhost:3000 --name my-app'));
  console.log(chalk.cyan('  $ connect reach my-app'));
  console.log();
}
