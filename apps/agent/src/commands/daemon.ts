import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync, ChildProcess } from 'child_process';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';

interface DaemonOptions {
  hub: string;
  proxy?: boolean;
  proxyPort?: number;
  config?: string;
  replace?: boolean;
}

interface DaemonStatus {
  running: boolean;
  pid?: number;
  stale?: boolean;  // PID file exists but process is not running
  error?: string;   // Error while checking status
}

const SERVICE_NAME = 'co.privateconnect.agent';
const DAEMON_LOG_FILE = 'daemon.log';
const DAEMON_PID_FILE = 'daemon.pid';

// Startup verification timeout (ms)
const SPAWN_VERIFY_TIMEOUT = 3000;
const SPAWN_VERIFY_INTERVAL = 100;

function getPidPath(): string {
  return path.join(getConfigDir(), DAEMON_PID_FILE);
}

function getLogPath(): string {
  return path.join(getConfigDir(), DAEMON_LOG_FILE);
}

/**
 * Validate a PID value
 */
function isValidPid(pid: number): boolean {
  return Number.isInteger(pid) && pid > 0 && pid < 4194304; // Linux max PID
}

/**
 * Check if a process with the given PID is running
 * Uses signal 0 to test process existence
 */
function isProcessRunning(pid: number): boolean {
  if (!isValidPid(pid)) return false;
  
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    // EPERM means process exists but we don't have permission to signal it
    return error.code === 'EPERM';
  }
}

/**
 * Check if daemon is running
 * 
 * IMPROVEMENT: Handles race conditions by:
 * 1. Reading PID atomically
 * 2. Validating PID format
 * 3. Verifying process existence
 * 4. Cleaning up stale PID files atomically
 */
function isRunning(): DaemonStatus {
  const pidPath = getPidPath();
  
  // Try to read PID file
  let pidContent: string;
  try {
    pidContent = fs.readFileSync(pidPath, 'utf-8').trim();
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      return { running: false };
    }
    // Other errors (permission, etc.)
    return { running: false, error: `Failed to read PID file: ${error.message}` };
  }
  
  // Parse and validate PID
  const pid = parseInt(pidContent, 10);
  if (isNaN(pid) || !isValidPid(pid)) {
    // Invalid PID file, clean it up
    cleanupPidFile(pidPath);
    return { running: false, stale: true };
  }
  
  // Check if process is actually running
  if (isProcessRunning(pid)) {
    return { running: true, pid };
  }
  
  // Process not running, clean up stale PID file
  cleanupPidFile(pidPath);
  return { running: false, stale: true };
}

/**
 * Safely clean up a stale PID file
 */
function cleanupPidFile(pidPath: string): void {
  try {
    fs.unlinkSync(pidPath);
  } catch {
    // Ignore - file may have been removed by another process
  }
}

/**
 * Wait for a spawned process to be verified running
 */
async function verifyProcessStarted(
  child: ChildProcess, 
  _pidPath: string
): Promise<{ success: boolean; error?: string }> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    // Set up error handler
    const errorHandler = (err: Error) => {
      resolve({ success: false, error: err.message });
    };
    
    const exitHandler = (code: number | null) => {
      resolve({ success: false, error: `Process exited with code ${code}` });
    };
    
    child.once('error', errorHandler);
    child.once('exit', exitHandler);
    
    // Poll to verify process is still running
    const checkInterval = setInterval(() => {
      if (Date.now() - startTime > SPAWN_VERIFY_TIMEOUT) {
        clearInterval(checkInterval);
        child.off('error', errorHandler);
        child.off('exit', exitHandler);
        
        // Final check - is it still running?
        if (child.pid && isProcessRunning(child.pid)) {
          resolve({ success: true });
        } else {
          resolve({ success: false, error: 'Process failed to start' });
        }
        return;
      }
      
      // Check if process is still running
      if (child.pid && isProcessRunning(child.pid)) {
        // Still running, continue checking until timeout
      }
    }, SPAWN_VERIFY_INTERVAL);
    
    // If process has already exited before we set up handlers
    if (child.exitCode !== null) {
      clearInterval(checkInterval);
      resolve({ success: false, error: `Process exited with code ${child.exitCode}` });
    }
  });
}

