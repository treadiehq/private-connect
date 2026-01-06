import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { spawn, execSync, SpawnOptions, spawnSync } from 'child_process';
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
  AuditEntry,
} from '../broker/audit';

// ─────────────────────────────────────────────────────────────────────────────
// Shell Metacharacter Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Shell metacharacters that could allow command injection
 */
const SHELL_METACHARACTERS = /[;&|`$(){}[\]<>!\\'"*?~\n\r]/;

/**
 * Check if a command or its arguments contain shell metacharacters
 * that could bypass policy enforcement
 */
function containsShellMetacharacters(args: string[]): boolean {
  return args.some(arg => SHELL_METACHARACTERS.test(arg));
}

/**
 * Validate command arguments for security
 * Returns an error message if validation fails, null if OK
 */
function validateCommandArgs(command: string[]): string | null {
  if (command.length === 0) {
    return 'No command provided';
  }

  // Check for shell metacharacters in the command itself
  // (args can be checked separately for stricter enforcement)
  const fullCommand = command.join(' ');
  
  // Check for common shell operators that could chain commands
  const dangerousPatterns = [
    { pattern: /;\s*\S/, desc: 'command chaining (;)' },
    { pattern: /&&\s*\S/, desc: 'conditional chaining (&&)' },
    { pattern: /\|\|\s*\S/, desc: 'conditional chaining (||)' },
    { pattern: /\|\s*\S/, desc: 'piping (|)' },
    { pattern: /`[^`]+`/, desc: 'command substitution (backticks)' },
    { pattern: /\$\([^)]+\)/, desc: 'command substitution ($())' },
  ];

  for (const { pattern, desc } of dangerousPatterns) {
    if (pattern.test(fullCommand)) {
      return `Command contains ${desc} which could bypass policy`;
    }
  }

  return null;
}

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
  console.log(chalk.yellow('  ⚠️  Experimental: AI agent governance is an emerging space.'));
  console.log(chalk.yellow('     This feature is forward-looking and may change.\n'));
  
  const result = initPolicy(workingDir);
  
  if (!result.success) {
    console.log(chalk.yellow(`[!] ${result.error}`));
    if (result.path) {
      console.log(chalk.gray(`  Edit ${result.path} to customize agent permissions.\n`));
    }
    return;
  }
  
  console.log(chalk.green('[ok] Created policy file'));
  console.log(chalk.gray(`  ${result.path}\n`));
  
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
 * 
 * Security: Commands are executed with shell: false to prevent
 * shell metacharacter injection bypassing policy checks.
 */
export async function brokerExecCommand(command: string[], options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  const policy = loadPolicy(workingDir);
  const fullCommand = command.join(' ');
  
  // Validate command for shell metacharacters
  const validationError = validateCommandArgs(command);
  if (validationError) {
    console.error(chalk.red(`\n[x] Command validation failed`));
    console.error(chalk.gray(`  ${validationError}`));
    console.error(chalk.gray(`  Use shell-free commands or run directly in shell.\n`));
    
    logCommand(fullCommand, 'block', {
      agent: options.agent,
      reason: `Validation failed: ${validationError}`,
      workingDir,
    });
    
    process.exit(1);
  }
  
  // Evaluate the command against policy
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
    const approved = await promptForApproval('command', fullCommand, evaluation.reason, options);
    
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
  
  // Execute the command with shell: false to prevent injection
  const [cmd, ...args] = command;
  const spawnOptions: SpawnOptions = {
    cwd: workingDir,
    stdio: 'inherit',
    shell: false,  // SECURITY: Prevent shell metacharacter injection
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
    const approved = await promptForApproval('file', relativePath, evaluation.reason, options);
    
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
 * Parse pre-push stdin to detect force pushes
 * 
 * Git pre-push hook receives on stdin:
 *   <local ref> <local sha1> <remote ref> <remote sha1>
 * 
 * A force push is detected when:
 * - local sha is not a descendant of remote sha (non-fast-forward)
 * - remote sha is not all zeros (not a new branch)
 */
async function detectForcePush(workingDir: string): Promise<boolean> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin });
    const refUpdates: Array<{localSha: string, remoteSha: string}> = [];
    
    rl.on('line', (line) => {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 4) {
        const [, localSha, , remoteSha] = parts;
        refUpdates.push({ localSha, remoteSha });
      }
    });
    
    rl.on('close', () => {
      // Check each ref update for force push
      for (const { localSha, remoteSha } of refUpdates) {
        // Skip new branches (remote sha is all zeros)
        if (/^0+$/.test(remoteSha)) continue;
        
        // Skip deletions (local sha is all zeros)
        if (/^0+$/.test(localSha)) continue;
        
        // Check if this is a fast-forward push
        // If remote sha is not an ancestor of local sha, it's a force push
        try {
          const result = spawnSync('git', ['merge-base', '--is-ancestor', remoteSha, localSha], {
            cwd: workingDir,
            stdio: 'pipe',
          });
          
          if (result.status !== 0) {
            // Not a fast-forward - this is a force push
            resolve(true);
            return;
          }
        } catch {
          // If we can't determine, assume it's a force push for safety
          resolve(true);
          return;
        }
      }
      
      resolve(false);
    });
    
    // Handle timeout - if stdin never closes, assume normal push
    setTimeout(() => {
      rl.close();
    }, 1000);
  });
}

