import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as readline from 'readline';
import { spawn, execSync, SpawnOptions } from 'child_process';
import chalk from 'chalk';
import {
  loadPolicy,
  initPolicy,
  evaluateFileWrite,
  evaluateCommand,
  evaluateGitOperation,
  generatePolicyYaml,
  getDefaultPolicy,
  Action,
  Policy,
} from '../broker/policy';
import {
  logFileWrite,
  logCommand,
  logGitOperation,
  readAuditLog,
  getAuditStats,
  formatAuditEntry,
  getAuditPath,
} from '../broker/audit';

/**
 * Agent Permission Broker Commands
 * 
 * Provides CLI commands for:
 * - Initializing policy in a workspace
 * - Running commands through the broker
 * - Running AI agents with policy enforcement
 * - Viewing audit logs
 */

interface BrokerOptions {
  observe?: boolean;     // Log but don't enforce
  workingDir?: string;   // Working directory
  agent?: string;        // Agent identifier
  yes?: boolean;         // Auto-approve reviews
  no?: boolean;          // Auto-deny reviews
}

/**
 * Initialize the broker in a workspace
 */
export async function brokerInitCommand(options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  
  console.log(chalk.cyan('\n🛡️  Initializing Agent Permission Broker\n'));
  
  // Check if already initialized
  const existingPolicy = path.join(workingDir, '.connect', 'policy.yml');
  if (fs.existsSync(existingPolicy)) {
    console.log(chalk.yellow('[!] Policy already exists at .connect/policy.yml'));
    console.log(chalk.gray(`  Edit it to customize agent permissions.\n`));
    return;
  }
  
  const policyPath = initPolicy(workingDir);
  
  console.log(chalk.green('[ok] Created policy file'));
  console.log(chalk.gray(`  ${policyPath}\n`));
  
  console.log(chalk.white('  Default policy:'));
  console.log(chalk.gray('    • Source code (src/, lib/, *.ts, etc.) → allow'));
  console.log(chalk.gray('    • Config files (*.json, *.yml) → review'));
  console.log(chalk.gray('    • Secrets (.env, *.key) → block'));
  console.log(chalk.gray('    • CI/CD (.github/workflows/) → block'));
  console.log();
  
  console.log(chalk.white('  Next steps:'));
  console.log(chalk.gray(`    1. Edit ${chalk.cyan('.connect/policy.yml')} to customize rules`));
  console.log(chalk.gray(`    2. Run AI agents with: ${chalk.cyan('connect broker run -- <command>')}`));
  console.log(chalk.gray(`    3. View audit log: ${chalk.cyan('connect audit')}`));
  console.log();
}

/**
 * Show broker status
 */
export async function brokerStatusCommand(options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  
  console.log(chalk.cyan('\n🛡️  Agent Permission Broker Status\n'));
  
  // Check policy
  const policyPath = path.join(workingDir, '.connect', 'policy.yml');
  const hasPolicy = fs.existsSync(policyPath);
  
  if (hasPolicy) {
    console.log(chalk.green('  [ok] Policy: configured'));
    console.log(chalk.gray(`    ${policyPath}`));
    
    const policy = loadPolicy(workingDir);
    console.log(chalk.gray(`    Default action: ${policy.default}`));
    console.log(chalk.gray(`    Rules: ${policy.rules.length}`));
  } else {
    console.log(chalk.yellow('  ○ Policy: not configured'));
    console.log(chalk.gray(`    Run ${chalk.cyan('connect broker init')} to set up`));
  }
  
  console.log();
  
  // Audit stats
  const stats = getAuditStats();
  console.log(chalk.white('  Audit Log:'));
  console.log(chalk.gray(`    Total actions: ${stats.total}`));
  console.log(chalk.green(`    Allowed: ${stats.allowed}`));
  console.log(chalk.red(`    Blocked: ${stats.blocked}`));
  console.log(chalk.yellow(`    Reviewed: ${stats.reviewed}`));
  console.log();
  
  // Git hooks
  const gitHooksPath = path.join(workingDir, '.git', 'hooks');
  const preCommitHook = path.join(gitHooksPath, 'pre-commit');
  const prePushHook = path.join(gitHooksPath, 'pre-push');
  
  const hasPreCommit = fs.existsSync(preCommitHook) && 
    fs.readFileSync(preCommitHook, 'utf-8').includes('connect broker git-check');
  const hasPrePush = fs.existsSync(prePushHook) && 
    fs.readFileSync(prePushHook, 'utf-8').includes('connect broker git-check');
  
  console.log(chalk.white('  Git Hooks:'));
  if (hasPreCommit) {
    console.log(chalk.green('    [ok] pre-commit hook installed'));
  } else {
    console.log(chalk.gray('    ○ pre-commit hook not installed'));
  }
  if (hasPrePush) {
    console.log(chalk.green('    [ok] pre-push hook installed'));
  } else {
    console.log(chalk.gray('    ○ pre-push hook not installed'));
  }
  
  if (!hasPreCommit || !hasPrePush) {
    console.log(chalk.gray(`    Run ${chalk.cyan('connect broker hooks')} to install`));
  }
  
  console.log();
}