function getLaunchdPlistPath(): string {
  return path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_NAME}.plist`);
}

function getSystemdServicePath(): string {
  const configDir = path.join(os.homedir(), '.config', 'systemd', 'user');
  return path.join(configDir, 'private-connect.service');
}

function getConnectBinaryPath(): string {
  // Try to find the connect binary
  try {
    const which = execSync('which connect', { encoding: 'utf-8' }).trim();
    if (which) return which;
  } catch {
    // Fall back to common locations
  }
  
  // Check common install locations
  const locations = [
    '/usr/local/bin/connect',
    path.join(os.homedir(), '.local', 'bin', 'connect'),
    path.join(os.homedir(), 'bin', 'connect'),
  ];
  
  for (const loc of locations) {
    if (fs.existsSync(loc)) {
      return loc;
    }
  }
  
  // Return current process path as fallback
  return process.argv[1];
}

/**
 * Main daemon command dispatcher
 */
export async function daemonCommand(action: string | undefined, options: DaemonOptions) {
  switch (action) {
    case 'install':
      return installDaemon(options);
    case 'uninstall':
      return uninstallDaemon();
    case 'start':
      return startDaemon(options);
    case 'stop':
      return stopDaemon();
    case 'restart':
      await stopDaemon();
      return startDaemon(options);
    case 'status':
      return statusDaemon();
    case 'logs':
      return showLogs();
    default:
      return statusDaemon();
  }
}

/**
 * Install daemon as a system service
 */
async function installDaemon(options: DaemonOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const platform = os.platform();
  const connectPath = getConnectBinaryPath();
  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.cyan('\n🔧 Installing Private Connect daemon...\n'));

  if (platform === 'darwin') {
    await installLaunchd(connectPath, hubUrl, options);
  } else if (platform === 'linux') {
    await installSystemd(connectPath, hubUrl, options);
  } else {
    console.error(chalk.red(`[x] Unsupported platform: ${platform}`));
    console.log(chalk.gray('  Daemon mode is supported on macOS and Linux.\n'));
    process.exit(1);
  }
}

async function installLaunchd(connectPath: string, hubUrl: string, _options: DaemonOptions) {
  const plistPath = getLaunchdPlistPath();
  const logPath = getLogPath();
  
  // Build arguments
  const args = ['up', '--hub', hubUrl];
  
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${connectPath}</string>
        ${args.map(a => `<string>${a}</string>`).join('\n        ')}
    </array>
    
    <key>RunAtLoad</key>
    <true/>
    
    <key>KeepAlive</key>
    <dict>
        <key>SuccessfulExit</key>
        <false/>
        <key>NetworkState</key>
        <true/>
    </dict>
    
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
    
    <key>ThrottleInterval</key>
    <integer>10</integer>
    
    <key>EnvironmentVariables</key>
    <dict>
        <key>PATH</key>
        <string>/usr/local/bin:/usr/bin:/bin:/opt/homebrew/bin</string>
    </dict>
</dict>
</plist>`;

  // Ensure LaunchAgents directory exists
  const launchAgentsDir = path.dirname(plistPath);
  if (!fs.existsSync(launchAgentsDir)) {
    fs.mkdirSync(launchAgentsDir, { recursive: true });
  }

  // Write plist
  fs.writeFileSync(plistPath, plist);
  console.log(chalk.gray(`  Created: ${plistPath}`));

  // Load the service
  try {
    execSync(`launchctl unload ${plistPath} 2>/dev/null || true`);
    execSync(`launchctl load ${plistPath}`);
    console.log(chalk.green('\n[ok] Daemon installed and started'));
    console.log(chalk.gray('  The agent will now start automatically on login.\n'));
    
    console.log(chalk.white('  Commands:'));
    console.log(chalk.gray(`    Status:    ${chalk.cyan('connect daemon status')}`));
    console.log(chalk.gray(`    Logs:      ${chalk.cyan('connect daemon logs')}`));
    console.log(chalk.gray(`    Stop:      ${chalk.cyan('connect daemon stop')}`));
    console.log(chalk.gray(`    Uninstall: ${chalk.cyan('connect daemon uninstall')}`));
    console.log();
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Failed to load service: ${err.message}`));
    process.exit(1);
  }
}

async function installSystemd(connectPath: string, hubUrl: string, _options: DaemonOptions) {
  const servicePath = getSystemdServicePath();
  const logPath = getLogPath();
  
  // Build command
  const execStart = `${connectPath} up --hub ${hubUrl}`;
  
  const serviceUnit = `[Unit]
Description=Private Connect Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${execStart}
Restart=always
RestartSec=10
StandardOutput=append:${logPath}
StandardError=append:${logPath}
Environment=PATH=/usr/local/bin:/usr/bin:/bin

[Install]
WantedBy=default.target
`;

  // Ensure systemd user directory exists
  const systemdDir = path.dirname(servicePath);
  if (!fs.existsSync(systemdDir)) {
    fs.mkdirSync(systemdDir, { recursive: true });
  }

  // Write service file
  fs.writeFileSync(servicePath, serviceUnit);
  console.log(chalk.gray(`  Created: ${servicePath}`));

  // Enable and start the service
  try {
    execSync('systemctl --user daemon-reload');
    execSync('systemctl --user enable private-connect.service');
    execSync('systemctl --user start private-connect.service');
    
    // Enable lingering so service runs without login
    try {
      execSync(`loginctl enable-linger ${os.userInfo().username}`);
    } catch {
      console.log(chalk.yellow('  [!] Could not enable lingering. Service may stop on logout.'));
    }
    
    console.log(chalk.green('\n[ok] Daemon installed and started'));
    console.log(chalk.gray('  The agent will now start automatically on boot.\n'));
    
    console.log(chalk.white('  Commands:'));
    console.log(chalk.gray(`    Status:    ${chalk.cyan('connect daemon status')}`));
    console.log(chalk.gray(`    Logs:      ${chalk.cyan('connect daemon logs')}`));
    console.log(chalk.gray(`    Stop:      ${chalk.cyan('connect daemon stop')}`));
    console.log(chalk.gray(`    Uninstall: ${chalk.cyan('connect daemon uninstall')}`));
    console.log();
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Failed to enable service: ${err.message}`));
    process.exit(1);
  }
}

