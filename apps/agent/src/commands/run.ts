import { spawn, spawnSync } from 'child_process';
import chalk from 'chalk';
import { findAvailablePort } from '../ports';
import { registerRoute, unregisterRoute } from '../active-routes';
import { ensureProxyRunning } from './proxy';

const PORT_RANGE_START = 4000;

/** Max wait after SIGTERM before escalating to SIGKILL / forced taskkill */
const TEARDOWN_GRACE_MS = 30_000;

interface RunOptions {
  port?: number;
  https?: boolean;
}

/**
 * Terminate the spawned shell and every process in its tree.
 * With `shell: true`, `child.kill()` only signals the shell; the real server can
 * survive as an orphan. `detached: true` makes the shell a process-group leader
 * so we can signal the whole group (Unix) or use taskkill /T (Windows).
 */
function killSpawnedProcessTree(pid: number | undefined, signal: NodeJS.Signals = 'SIGTERM'): void {
  if (pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      // /T kills the tree; /F matches Unix SIGKILL-style teardown (shell wrappers ignore polite closes)
      const args = signal === 'SIGKILL' ? ['/pid', String(pid), '/t', '/f'] : ['/pid', String(pid), '/t'];
      const result = spawnSync('taskkill', args, {
        encoding: 'utf8',
        timeout: TEARDOWN_GRACE_MS,
        windowsHide: true,
        stdio: 'ignore',
      });
      if (result.status !== 0 && signal !== 'SIGKILL') {
        spawnSync('taskkill', ['/pid', String(pid), '/t', '/f'], {
          timeout: TEARDOWN_GRACE_MS,
          windowsHide: true,
          stdio: 'ignore',
        });
      }
    } else {
      process.kill(-pid, signal);
    }
  } catch {
    // ESRCH / already exited
  }
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
    detached: true,
  });

  let forceExitTimer: NodeJS.Timeout | undefined;

  const teardown = (signal: NodeJS.Signals) => {
    unregisterRoute(name);
    killSpawnedProcessTree(child.pid, signal);
  };

  const scheduleForceExit = () => {
    if (forceExitTimer) return;
    forceExitTimer = setTimeout(() => {
      teardown('SIGKILL');
      setTimeout(() => process.exit(1), 500).unref();
    }, TEARDOWN_GRACE_MS).unref();
  };

  child.on('exit', (code) => {
    if (forceExitTimer) clearTimeout(forceExitTimer);
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
    teardown('SIGTERM');
    scheduleForceExit();
  });

  process.on('SIGTERM', () => {
    teardown('SIGTERM');
    scheduleForceExit();
  });
}