/**
 * Execute a command through the broker
 */
export async function brokerExecCommand(command: string[], options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  const policy = loadPolicy(workingDir);
  const fullCommand = command.join(' ');
  
  // Evaluate the command
  const evaluation = evaluateCommand(policy, fullCommand);
  
  // Handle based on action
  if (evaluation.action === 'block') {
    console.error(chalk.red(`\n[x] Command blocked by policy`));
    if (evaluation.reason) {
      console.error(chalk.gray(`  Reason: ${evaluation.reason}`));
    }
    if (evaluation.rule?.command) {
      console.error(chalk.gray(`  Rule: ${evaluation.rule.command}`));
    }
    console.error();
    
    logCommand(fullCommand, 'block', {
      agent: options.agent,
      rule: evaluation.rule?.command,
      reason: evaluation.reason,
      workingDir,
    });
    
    process.exit(1);
  }
  
  if (evaluation.action === 'review' && !options.observe) {
    // Prompt for approval
    const approved = await promptForApproval('command', fullCommand, evaluation.reason);
    
    logCommand(fullCommand, 'review', {
      agent: options.agent,
      rule: evaluation.rule?.command,
      reason: evaluation.reason,
      userApproved: approved,
      workingDir,
    });
    
    if (!approved) {
      console.log(chalk.yellow('\n[!] Command denied by user\n'));
      process.exit(1);
    }
  } else {
    logCommand(fullCommand, evaluation.action, {
      agent: options.agent,
      rule: evaluation.rule?.command,
      reason: evaluation.reason,
      workingDir,
    });
  }
  
  // Execute the command
  const [cmd, ...args] = command;
  const spawnOptions: SpawnOptions = {
    cwd: workingDir,
    stdio: 'inherit',
    shell: true,
  };
  
  const child = spawn(cmd, args, spawnOptions);
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (err) => {
    console.error(chalk.red(`\n[x] Failed to execute command: ${err.message}\n`));
    process.exit(1);
  });
}

/**
 * Check a file write operation
 */
export async function brokerCheckFileCommand(filePath: string, options: BrokerOptions): Promise<boolean> {
  const workingDir = options.workingDir || process.cwd();
  const policy = loadPolicy(workingDir);
  
  // Make path relative if absolute
  let relativePath = filePath;
  if (path.isAbsolute(filePath) && filePath.startsWith(workingDir)) {
    relativePath = path.relative(workingDir, filePath);
  }
  
  const evaluation = evaluateFileWrite(policy, relativePath);
  
  if (evaluation.action === 'block') {
    console.error(chalk.red(`\n[x] File write blocked: ${relativePath}`));
    if (evaluation.reason) {
      console.error(chalk.gray(`  Reason: ${evaluation.reason}`));
    }
    
    logFileWrite(relativePath, 'block', {
      agent: options.agent,
      rule: evaluation.rule?.path,
      reason: evaluation.reason,
      workingDir,
    });
    
    return false;
  }
  
  if (evaluation.action === 'review' && !options.observe) {
    const approved = await promptForApproval('file', relativePath, evaluation.reason);
    
    logFileWrite(relativePath, 'review', {
      agent: options.agent,
      rule: evaluation.rule?.path,
      reason: evaluation.reason,
      userApproved: approved,
      workingDir,
    });
    
    return approved;
  }
  
  logFileWrite(relativePath, evaluation.action, {
    agent: options.agent,
    rule: evaluation.rule?.path,
    reason: evaluation.reason,
    workingDir,
  });
  
  return true;
}

