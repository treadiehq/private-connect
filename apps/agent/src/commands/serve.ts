import chalk from 'chalk';
import { loadConfig } from '../config';
import { exposeCommand } from './expose';
import { findProjectConfig, loadProjectConfig } from './dev';

interface ServeOptions {
  hub: string;
  file?: string;
  config?: string;
}

/**
 * connect serve - Expose all services defined in the expose block of pconnect.yml
 *
 * Reads the `expose:` section from the project config and calls exposeCommand
 * for each entry. One command, multiple tunnels.
 */
export async function serveCommand(options: ServeOptions) {
  const agentConfig = loadConfig();
  
  if (!agentConfig) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  // Find project config
  const configPath = options.file || findProjectConfig();
  
  if (!configPath) {
    console.log(chalk.yellow('\n[!] No project config found.\n'));
    console.log(chalk.gray('  Create a pconnect.yml with an expose section:\n'));
    console.log(chalk.cyan('    expose:'));
    console.log(chalk.cyan('      web:'));
    console.log(chalk.cyan('        target: localhost:3000'));
    console.log(chalk.cyan('        public: true'));
    console.log(chalk.cyan('      api:'));
    console.log(chalk.cyan('        target: localhost:8000'));
    console.log();
    process.exit(1);
  }

  const projectConfig = loadProjectConfig(configPath);
  
  if (!projectConfig || !projectConfig.expose || projectConfig.expose.length === 0) {
    console.error(chalk.red('\n[x] No expose entries in config.\n'));
    console.log(chalk.gray('  Add an expose section to your pconnect.yml:\n'));
    console.log(chalk.cyan('    expose:'));
    console.log(chalk.cyan('      web:'));
    console.log(chalk.cyan('        target: localhost:3000'));
    console.log(chalk.cyan('        public: true'));
    console.log();
    process.exit(1);
  }

  const hubUrl = projectConfig.hub || agentConfig.hubUrl || options.hub;
  const entries = projectConfig.expose;

  console.log(chalk.cyan('\n📡 Private Connect Serve\n'));
  console.log(chalk.gray(`  Config:   ${configPath}`));
  console.log(chalk.gray(`  Hub:      ${hubUrl}`));
  console.log(chalk.gray(`  Services: ${entries.length}`));
  console.log();

  // Expose each entry
  const results: Array<{ name: string; target: string; success: boolean; public?: boolean }> = [];

  for (const entry of entries) {
    if (!entry.target) {
      console.log(chalk.yellow(`  [!] Skipping "${entry.name}": no target specified`));
      results.push({ name: entry.name, target: '', success: false });
      continue;
    }

    console.log(chalk.gray(`  ── ${entry.name} ──\n`));

    try {
      const result = await exposeCommand(entry.target, {
        name: entry.name,
        hub: hubUrl,
        protocol: 'auto',
        public: entry.public || false,
      });

      results.push({
        name: entry.name,
        target: entry.target,
        success: !!result,
        public: entry.public,
      });
    } catch (error) {
      const err = error as Error;
      console.log(chalk.red(`  [x] Failed to expose "${entry.name}": ${err.message}`));
      results.push({ name: entry.name, target: entry.target, success: false });
    }

    console.log();
  }

  // Print summary
  const successful = results.filter(r => r.success);
  const failed = results.filter(r => !r.success);

  console.log(chalk.cyan('─────────────────────────────────────'));
  console.log(chalk.white('  Serve Summary\n'));

  if (successful.length > 0) {
    console.log(chalk.green(`  ✓ ${successful.length} service(s) exposed:\n`));
    successful.forEach(r => {
      const publicTag = r.public ? chalk.blue(' [public]') : chalk.gray(' [private]');
      console.log(chalk.white(`    ${r.name}`) + chalk.gray(` → ${r.target}`) + publicTag);
    });
    console.log();
  }

  if (failed.length > 0) {
    console.log(chalk.yellow(`  ! ${failed.length} service(s) failed:\n`));
    failed.forEach(r => {
      console.log(chalk.gray(`    ${r.name} → ${r.target || '(no target)'}`));
    });
    console.log();
  }

  if (successful.length === 0) {
    console.error(chalk.red('  [x] No services exposed.\n'));
    process.exit(1);
  }

  console.log(chalk.gray('  Press Ctrl+C to stop all services\n'));

  // Keep process alive (WebSocket connections from exposeCommand keep the event loop active,
  // but this ensures we don't exit even if all connections temporarily drop)
  await new Promise(() => {});
}
