import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import chalk from 'chalk';
import { getConfigDir, loadConfig } from '../config';
import { 
  findPrivateConnectPorts, 
  isProcessRunning, 
  killProcess, 
  isPortAvailable,
  waitForPort 
} from '../ports';

interface DoctorOptions {
  fix?: boolean;
  json?: boolean;
}

interface HealthIssue {
  type: 'orphaned_process' | 'stale_pid' | 'stale_lock' | 'port_conflict' | 'config_issue';
  severity: 'warning' | 'error';
  description: string;
  fix?: {
    command: string;
    action: () => Promise<boolean>;
  };
}

interface HealthReport {
  healthy: boolean;
  issues: HealthIssue[];
  info: {
    configDir: string;
    agentConfigured: boolean;
    daemonRunning: boolean;
    platform: string;
    activeProcesses: Array<{ pid: number; port: number; command: string }>;
    portsInUse: number[];
  };
}

const DAEMON_PID_FILE = 'daemon.pid';
const PROXY_PID_FILE = 'proxy.pid';

/**
 * Main doctor command
 */
export async function doctorCommand(options: DoctorOptions) {
  if (!options.json) {
    console.log(chalk.cyan('\n🩺 Private Connect Doctor\n'));
    console.log(chalk.gray('  Checking system health...\n'));
  }

  const report = await runHealthCheck();

  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  // Display info
  console.log(chalk.white('  System Info'));
  console.log(chalk.gray(`    Platform:    ${report.info.platform}`));
  console.log(chalk.gray(`    Config Dir:  ${report.info.configDir}`));
  console.log(chalk.gray(`    Configured:  ${report.info.agentConfigured ? chalk.green('yes') : chalk.yellow('no')}`));
  console.log(chalk.gray(`    Daemon:      ${report.info.daemonRunning ? chalk.green('running') : chalk.gray('stopped')}`));
  console.log();

  // Active processes
  if (report.info.activeProcesses.length > 0) {
    console.log(chalk.white('  Active Processes'));
    report.info.activeProcesses.forEach(p => {
      console.log(chalk.gray(`    PID ${p.pid} → port ${p.port}`));
    });
    console.log();
  }

  // Display issues
  if (report.issues.length === 0) {
    console.log(chalk.green.bold('  [ok] No issues found\n'));
    console.log(chalk.gray('  Everything looks healthy!\n'));
    return;
  }

  const errors = report.issues.filter(i => i.severity === 'error');
  const warnings = report.issues.filter(i => i.severity === 'warning');

  if (errors.length > 0) {
    console.log(chalk.red(`  [x] ${errors.length} error(s) found:\n`));
    errors.forEach((issue, i) => {
      console.log(chalk.red(`    ${i + 1}. ${issue.description}`));
      if (issue.fix) {
        console.log(chalk.gray(`       Fix: ${issue.fix.command}`));
      }
    });
    console.log();
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow(`  [!] ${warnings.length} warning(s):\n`));
    warnings.forEach((issue, i) => {
      console.log(chalk.yellow(`    ${i + 1}. ${issue.description}`));
      if (issue.fix) {
        console.log(chalk.gray(`       Fix: ${issue.fix.command}`));
      }
    });
    console.log();
  }

  // Auto-fix if requested
  if (options.fix) {
    console.log(chalk.cyan('  🔧 Attempting auto-fix...\n'));
    
    let fixed = 0;
    let failed = 0;

    for (const issue of report.issues) {
      if (issue.fix) {
        console.log(chalk.gray(`    Fixing: ${issue.description}`));
        try {
          const success = await issue.fix.action();
          if (success) {
            console.log(chalk.green(`      [ok] Fixed`));
            fixed++;
          } else {
            console.log(chalk.red(`      [x] Failed`));
            failed++;
          }
        } catch (err) {
          const error = err as Error;
          console.log(chalk.red(`      [x] Error: ${error.message}`));
          failed++;
        }
      }
    }

    console.log();
    if (fixed > 0) {
      console.log(chalk.green(`  [ok] Fixed ${fixed} issue(s)`));
    }
    if (failed > 0) {
      console.log(chalk.red(`  [x] Failed to fix ${failed} issue(s)`));
    }
    console.log();
  } else {
    console.log(chalk.gray('  Run with --fix to auto-repair issues:\n'));
    console.log(chalk.cyan('    connect doctor --fix\n'));
  }
}

/**
 * Run full health check
 */