/**
 * Uninstall daemon from system
 */
async function uninstallDaemon() {
  const platform = os.platform();
  
  console.log(chalk.cyan('\n🔧 Uninstalling Private Connect daemon...\n'));

  if (platform === 'darwin') {
    const plistPath = getLaunchdPlistPath();
    
    try {
      execSync(`launchctl unload ${plistPath} 2>/dev/null || true`);
    } catch {
      // Ignore
    }
    
    if (fs.existsSync(plistPath)) {
      fs.unlinkSync(plistPath);
      console.log(chalk.gray(`  Removed: ${plistPath}`));
    }
    
    console.log(chalk.green('\n[ok] Daemon uninstalled\n'));
    
  } else if (platform === 'linux') {
    const servicePath = getSystemdServicePath();
    
    try {
      execSync('systemctl --user stop private-connect.service 2>/dev/null || true');
      execSync('systemctl --user disable private-connect.service 2>/dev/null || true');
    } catch {
      // Ignore
    }
    
    if (fs.existsSync(servicePath)) {
      fs.unlinkSync(servicePath);
      console.log(chalk.gray(`  Removed: ${servicePath}`));
    }
    
    try {
      execSync('systemctl --user daemon-reload');
    } catch {
      // Ignore
    }
    
    console.log(chalk.green('\n[ok] Daemon uninstalled\n'));
    
  } else {
    console.error(chalk.red(`[x] Unsupported platform: ${platform}`));
    process.exit(1);
  }
}

/**
 * Start daemon (foreground fallback if service not installed)
 * 
 * IMPROVEMENT: Adds proper error handling for spawn and verifies
 * the process actually started successfully.
 */
