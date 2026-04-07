import chalk from 'chalk';
import { loadActiveRoutes } from '../active-routes';
import { syncHosts, cleanHosts } from '../hosts';

export async function hostsCommand(action: string | undefined) {
  if (action === 'clean') {
    console.log(chalk.cyan('\n\u{1F527} Cleaning /etc/hosts...\n'));
    const result = cleanHosts({ interactive: true });
    if (result.cleaned) {
      console.log(chalk.green('[ok] Private Connect entries removed from /etc/hosts\n'));
    } else {
      console.error(chalk.red(`[x] ${result.error}\n`));
      process.exit(1);
    }
    return;
  }

  const routes = loadActiveRoutes();
  if (routes.length === 0) {
    console.log(chalk.yellow('\n[!] No active routes to sync. Run a service first.\n'));
    return;
  }

  console.log(chalk.cyan('\n\u{1F527} Syncing /etc/hosts...\n'));
  const entries = routes.map(r => ({ hostname: `${r.serviceName}.localhost`, ip: '127.0.0.1' }));
  const result = syncHosts(entries, { interactive: true });

  if (result.synced) {
    console.log(chalk.green('[ok] /etc/hosts synced:'));
    for (const e of entries) {
      console.log(chalk.gray(`  ${e.ip} ${e.hostname}`));
    }
    console.log();
  } else {
    console.error(chalk.red(`[x] ${result.error}\n`));
    process.exit(1);
  }
}