async function runHealthCheck(): Promise<HealthReport> {
  const issues: HealthIssue[] = [];
  const configDir = getConfigDir();
  const config = loadConfig();
  const platform = os.platform();

  // Get active Private Connect processes
  const activeProcesses = findPrivateConnectPorts();
  const portsInUse = activeProcesses.map(p => p.port);

  // Check for stale PID files
  const stalePidIssues = await checkStalePidFiles(configDir);
  issues.push(...stalePidIssues);

  // Check for orphaned processes
  const orphanedIssues = await checkOrphanedProcesses(configDir, activeProcesses);
  issues.push(...orphanedIssues);

  // Check daemon status
  const daemonRunning = await checkDaemonStatus(configDir);

  // Check for common port conflicts
  const portConflictIssues = await checkCommonPorts();
  issues.push(...portConflictIssues);

  // Check config health
  const configIssues = checkConfigHealth(config);
  issues.push(...configIssues);

  return {
    healthy: issues.length === 0,
    issues,
    info: {
      configDir,
      agentConfigured: !!config,
      daemonRunning,
      platform,
      activeProcesses,
      portsInUse,
    },
  };
}

/**
 * Check for stale PID files
 */
async function checkStalePidFiles(configDir: string): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const pidFiles = [DAEMON_PID_FILE, PROXY_PID_FILE];

  for (const pidFile of pidFiles) {
    const pidPath = path.join(configDir, pidFile);
    
    if (!fs.existsSync(pidPath)) continue;

    try {
      const pidContent = fs.readFileSync(pidPath, 'utf-8').trim();
      const pid = parseInt(pidContent, 10);

      if (isNaN(pid)) {
        issues.push({
          type: 'stale_pid',
          severity: 'warning',
          description: `Corrupted PID file: ${pidFile}`,
          fix: {
            command: `rm ${pidPath}`,
            action: async () => {
              fs.unlinkSync(pidPath);
              return true;
            },
          },
        });
        continue;
      }

      if (!isProcessRunning(pid)) {
        issues.push({
          type: 'stale_pid',
          severity: 'warning',
          description: `Stale PID file: ${pidFile} (PID ${pid} not running)`,
          fix: {
            command: `rm ${pidPath}`,
            action: async () => {
              fs.unlinkSync(pidPath);
              return true;
            },
          },
        });
      }
    } catch {
      // Ignore read errors
    }
  }

  return issues;
}

/**
 * Check for orphaned processes
 */
async function checkOrphanedProcesses(
  configDir: string,
  activeProcesses: Array<{ pid: number; port: number; command: string }>
): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];

  // Check if any Private Connect processes are running but not tracked
  const daemonPidPath = path.join(configDir, DAEMON_PID_FILE);
  let trackedPid: number | null = null;

  if (fs.existsSync(daemonPidPath)) {
    try {
      trackedPid = parseInt(fs.readFileSync(daemonPidPath, 'utf-8').trim(), 10);
    } catch {
      // Ignore
    }
  }

  for (const proc of activeProcesses) {
    // Skip if this is the tracked daemon
    if (trackedPid && proc.pid === trackedPid) continue;

    // Check if this process has been running for a while without activity
    // This is a heuristic - we can't know for sure if it's orphaned
    const isLikelyOrphaned = proc.command.includes('connect up') || 
                             proc.command.includes('connect proxy') ||
                             proc.command.includes('connect daemon');

    if (isLikelyOrphaned && trackedPid !== proc.pid) {
      issues.push({
        type: 'orphaned_process',
        severity: 'warning',
        description: `Potentially orphaned process: PID ${proc.pid} on port ${proc.port}`,
        fix: {
          command: `kill ${proc.pid}`,
          action: async () => {
            killProcess(proc.pid, 'SIGTERM');
            // Wait a bit for graceful shutdown
            await new Promise(resolve => setTimeout(resolve, 1000));
            if (isProcessRunning(proc.pid)) {
              killProcess(proc.pid, 'SIGKILL');
            }
            return !isProcessRunning(proc.pid);
          },
        },
      });
    }
  }

  return issues;
}

/**
 * Check daemon status
 */
async function checkDaemonStatus(configDir: string): Promise<boolean> {
  const pidPath = path.join(configDir, DAEMON_PID_FILE);
  
  if (!fs.existsSync(pidPath)) {
    return false;
  }

  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    return isProcessRunning(pid);
  } catch {
    return false;
  }
}