/**
 * Git hook check command
 * 
 * SECURITY: Fails closed - if policy evaluation fails, the operation is blocked.
 */
export async function brokerGitCheckCommand(hookType: 'pre-commit' | 'pre-push', options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  
  let policy: Policy;
  try {
    policy = loadPolicy(workingDir);
  } catch (err) {
    // SECURITY: Fail closed on policy load errors
    console.error(chalk.red(`\n[x] Failed to load policy`));
    console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
    console.error(chalk.gray(`  Blocking operation for safety.\n`));
    process.exit(1);
  }
  
  // For pre-push, check if it's a force push by parsing stdin
  if (hookType === 'pre-push') {
    let isForce = false;
    
    try {
      // Parse stdin to detect force pushes (more reliable than checking args)
      isForce = await detectForcePush(workingDir);
    } catch (err) {
      // SECURITY: If force detection fails, assume it might be a force push
      console.error(chalk.yellow(`\n[!] Could not determine push type, treating as force-push for safety`));
      isForce = true;
    }
    
    const operation = isForce ? 'force-push' : 'push';
    
    let evaluation;
    try {
      evaluation = evaluateGitOperation(policy, operation as 'push' | 'force-push');
    } catch (err) {
      // SECURITY: Fail closed on evaluation errors
      console.error(chalk.red(`\n[x] Policy evaluation failed`));
      console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}\n`));
      
      logGitOperation(operation, 'block', {
        agent: options.agent,
        reason: `Policy evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
        workingDir,
      });
      
      process.exit(1);
    }
    
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
      const approved = await promptForApproval('git', operation, evaluation.reason, options);
      
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
  }
  
  // For pre-commit, check the files being committed
  if (hookType === 'pre-commit') {
    let stagedFiles: string[];
    
    try {
      const result = spawnSync('git', ['diff', '--cached', '--name-only'], {
        cwd: workingDir,
        encoding: 'utf-8',
        timeout: 10000,
      });
      
      if (result.status !== 0) {
        throw new Error(`git diff failed: ${result.stderr || 'unknown error'}`);
      }
      
      stagedFiles = (result.stdout || '').trim().split('\n').filter(f => f);
    } catch (err) {
      // SECURITY: Fail closed if we can't determine staged files
      console.error(chalk.red(`\n[x] Failed to get staged files`));
      console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
      console.error(chalk.gray(`  Blocking commit for safety.\n`));
      
      logGitOperation('commit', 'block', {
        agent: options.agent,
        reason: `Failed to get staged files: ${err instanceof Error ? err.message : String(err)}`,
        workingDir,
      });
      
      process.exit(1);
    }
    
    let blocked = false;
    const reviewFiles: string[] = [];
    
    for (const file of stagedFiles) {
      let evaluation;
      try {
        evaluation = evaluateFileWrite(policy, file);
      } catch (err) {
        // SECURITY: Fail closed on evaluation errors
        console.error(chalk.red(`[x] Policy evaluation failed for: ${file}`));
        console.error(chalk.gray(`  ${err instanceof Error ? err.message : String(err)}`));
        blocked = true;
        
        logFileWrite(file, 'block', {
          agent: options.agent,
          reason: `Policy evaluation failed: ${err instanceof Error ? err.message : String(err)}`,
          workingDir,
        });
        continue;
      }
      
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
      
      const approved = await promptForApproval('commit', `${reviewFiles.length} file(s)`, 'Files require review', options);
      
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
  }
  
  process.exit(0);
}