/**
 * Git hook check command
 */
export async function brokerGitCheckCommand(hookType: 'pre-commit' | 'pre-push', options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  const policy = loadPolicy(workingDir);
  
  // For pre-push, check if it's a force push
  if (hookType === 'pre-push') {
    // Check for force push indicators in stdin
    const rl = readline.createInterface({ input: process.stdin });
    let isForce = false;
    
    // Also check command line args for -f or --force
    const gitArgs = process.argv.slice(2);
    if (gitArgs.includes('-f') || gitArgs.includes('--force')) {
      isForce = true;
    }
    
    const operation = isForce ? 'force-push' : 'push';
    const evaluation = evaluateGitOperation(policy, operation as 'push' | 'force-push');
    
    if (evaluation.action === 'block') {
      console.error(chalk.red(`\n[x] Git ${operation} blocked by policy`));
      if (evaluation.reason) {
        console.error(chalk.gray(`  Reason: ${evaluation.reason}`));
      }
      
      logGitOperation(operation, 'block', {
        agent: options.agent,
        reason: evaluation.reason,
        workingDir,
      });
      
      process.exit(1);
    }
    
    if (evaluation.action === 'review' && !options.observe) {
      const approved = await promptForApproval('git', operation, evaluation.reason);
      
      logGitOperation(operation, 'review', {
        agent: options.agent,
        reason: evaluation.reason,
        userApproved: approved,
        workingDir,
      });
      
      if (!approved) {
        process.exit(1);
      }
    } else {
      logGitOperation(operation, evaluation.action, {
        agent: options.agent,
        reason: evaluation.reason,
        workingDir,
      });
    }
    
    rl.close();
  }
  
  // For pre-commit, check the files being committed
  if (hookType === 'pre-commit') {
    try {
      const stagedFiles = execSync('git diff --cached --name-only', { 
        cwd: workingDir, 
        encoding: 'utf-8' 
      }).trim().split('\n').filter(f => f);
      
      let blocked = false;
      const reviewFiles: string[] = [];
      
      for (const file of stagedFiles) {
        const evaluation = evaluateFileWrite(policy, file);
        
        if (evaluation.action === 'block') {
          console.error(chalk.red(`[x] Blocked: ${file}`));
          if (evaluation.reason) {
            console.error(chalk.gray(`  ${evaluation.reason}`));
          }
          blocked = true;
          
          logFileWrite(file, 'block', {
            agent: options.agent,
            rule: evaluation.rule?.path,
            reason: evaluation.reason,
            workingDir,
          });
        } else if (evaluation.action === 'review') {
          reviewFiles.push(file);
        }
      }
      
      if (blocked) {
        console.error(chalk.red('\n[x] Commit blocked due to policy violations\n'));
        process.exit(1);
      }
      
      if (reviewFiles.length > 0 && !options.observe) {
        console.log(chalk.yellow('\n[!] The following files require review:'));
        for (const file of reviewFiles) {
          console.log(chalk.gray(`  • ${file}`));
        }
        
        const approved = await promptForApproval('commit', `${reviewFiles.length} file(s)`, 'Files require review');
        
        for (const file of reviewFiles) {
          logFileWrite(file, 'review', {
            agent: options.agent,
            userApproved: approved,
            workingDir,
          });
        }
        
        if (!approved) {
          console.log(chalk.yellow('\n[!] Commit denied by user\n'));
          process.exit(1);
        }
      }
    } catch {
      // If git commands fail, allow the commit (don't block on errors)
    }
  }
  
  process.exit(0);
}

/**
 * Install git hooks
 */