/**
 * Check common ports for conflicts
 */
async function checkCommonPorts(): Promise<HealthIssue[]> {
  const issues: HealthIssue[] = [];
  const commonPorts = [3000, 3001, 8080, 5000];

  for (const port of commonPorts) {
    if (!(await isPortAvailable(port))) {
      // This is informational, not necessarily an issue
      // We'll only report it if it blocks a default Private Connect operation
    }
  }

  return issues;
}

/**
 * Check config file health
 */
function checkConfigHealth(config: ReturnType<typeof loadConfig>): HealthIssue[] {
  const issues: HealthIssue[] = [];

  if (!config) {
    issues.push({
      type: 'config_issue',
      severity: 'warning',
      description: 'Agent not configured. Run: connect up',
    });
    return issues;
  }

  // Check for expired or missing tokens
  if (!config.token) {
    issues.push({
      type: 'config_issue',
      severity: 'error',
      description: 'Missing authentication token. Re-authenticate with: connect up --api-key <key>',
    });
  }

  // Check hub URL
  if (!config.hubUrl) {
    issues.push({
      type: 'config_issue',
      severity: 'error',
      description: 'Missing hub URL in config',
    });
  }

  return issues;
}

/**
 * Cleanup command - forcefully clean all Private Connect resources
 */
export async function cleanupCommand(options: { force?: boolean }) {
  console.log(chalk.cyan('\n🧹 Private Connect Cleanup\n'));

  const configDir = getConfigDir();
  const activeProcesses = findPrivateConnectPorts();

  if (activeProcesses.length === 0) {
    console.log(chalk.gray('  No active Private Connect processes found.\n'));
  } else {
    console.log(chalk.white(`  Found ${activeProcesses.length} active process(es):\n`));
    
    for (const proc of activeProcesses) {
      console.log(chalk.gray(`    PID ${proc.pid} on port ${proc.port}`));
      
      if (options.force) {
        console.log(chalk.yellow(`    → Killing...`));
        killProcess(proc.pid, 'SIGTERM');
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (isProcessRunning(proc.pid)) {
          killProcess(proc.pid, 'SIGKILL');
          await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (!isProcessRunning(proc.pid)) {
          console.log(chalk.green(`    [ok] Killed`));
        } else {
          console.log(chalk.red(`    [x] Failed to kill`));
        }
      }
    }
    console.log();
  }

  // Clean up PID files
  const pidFiles = [DAEMON_PID_FILE, PROXY_PID_FILE];
  let cleanedFiles = 0;

  for (const pidFile of pidFiles) {
    const pidPath = path.join(configDir, pidFile);
    if (fs.existsSync(pidPath)) {
      if (options.force) {
        try {
          fs.unlinkSync(pidPath);
          console.log(chalk.green(`  [ok] Removed ${pidFile}`));
          cleanedFiles++;
        } catch {
          console.log(chalk.red(`  [x] Failed to remove ${pidFile}`));
        }
      } else {
        console.log(chalk.gray(`  Would remove: ${pidPath}`));
      }
    }
  }

  console.log();

  if (!options.force) {
    console.log(chalk.yellow('  Run with --force to actually clean up:\n'));
    console.log(chalk.cyan('    connect cleanup --force\n'));
  } else {
    console.log(chalk.green('  [ok] Cleanup complete\n'));
  }
}

/**
 * Status command - quick overview
 */
export async function statusCommand(options: { json?: boolean }) {
  const report = await runHealthCheck();

  if (options.json) {
    console.log(JSON.stringify({
      healthy: report.healthy,
      daemon: report.info.daemonRunning ? 'running' : 'stopped',
      processes: report.info.activeProcesses.length,
      issues: report.issues.length,
      ports: report.info.portsInUse,
    }, null, 2));
    return;
  }

  const statusIcon = report.healthy ? chalk.green('●') : chalk.yellow('●');
  const daemonStatus = report.info.daemonRunning ? chalk.green('running') : chalk.gray('stopped');

  console.log(`\n  ${statusIcon} Private Connect`);
  console.log(chalk.gray(`    Daemon: ${daemonStatus}`));
  console.log(chalk.gray(`    Processes: ${report.info.activeProcesses.length}`));
  console.log(chalk.gray(`    Issues: ${report.issues.length}`));
  
  if (report.info.portsInUse.length > 0) {
    console.log(chalk.gray(`    Ports: ${report.info.portsInUse.join(', ')}`));
  }
  console.log();
}