/**
 * Install git hooks
 * 
 * IMPROVEMENT: Chains existing hooks instead of overwriting them.
 * Backs up existing hooks and calls them after broker check.
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
    fs.mkdirSync(hooksDir, { recursive: true, mode: 0o755 });
  }
  
  const preCommitPath = path.join(hooksDir, 'pre-commit');
  const prePushPath = path.join(hooksDir, 'pre-push');
  
  // Backup suffix for existing hooks
  const BACKUP_SUFFIX = '.connect-backup';
  const HOOK_MARKER = '# Connect Agent Permission Broker';
  
  if (options.uninstall) {
    // Remove hooks and restore backups
    let removed = 0;
    
    for (const hookPath of [preCommitPath, prePushPath]) {
      if (fs.existsSync(hookPath)) {
        const content = fs.readFileSync(hookPath, 'utf-8');
        if (content.includes(HOOK_MARKER)) {
          fs.unlinkSync(hookPath);
          removed++;
          
          // Restore backup if it exists
          const backupPath = hookPath + BACKUP_SUFFIX;
          if (fs.existsSync(backupPath)) {
            fs.renameSync(backupPath, hookPath);
            console.log(chalk.gray(`  Restored: ${path.basename(hookPath)} from backup`));
          }
        }
      }
    }
    
    console.log(chalk.green(`\n[ok] Removed ${removed} git hook(s)\n`));
    return;
  }
  
  /**
   * Generate a hook script that chains with existing hooks
   */
  const generateHookScript = (hookType: string, existingHookPath: string | null): string => {
    const chainCommand = existingHookPath 
      ? `\n# Chain to original hook\nif [ -x "${existingHookPath}" ]; then\n  "${existingHookPath}" "$@" || exit $?\nfi\n`
      : '';
    
    return `#!/bin/sh
${HOOK_MARKER} - ${hookType} hook
# This hook checks agent operations against your policy
# Installed: ${new Date().toISOString()}

# Run broker check first
connect broker git-check ${hookType} || exit $?
${chainCommand}
exit 0
`;
  };

  let installed = 0;
  let updated = 0;
  
  for (const { hookPath, hookType } of [
    { hookPath: preCommitPath, hookType: 'pre-commit' },
    { hookPath: prePushPath, hookType: 'pre-push' },
  ]) {
    const backupPath = hookPath + BACKUP_SUFFIX;
    
    if (fs.existsSync(hookPath)) {
      const content = fs.readFileSync(hookPath, 'utf-8');
      
      if (content.includes(HOOK_MARKER)) {
        // Already installed, update it
        const existingBackup = fs.existsSync(backupPath) ? backupPath : null;
        fs.writeFileSync(hookPath, generateHookScript(hookType, existingBackup));
        fs.chmodSync(hookPath, '755');
        updated++;
        continue;
      }
      
      // Existing user hook - back it up and chain
      console.log(chalk.yellow(`  Backing up existing ${hookType} hook`));
      fs.copyFileSync(hookPath, backupPath);
      fs.chmodSync(backupPath, '755');
      
      fs.writeFileSync(hookPath, generateHookScript(hookType, backupPath));
      fs.chmodSync(hookPath, '755');
      installed++;
    } else {
      // No existing hook
      fs.writeFileSync(hookPath, generateHookScript(hookType, null));
      fs.chmodSync(hookPath, '755');
      installed++;
    }
  }
  
  console.log(chalk.green(`\n[ok] Installed ${installed} git hook(s)${updated > 0 ? `, updated ${updated}` : ''}`));
  console.log(chalk.gray(`  pre-commit: ${preCommitPath}`));
  console.log(chalk.gray(`  pre-push: ${prePushPath}`));
  
  // Check for existing backups
  const backups = [preCommitPath + BACKUP_SUFFIX, prePushPath + BACKUP_SUFFIX].filter(fs.existsSync);
  if (backups.length > 0) {
    console.log(chalk.gray(`\n  Existing hooks backed up and will be called after broker check.`));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect broker hooks --uninstall')} to restore original hooks.\n`));
  } else {
    console.log();
  }
}

/**
 * Validate entry type filter
 */
function isValidEntryType(type: string): type is 'file' | 'command' | 'git' {
  return ['file', 'command', 'git'].includes(type);
}

/**
 * Validate action filter
 */
function isValidAction(action: string): action is Action {
  return ['allow', 'block', 'review'].includes(action);
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
  
  // Validate filter options
  if (options.type && !isValidEntryType(options.type)) {
    console.error(chalk.red(`\n[x] Invalid type filter: ${options.type}`));
    console.log(chalk.gray(`  Valid types: file, command, git\n`));
    process.exit(1);
  }
  
  if (options.action && !isValidAction(options.action)) {
    console.error(chalk.red(`\n[x] Invalid action filter: ${options.action}`));
    console.log(chalk.gray(`  Valid actions: allow, block, review\n`));
    process.exit(1);
  }
  
  const limit = Math.min(Math.max(options.limit || 50, 1), 1000); // Clamp to 1-1000
  const entries = readAuditLog(limit);
  
  if (entries.length === 0) {
    console.log(chalk.gray('\n  No audit entries yet.\n'));
    console.log(chalk.gray(`  Audit log location: ${getAuditPath()}\n`));
    return;
  }
  
  // Filter if requested (entries are already validated by readAuditLog)
  let filtered = entries;
  if (options.type) {
    filtered = filtered.filter(e => e.type === options.type);
  }
  if (options.action) {
    filtered = filtered.filter(e => e.action === options.action);
  }
  
  console.log(chalk.cyan(`\n📋 Recent Agent Actions (${filtered.length})\n`));
  
  for (const entry of filtered) {
    try {
      console.log(formatAuditEntry(entry));
    } catch {
      // Skip malformed entries
    }
  }
  
  console.log(chalk.gray(`\n  Showing ${filtered.length} of ${entries.length} entries`));
  console.log(chalk.gray(`  Full log: ${getAuditPath()}\n`));
}