export async function brokerHooksCommand(options: BrokerOptions & { uninstall?: boolean }) {
  const workingDir = options.workingDir || process.cwd();
  const gitDir = path.join(workingDir, '.git');
  const hooksDir = path.join(gitDir, 'hooks');
  
  if (!fs.existsSync(gitDir)) {
    console.error(chalk.red('\n[x] Not a git repository'));
    console.log(chalk.gray(`  Run this command from a git repository root.\n`));
    process.exit(1);
  }
  
  // Ensure hooks directory exists
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }
  
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');
  
  if (options.uninstall) {
    // Remove hooks
    let removed = 0;
    
    if (fs.existsSync(preCommitPath)) {
      const content = fs.readFileSync(preCommitPath, 'utf-8');
      if (content.includes('connect broker git-check')) {
        fs.unlinkSync(preCommitPath);
        removed++;
      }
    }
    
    if (fs.existsSync(prePushPath)) {
      const content = fs.readFileSync(prePushPath, 'utf-8');
      if (content.includes('connect broker git-check')) {
        fs.unlinkSync(prePushPath);
        removed++;
      }
    }
    
    console.log(chalk.green(`\n[ok] Removed ${removed} git hook(s)\n`));
    return;
  }
  
  // Install hooks
  const hookScript = (hookType: string) => `#!/bin/sh
# Connect Agent Permission Broker - ${hookType} hook
# This hook checks agent operations against your policy

connect broker git-check ${hookType}
`;

  let installed = 0;
  
  // Pre-commit hook
  if (!fs.existsSync(preCommitPath) || !fs.readFileSync(preCommitPath, 'utf-8').includes('connect broker git-check')) {
    fs.writeFileSync(preCommitPath, hookScript('pre-commit'));
    fs.chmodSync(preCommitPath, '755');
    installed++;
  }
  
  // Pre-push hook
  if (!fs.existsSync(prePushPath) || !fs.readFileSync(prePushPath, 'utf-8').includes('connect broker git-check')) {
    fs.writeFileSync(prePushPath, hookScript('pre-push'));
    fs.chmodSync(prePushPath, '755');
    installed++;
  }
  
  console.log(chalk.green(`\n[ok] Installed ${installed} git hook(s)`));
  console.log(chalk.gray(`  pre-commit: ${preCommitPath}`));
  console.log(chalk.gray(`  pre-push: ${prePushPath}\n`));
}

/**
 * View audit log
 */
export async function brokerAuditCommand(options: BrokerOptions & { 
  limit?: number;
  type?: string;
  action?: string;
  stats?: boolean;
}) {
  if (options.stats) {
    const stats = getAuditStats();
    
    console.log(chalk.cyan('\n📊 Audit Statistics\n'));
    console.log(chalk.white(`  Total actions: ${stats.total}`));
    console.log(chalk.green(`  Allowed: ${stats.allowed}`));
    console.log(chalk.red(`  Blocked: ${stats.blocked}`));
    console.log(chalk.yellow(`  Reviewed: ${stats.reviewed}`));
    console.log();
    console.log(chalk.white('  By type:'));
    for (const [type, count] of Object.entries(stats.byType)) {
      console.log(chalk.gray(`    ${type}: ${count}`));
    }
    console.log();
    return;
  }
  
  const limit = options.limit || 50;
  const entries = readAuditLog(limit);
  
  if (entries.length === 0) {
    console.log(chalk.gray('\n  No audit entries yet.\n'));
    console.log(chalk.gray(`  Audit log location: ${getAuditPath()}\n`));
    return;
  }
  
  // Filter if requested
  let filtered = entries;
  if (options.type) {
    filtered = filtered.filter(e => e.type === options.type);
  }
  if (options.action) {
    filtered = filtered.filter(e => e.action === options.action);
  }
  
  console.log(chalk.cyan(`\n📋 Recent Agent Actions (${filtered.length})\n`));
  
  for (const entry of filtered) {
    console.log(formatAuditEntry(entry));
  }
  
  console.log(chalk.gray(`\n  Showing ${filtered.length} of ${entries.length} entries`));
  console.log(chalk.gray(`  Full log: ${getAuditPath()}\n`));
}

/**
 * Broker run command - run a command with broker enforcement
 */