async function startDaemon(options: DaemonOptions) {
  const platform = os.platform();
  
  // Check if service is installed
  if (platform === 'darwin') {
    const plistPath = getLaunchdPlistPath();
    if (fs.existsSync(plistPath)) {
      try {
        execSync(`launchctl start ${SERVICE_NAME}`);
        console.log(chalk.green('\n[ok] Daemon started\n'));
        return;
      } catch (error) {
        const err = error as Error;
        console.error(chalk.red(`\n[x] Failed to start: ${err.message}`));
        process.exit(1);
      }
    }
  } else if (platform === 'linux') {
    const servicePath = getSystemdServicePath();
    if (fs.existsSync(servicePath)) {
      try {
        execSync('systemctl --user start private-connect.service');
        console.log(chalk.green('\n[ok] Daemon started\n'));
        return;
      } catch (error) {
        const err = error as Error;
        console.error(chalk.red(`\n[x] Failed to start: ${err.message}`));
        process.exit(1);
      }
    }
  }

  // Fallback: start in background using spawn
  console.log(chalk.cyan('\n🚀 Starting daemon in background...\n'));
  
  const status = isRunning();
  if (status.error) {
    console.error(chalk.yellow(`[!] Warning: ${status.error}`));
  }
  
  if (status.running && status.pid) {
    if (options.replace) {
      console.log(chalk.yellow(`[!] Stopping existing daemon (PID ${status.pid})...`));
      const stopResult = await gracefullyStopProcess(status.pid);
      if (stopResult.success) {
        console.log(chalk.green('[ok] Existing daemon stopped'));
      } else {
        console.log(chalk.yellow(`  Warning: ${stopResult.error || 'Could not verify process stopped'}`));
      }
    } else {
      console.log(chalk.yellow('[!] Daemon is already running'));
      console.log(chalk.gray(`  Use ${chalk.cyan('connect daemon status')} for details.`));
      console.log(chalk.gray(`  Or use ${chalk.cyan('connect daemon start --replace')} to restart.\n`));
      return;
    }
  }

  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first.\n`));
    process.exit(1);
  }

  const logPath = getLogPath();
  const pidPath = getPidPath();
  const hubUrl = config.hubUrl || options.hub;
  
  // Ensure config dir exists
  const configDir = getConfigDir();
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }

  // Open log file for writing
  let logStream: number;
  try {
    logStream = fs.openSync(logPath, 'a');
  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`[x] Failed to open log file: ${error.message}`));
    process.exit(1);
  }
  
  // Spawn the daemon process
  let child: ChildProcess;
  try {
    child = spawn(process.execPath, [process.argv[1], 'up', '--hub', hubUrl], {
      detached: true,
      stdio: ['ignore', logStream, logStream],
      env: { ...process.env, CONNECT_DAEMON: '1' },
    });
  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`[x] Failed to spawn daemon: ${error.message}`));
    fs.closeSync(logStream);
    process.exit(1);
  }
  
  // Handle spawn errors
  child.on('error', (err) => {
    console.error(chalk.red(`[x] Daemon error: ${err.message}`));
  });

  // Verify the process started successfully
  if (!child.pid) {
    console.error(chalk.red('[x] Failed to spawn daemon: no PID returned'));
    fs.closeSync(logStream);
    process.exit(1);
  }
  
  // Save PID first to ensure we can track the process
  try {
    fs.writeFileSync(pidPath, child.pid.toString(), { mode: 0o600 });
  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`[x] Failed to write PID file: ${error.message}`));
    // Try to kill the orphaned process
    try {
      process.kill(child.pid, 'SIGTERM');
    } catch {
      // Ignore
    }
    fs.closeSync(logStream);
    process.exit(1);
  }
  
  // Verify the daemon is actually running
  const verifyResult = await verifyProcessStarted(child, pidPath);
  
  child.unref();
  fs.closeSync(logStream);
  
  if (!verifyResult.success) {
    console.error(chalk.red(`[x] Daemon failed to start: ${verifyResult.error}`));
    console.log(chalk.gray(`  Check logs: ${logPath}\n`));
    // Clean up PID file
    cleanupPidFile(pidPath);
    process.exit(1);
  }
  
  console.log(chalk.green(`[ok] Daemon started (PID: ${child.pid})`));
  console.log(chalk.gray(`  Logs: ${logPath}\n`));
}

/**
 * Gracefully stop a process with SIGTERM, then SIGKILL if needed
 */
async function gracefullyStopProcess(pid: number): Promise<{ success: boolean; error?: string }> {
  if (!isValidPid(pid)) {
    return { success: false, error: 'Invalid PID' };
  }
  
  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ESRCH') {
      // Process already gone
      return { success: true };
    }
    return { success: false, error: error.message };
  }
  
  // Wait for graceful shutdown
  for (let i = 0; i < 10; i++) {
    await new Promise(resolve => setTimeout(resolve, 500));
    if (!isProcessRunning(pid)) {
      return { success: true };
    }
  }
  
  // Force kill if still running
  if (isProcessRunning(pid)) {
    try {
      process.kill(pid, 'SIGKILL');
      // Wait a bit for force kill to take effect
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (err) {
      const error = err as NodeJS.ErrnoException;
      if (error.code !== 'ESRCH') {
        return { success: false, error: `Failed to force kill: ${error.message}` };
      }
    }
  }
  
  return { success: !isProcessRunning(pid) };
}

/**
 * Stop daemon
 * 
 * IMPROVEMENT: Adds comprehensive error handling for all failure modes
 */
async function stopDaemon() {
  const platform = os.platform();
  
  // Try system service first
  if (platform === 'darwin') {
    const plistPath = getLaunchdPlistPath();
    if (fs.existsSync(plistPath)) {
      try {
        execSync(`launchctl stop ${SERVICE_NAME}`);
        console.log(chalk.green('\n[ok] Daemon stopped\n'));
        return;
      } catch (err) {
        const error = err as Error;
        console.log(chalk.gray(`  launchctl stop failed: ${error.message}`));
        console.log(chalk.gray('  Trying PID-based stop...'));
        // Fall through to PID-based stop
      }
    }
  } else if (platform === 'linux') {
    const servicePath = getSystemdServicePath();
    if (fs.existsSync(servicePath)) {
      try {
        execSync('systemctl --user stop private-connect.service');
        console.log(chalk.green('\n[ok] Daemon stopped\n'));
        return;
      } catch (err) {
        const error = err as Error;
        console.log(chalk.gray(`  systemctl stop failed: ${error.message}`));
        console.log(chalk.gray('  Trying PID-based stop...'));
        // Fall through to PID-based stop
      }
    }
  }

  // PID-based stop
  const status = isRunning();
  
  if (status.error) {
    console.error(chalk.yellow(`\n[!] Warning: ${status.error}`));
  }
  
  if (!status.running) {
    if (status.stale) {
      console.log(chalk.yellow('\n[!] Daemon was not running (cleaned up stale PID file)\n'));
    } else {
      console.log(chalk.yellow('\n[!] Daemon is not running\n'));
    }
    return;
  }

  if (!status.pid) {
    console.error(chalk.red('\n[x] Daemon appears running but no PID available\n'));
    return;
  }

  const stopResult = await gracefullyStopProcess(status.pid);
  
  // Clean up PID file regardless
  const pidPath = getPidPath();
  cleanupPidFile(pidPath);
  
  if (stopResult.success) {
    console.log(chalk.green('\n[ok] Daemon stopped\n'));
  } else {
    console.error(chalk.red(`\n[x] Failed to stop daemon: ${stopResult.error}\n`));
    process.exit(1);
  }
}

/**
 * Show daemon status
 * 
 * IMPROVEMENT: Adds error handling for config loading and service checks
 */
async function statusDaemon() {
  const platform = os.platform();
  
  // Load config with error handling
  let config;
  try {
    config = loadConfig();
  } catch (err) {
    const error = err as Error;
    console.log(chalk.cyan('\n📊 Private Connect Daemon Status\n'));
    console.error(chalk.red(`  [x] Failed to load config: ${error.message}\n`));
    return;
  }
  
  console.log(chalk.cyan('\n📊 Private Connect Daemon Status\n'));

  // Check if service is installed
  let serviceInstalled = false;
  let serviceRunning = false;
  let serviceError: string | undefined;
  
  try {
    if (platform === 'darwin') {
      const plistPath = getLaunchdPlistPath();
      serviceInstalled = fs.existsSync(plistPath);
      
      if (serviceInstalled) {
        try {
          const output = execSync(`launchctl list | grep ${SERVICE_NAME}`, { encoding: 'utf-8' });
          serviceRunning = !output.includes('-');
        } catch {
          serviceRunning = false;
        }
      }
    } else if (platform === 'linux') {
      const servicePath = getSystemdServicePath();
      serviceInstalled = fs.existsSync(servicePath);
      
      if (serviceInstalled) {
        try {
          execSync('systemctl --user is-active private-connect.service', { stdio: 'ignore' });
          serviceRunning = true;
        } catch {
          serviceRunning = false;
        }
      }
    }
  } catch (err) {
    const error = err as Error;
    serviceError = error.message;
  }

  // Check PID file fallback
  const status = isRunning();
  
  // Display status
  const isRunningNow = serviceRunning || status.running;
  
  if (isRunningNow) {
    console.log(chalk.green('  ● Status: running'));
    if (status.pid) {
      console.log(chalk.gray(`    PID: ${status.pid}`));
    }
  } else {
    console.log(chalk.red('  ○ Status: stopped'));
    if (status.stale) {
      console.log(chalk.yellow('    (cleaned up stale PID file)'));
    }
  }
  
  if (status.error) {
    console.log(chalk.yellow(`    Warning: ${status.error}`));
  }
  if (serviceError) {
    console.log(chalk.yellow(`    Service check error: ${serviceError}`));
  }
  
  console.log(chalk.gray(`    Service installed: ${serviceInstalled ? 'yes' : 'no'}`));
  console.log(chalk.gray(`    Platform: ${platform}`));
  
  if (config) {
    console.log(chalk.gray(`    Agent ID: ${config.agentId}`));
    console.log(chalk.gray(`    Label: ${config.label}`));
    console.log(chalk.gray(`    Hub: ${config.hubUrl}`));
  } else {
    console.log(chalk.yellow('\n  [!] Not configured. Run: connect up'));
  }

  console.log();
  
  if (!isRunningNow) {
    if (serviceInstalled) {
      console.log(chalk.gray(`  Start with: ${chalk.cyan('connect daemon start')}`));
    } else {
      console.log(chalk.gray(`  Install with: ${chalk.cyan('connect daemon install')}`));
    }
    console.log();
  }
}

/**
 * Show daemon logs
 * 
 * IMPROVEMENT: Handles concurrent access and partial reads gracefully
 */
async function showLogs() {
  const logPath = getLogPath();
  
  // Check if log file exists
  try {
    const stat = fs.statSync(logPath);
    if (!stat.isFile()) {
      console.log(chalk.gray('\n  Log path is not a file.\n'));
      return;
    }
    if (stat.size === 0) {
      console.log(chalk.gray('\n  Log file is empty.\n'));
      return;
    }
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'ENOENT') {
      console.log(chalk.gray('\n  No logs yet.\n'));
    } else {
      console.error(chalk.red(`\n[x] Cannot access log file: ${error.message}\n`));
    }
    return;
  }

  console.log(chalk.cyan(`\n📋 Daemon Logs (${logPath})\n`));
  console.log(chalk.gray('─'.repeat(60)));
  
  // Read log file with retry for concurrent access
  const MAX_READ_RETRIES = 3;
  let content: string | undefined;
  let lastError: Error | undefined;
  
  for (let attempt = 0; attempt < MAX_READ_RETRIES; attempt++) {
    try {
      // Use non-blocking read to handle concurrent writes
      content = fs.readFileSync(logPath, 'utf-8');
      break;
    } catch (err) {
      lastError = err as Error;
      const error = err as NodeJS.ErrnoException;
      
      if (error.code === 'EBUSY' || error.code === 'EAGAIN') {
        // File is being written to, wait and retry
        await new Promise(resolve => setTimeout(resolve, 100));
        continue;
      }
      // Other error, don't retry
      break;
    }
  }
  
  if (content === undefined) {
    console.error(chalk.red(`\n[x] Error reading logs: ${lastError?.message || 'Unknown error'}\n`));
    return;
  }
  
  // Parse and display lines
  try {
    const lines = content.split('\n').filter(line => line.length > 0);
    const lastLines = lines.slice(-50);
    
    if (lastLines.length === 0) {
      console.log(chalk.gray('  (no log entries)'));
    } else {
      lastLines.forEach(line => {
        // Truncate very long lines to prevent terminal flooding
        const displayLine = line.length > 200 ? line.substring(0, 197) + '...' : line;
        
        if (displayLine.includes('[ok]') || displayLine.includes('Connected')) {
          console.log(chalk.green(displayLine));
        } else if (displayLine.includes('[x]') || displayLine.includes('error') || displayLine.includes('Error')) {
          console.log(chalk.red(displayLine));
        } else if (displayLine.includes('[!]') || displayLine.includes('warning')) {
          console.log(chalk.yellow(displayLine));
        } else {
          console.log(chalk.gray(displayLine));
        }
      });
    }
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(`\n  Showing last ${lastLines.length} lines. Full log: ${logPath}\n`));
  } catch (err) {
    const error = err as Error;
    console.error(chalk.red(`\n[x] Error parsing logs: ${error.message}\n`));
  }
}