/**
 * Broker run command - run a command with broker enforcement
 * 
 * This is a convenience wrapper that sets up the broker environment
 * for running AI agent commands.
 */
export async function brokerRunCommand(command: string[], options: BrokerOptions) {
  const workingDir = options.workingDir || process.cwd();
  
  // Validate command for shell metacharacters
  const validationError = validateCommandArgs(command);
  if (validationError) {
    console.error(chalk.red(`\n[x] Command validation failed`));
    console.error(chalk.gray(`  ${validationError}`));
    console.error(chalk.gray(`  Use shell-free commands or run directly in shell.\n`));
    process.exit(1);
  }
  
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
  
  // Execute with shell: false to prevent injection
  const child = spawn(cmd, args, {
    cwd: workingDir,
    stdio: 'inherit',
    shell: false,  // SECURITY: Prevent shell metacharacter injection
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
 * Source of the approval decision (for audit logging)
 */
type ApprovalSource = 'user' | 'env-auto-approve' | 'env-auto-deny' | 'cli-flag' | 'non-interactive';

/**
 * Prompt user for approval
 * 
 * SECURITY: Environment-based auto-approve/deny are logged distinctly
 * in the audit log to detect compromised environments.
 */
async function promptForApproval(
  type: string, 
  target: string, 
  reason?: string,
  options?: BrokerOptions
): Promise<boolean> {
  // Priority 1: CLI flags (explicit user intent)
  if (options?.yes) {
    console.log(chalk.gray('  Auto-approved via --yes flag'));
    logApprovalSource('cli-flag', type, target, true, options);
    return true;
  }
  if (options?.no) {
    console.log(chalk.yellow('  Auto-denied via --no flag'));
    logApprovalSource('cli-flag', type, target, false, options);
    return false;
  }
  
  // Priority 2: Environment variables (with audit distinction)
  // SECURITY: Log these separately to detect environment compromise
  if (process.env.CONNECT_AUTO_APPROVE === '1') {
    console.log(chalk.gray('  Auto-approved via CONNECT_AUTO_APPROVE'));
    logApprovalSource('env-auto-approve', type, target, true, options);
    return true;
  }
  if (process.env.CONNECT_AUTO_DENY === '1') {
    console.log(chalk.yellow('  Auto-denied via CONNECT_AUTO_DENY'));
    logApprovalSource('env-auto-deny', type, target, false, options);
    return false;
  }
  
  // Check if stdin is a TTY
  if (!process.stdin.isTTY) {
    // Non-interactive mode - default to deny (fail safe)
    console.log(chalk.yellow(`\n[!] Review required but running non-interactively. Denying.`));
    logApprovalSource('non-interactive', type, target, false, options);
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
 * Log the source of approval decisions for security auditing
 */
function logApprovalSource(
  source: ApprovalSource,
  type: string,
  target: string,
  approved: boolean,
  options?: BrokerOptions
): void {
  // This creates an additional audit entry specifically for auto-approvals
  // to help detect environment compromise
  if (source === 'env-auto-approve' || source === 'env-auto-deny') {
    logCommand(`[audit:${source}] ${type}:${target}`, approved ? 'allow' : 'block', {
      agent: options?.agent,
      reason: `Auto-${approved ? 'approved' : 'denied'} via ${source}`,
      workingDir: options?.workingDir || process.cwd(),
    });
  }
}

/**
 * Valid broker actions
 */
const VALID_BROKER_ACTIONS = [
  'init', 'status', 'exec', 'check', 'git-check', 'hooks', 'audit', 'run'
] as const;

type BrokerAction = typeof VALID_BROKER_ACTIONS[number];

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
  // Warn about unknown actions
  if (action && !VALID_BROKER_ACTIONS.includes(action as BrokerAction)) {
    console.error(chalk.yellow(`\n[!] Unknown action: ${action}`));
    console.log(chalk.gray(`  Valid actions: ${VALID_BROKER_ACTIONS.join(', ')}`));
    console.log(chalk.gray(`  Showing status instead...\n`));
    return brokerStatusCommand(options);
  }
  
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
        console.log(chalk.gray(`  Valid types: pre-commit, pre-push\n`));
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
    
    case undefined:
    default:
      // No action provided - show status
      return brokerStatusCommand(options);
  }
}