export async function brokerRunCommand(command: string[], options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  
  // Check if policy exists, if not suggest init
  const policyPath = path.join(workingDir, '.connect', 'policy.yml');
  if (!fs.existsSync(policyPath)) {
    console.log(chalk.yellow('[!] No policy found. Using secure defaults.'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect broker init')} to customize.\n`));
  }
  
  // Set up environment for brokered execution
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    CONNECT_BROKER: '1',
    CONNECT_AGENT: options.agent || 'unknown',
    CONNECT_WORKING_DIR: workingDir,
  };
  
  if (options.observe) {
    env.CONNECT_OBSERVE = '1';
    console.log(chalk.gray('  Running in observe mode (logging only)\n'));
  }
  
  const [cmd, ...args] = command;
  
  const child = spawn(cmd, args, {
    cwd: workingDir,
    stdio: 'inherit',
    shell: true,
    env,
  });
  
  child.on('exit', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (err) => {
    console.error(chalk.red(`\n[x] Failed to execute: ${err.message}\n`));
    process.exit(1);
  });
}

/**
 * Prompt user for approval
 */
async function promptForApproval(type: string, target: string, reason?: string): Promise<boolean> {
  // Check for auto-approve/deny flags
  if (process.env.CONNECT_AUTO_APPROVE === '1') return true;
  if (process.env.CONNECT_AUTO_DENY === '1') return false;
  
  // Check if stdin is a TTY
  if (!process.stdin.isTTY) {
    // Non-interactive mode - default to deny
    console.log(chalk.yellow(`\n[!] Review required but running non-interactively. Denying.`));
    return false;
  }
  
  console.log(chalk.yellow('\n┌─────────────────────────────────────────────────┐'));
  console.log(chalk.yellow('│  🛡️  Agent Permission Request                    │'));
  console.log(chalk.yellow('├─────────────────────────────────────────────────┤'));
  console.log(chalk.white(`│  Type: ${type.padEnd(40)}│`));
  
  // Truncate target if too long
  const displayTarget = target.length > 38 ? target.substring(0, 35) + '...' : target;
  console.log(chalk.white(`│  Target: ${displayTarget.padEnd(38)}│`));
  
  if (reason) {
    const displayReason = reason.length > 38 ? reason.substring(0, 35) + '...' : reason;
    console.log(chalk.gray(`│  Reason: ${displayReason.padEnd(38)}│`));
  }
  
  console.log(chalk.yellow('└─────────────────────────────────────────────────┘'));
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(chalk.cyan('\n  Allow? [y/N]: '), (answer) => {
      rl.close();
      const approved = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
      resolve(approved);
    });
  });
}

/**
 * Main broker command dispatcher
 */
export async function brokerCommand(
  action: string | undefined, 
  args: string[],
  options: BrokerOptions & { 
    limit?: number; 
    type?: string; 
    action?: string;
    stats?: boolean;
    uninstall?: boolean;
  }
) {
  switch (action) {
    case 'init':
      return brokerInitCommand(options);
    
    case 'status':
      return brokerStatusCommand(options);
    
    case 'exec':
      if (args.length === 0) {
        console.error(chalk.red('\n[x] No command provided'));
        console.log(chalk.gray(`  Usage: connect broker exec -- <command>\n`));
        process.exit(1);
      }
      return brokerExecCommand(args, options);
    
    case 'check':
      if (args.length === 0) {
        console.error(chalk.red('\n[x] No file path provided'));
        process.exit(1);
      }
      const allowed = await brokerCheckFileCommand(args[0], options);
      process.exit(allowed ? 0 : 1);
    
    case 'git-check':
      const hookType = args[0] as 'pre-commit' | 'pre-push';
      if (!hookType || !['pre-commit', 'pre-push'].includes(hookType)) {
        console.error(chalk.red('\n[x] Invalid hook type'));
        process.exit(1);
      }
      return brokerGitCheckCommand(hookType, options);
    
    case 'hooks':
      return brokerHooksCommand(options);
    
    case 'audit':
      return brokerAuditCommand(options);
    
    case 'run':
      if (args.length === 0) {
        console.error(chalk.red('\n[x] No command provided'));
        console.log(chalk.gray(`  Usage: connect broker run -- <command>\n`));
        process.exit(1);
      }
      return brokerRunCommand(args, options);
    
    default:
      return brokerStatusCommand(options);
  }
}

