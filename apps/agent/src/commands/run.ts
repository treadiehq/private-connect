import { spawn } from 'child_process';
import chalk from 'chalk';
import { findAvailablePort } from '../ports';
import { registerRoute, unregisterRoute } from '../active-routes';
import { ensureProxyRunning } from './proxy';

const PORT_RANGE_START = 4000;

interface RunOptions {
  port?: number;
  https?: boolean;
}

export async function runCommand(name: string, cmd: string[], options: RunOptions) {
  if (!name || cmd.length === 0) {
    console.error(chalk.red('[x] Usage: connect run <name> <cmd> [args...]'));
    process.exit(1);
  }

  const port = options.port || await findAvailablePort(PORT_RANGE_START);
  if (!port) {
    console.error(chalk.red('[x] No available port found'));
    process.exit(1);
  }

  console.log(chalk.cyan(`\n\u{1F680} Starting ${chalk.bold(name)}...\n`));
  console.log(chalk.gray(`  Command: ${cmd.join(' ')}`));
  console.log(chalk.gray(`  Port:    ${port} (via PORT env var)`));

  registerRoute(name, port, 'http');

  const proxy = await ensureProxyRunning({ https: options.https });
  if (proxy) {
    const proto = proxy.tls ? 'https' : 'http';
    console.log();
    console.log(chalk.green(`[ok] ${chalk.bold(name)} available at:`));
    console.log(chalk.cyan(`     ${proto}://${name}.localhost:${proxy.port}`));
  } else {
    console.log();
    console.log(chalk.yellow(`[!] Proxy not available. Direct access: http://localhost:${port}`));
    console.log(chalk.gray(`  Start proxy: ${chalk.cyan('connect proxy start')}`));
  }
  console.log();

  const child = spawn(cmd[0], cmd.slice(1), {
    env: { ...process.env, PORT: port.toString() },
    stdio: 'inherit',
    shell: true,
  });

  const cleanup = () => {
    unregisterRoute(name);
    if (!child.killed) child.kill('SIGTERM');
  };

  child.on('exit', (code) => {
    unregisterRoute(name);
    process.exit(code ?? 0);
  });

  child.on('error', (err) => {
    console.error(chalk.red(`\n[x] Failed to start: ${err.message}`));
    unregisterRoute(name);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log(chalk.yellow(`\n\u{1F44B} Stopping ${name}...`));
    cleanup();
    setTimeout(() => process.exit(0), 3000).unref();
  });

  process.on('SIGTERM', cleanup);
}
