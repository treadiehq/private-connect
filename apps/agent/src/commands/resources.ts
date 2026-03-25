import chalk from 'chalk';
import {
  findResourceConfig,
  loadResources,
  ConfigValidationError,
} from '../resources/parser';
import { ResourceListSuccess } from '../resources/types';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ResourcesListOptions {
  json?: boolean;
  file?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main command: connect resources
// ─────────────────────────────────────────────────────────────────────────────

export async function resourcesCommand(options: ResourcesListOptions) {
  const isJson = options.json || false;
  const configPath = options.file || findResourceConfig();

  if (!configPath) {
    if (isJson) {
      console.log(JSON.stringify({
        ok: false,
        error: { code: 'CONFIG_NOT_FOUND', message: 'No pconnect.yml found.' },
      }));
    } else {
      console.log(chalk.yellow('\n  [!] No pconnect.yml found.\n'));
      console.log(chalk.gray('  Create one with a "resources:" section:\n'));
      console.log(chalk.cyan('    resources:'));
      console.log(chalk.cyan('      staging-db:'));
      console.log(chalk.cyan('        type: postgres'));
      console.log(chalk.cyan('        host: internal-db'));
      console.log(chalk.cyan('        port: 5432'));
      console.log(chalk.cyan('        access:'));
      console.log(chalk.cyan('          mode: tcp'));
      console.log();
    }
    process.exit(1);
  }

  let result: ReturnType<typeof loadResources>;
  try {
    result = loadResources(configPath);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      if (isJson) {
        console.log(JSON.stringify({
          ok: false,
          error: { code: 'CONFIG_INVALID', message: err.message },
        }));
      } else {
        console.error(chalk.red(`\n  [x] ${err.message}\n`));
      }
      process.exit(1);
    }
    throw err;
  }

  if (!result || result.resources.size === 0) {
    if (isJson) {
      console.log(JSON.stringify({ ok: true, resources: [] } satisfies ResourceListSuccess));
    } else {
      console.log(chalk.gray('\n  No resources defined in config.\n'));
      console.log(chalk.gray('  Add a "resources:" section to your pconnect.yml.\n'));
    }
    return;
  }

  if (isJson) {
    const output: ResourceListSuccess = {
      ok: true,
      resources: Array.from(result.resources.values()).map((r) => ({
        name: r.name,
        type: r.type,
        target: `${r.targetHost}:${r.targetPort}`,
        via: r.via,
      })),
    };
    console.log(JSON.stringify(output));
    return;
  }

  // Human-readable table
  console.log();
  console.log(chalk.gray(`  Config: ${result.configPath}`));
  console.log();

  const entries = Array.from(result.resources.values());
  const maxNameLen = Math.max(...entries.map((r) => r.name.length), 4);
  const maxTypeLen = Math.max(...entries.map((r) => r.type.length), 4);

  for (const resource of entries) {
    const name = resource.name.padEnd(maxNameLen);
    const type = resource.type.padEnd(maxTypeLen);
    const target = `${resource.targetHost}:${resource.targetPort}`;
    const via = resource.via === 'hub' ? chalk.blue(' [hub]') : '';

    console.log(`  ${chalk.white(name)}  ${chalk.gray(type)}  ${chalk.cyan(target)}${via}`);
  }

  console.log();
}
