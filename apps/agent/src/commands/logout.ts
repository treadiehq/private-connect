import chalk from 'chalk';
import { clearConfig, getConfigPath, loadConfig } from '../config';

interface LogoutOptions {
  config?: string;
}

export async function logoutCommand(options: LogoutOptions) {
  const configPath = getConfigPath();
  const existingConfig = loadConfig();
  
  if (!existingConfig) {
    console.log(chalk.yellow('No agent configuration found.'));
    console.log(chalk.gray(`  Config path: ${configPath}`));
    return;
  }
  
  console.log(chalk.cyan('🔓 Logging out...'));
  console.log();
  console.log(chalk.gray(`  Agent ID: ${existingConfig.agentId}`));
  console.log(chalk.gray(`  Label:    ${existingConfig.label}`));
  console.log(chalk.gray(`  Config:   ${configPath}`));
  console.log();
  
  const cleared = clearConfig();
  
  if (cleared) {
    console.log(chalk.green('[ok] Logged out successfully'));
    console.log(chalk.gray('  Local credentials have been cleared.'));
    console.log(chalk.gray('  Run "connect up" to authenticate again.'));
  } else {
    console.log(chalk.red('[x] Failed to clear configuration'));
  }
}

