import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn, execSync } from 'child_process';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';

interface DaemonOptions {
  hub: string;
  proxy?: boolean;
  proxyPort?: number;
  config?: string;
  replace?: boolean;
}

const SERVICE_NAME = 'co.privateconnect.agent';
const DAEMON_LOG_FILE = 'daemon.log';
const DAEMON_PID_FILE = 'daemon.pid';

function getPidPath(): string {
  return path.join(getConfigDir(), DAEMON_PID_FILE);
}

function getLogPath(): string {
  return path.join(getConfigDir(), DAEMON_LOG_FILE);
}

function isRunning(): { running: boolean; pid?: number } {
  const pidPath = getPidPath();
  
  if (!fs.existsSync(pidPath)) {
    return { running: false };
  }
  
  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    
    // Check if process is actually running
    process.kill(pid, 0); // Throws if process doesn't exist
    return { running: true, pid };
  } catch {
    // Process not running, clean up stale PID file
    try {
      fs.unlinkSync(pidPath);
    } catch {
      // Ignore
    }
    return { running: false };
  }
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

async function installLaunchd(connectPath: string, hubUrl: string, options: DaemonOptions) {
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

async function installSystemd(connectPath: string, hubUrl: string, options: DaemonOptions) {
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
  
  const { running, pid: existingPid } = isRunning();
  if (running) {
    if (options.replace) {
      console.log(chalk.yellow(`[!] Killing existing daemon (PID ${existingPid})...`));
      if (existingPid) {
        try {
          process.kill(existingPid, 'SIGTERM');
          // Wait for graceful shutdown
          for (let i = 0; i < 10; i++) {
            await new Promise(resolve => setTimeout(resolve, 500));
            const { running: stillRunning } = isRunning();
            if (!stillRunning) break;
          }
          // Force kill if still running
          const { running: stillRunning } = isRunning();
          if (stillRunning) {
            process.kill(existingPid, 'SIGKILL');
          }
          console.log(chalk.green('[ok] Existing daemon stopped'));
        } catch (error) {
          console.log(chalk.yellow('  Existing process may have already exited'));
        }
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
    fs.mkdirSync(configDir, { recursive: true });
  }

  const logStream = fs.openSync(logPath, 'a');
  
  const child = spawn(process.execPath, [process.argv[1], 'up', '--hub', hubUrl], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    env: { ...process.env, CONNECT_DAEMON: '1' },
  });

  child.unref();
  
  // Save PID
  fs.writeFileSync(pidPath, child.pid?.toString() || '');
  
  console.log(chalk.green(`[ok] Daemon started (PID: ${child.pid})`));
  console.log(chalk.gray(`  Logs: ${logPath}\n`));
}

/**
 * Stop daemon
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
      } catch {
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
      } catch {
        // Fall through to PID-based stop
      }
    }
  }

  // PID-based stop
  const { running, pid } = isRunning();
  
  if (!running) {
    console.log(chalk.yellow('\n[!] Daemon is not running\n'));
    return;
  }

  try {
    process.kill(pid!, 'SIGTERM');
    
    // Wait for process to exit
    let attempts = 0;
    while (attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const { running: stillRunning } = isRunning();
      if (!stillRunning) break;
      attempts++;
    }
    
    // Force kill if still running
    const { running: stillRunning } = isRunning();
    if (stillRunning) {
      process.kill(pid!, 'SIGKILL');
    }
    
    // Clean up PID file
    const pidPath = getPidPath();
    if (fs.existsSync(pidPath)) {
      fs.unlinkSync(pidPath);
    }
    
    console.log(chalk.green('\n[ok] Daemon stopped\n'));
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Failed to stop daemon: ${err.message}\n`));
  }
}

/**
 * Show daemon status
 */
async function statusDaemon() {
  const platform = os.platform();
  const config = loadConfig();
  
  console.log(chalk.cyan('\n📊 Private Connect Daemon Status\n'));

  // Check if service is installed
  let serviceInstalled = false;
  let serviceRunning = false;
  
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

  // Check PID file fallback
  const { running: pidRunning, pid } = isRunning();

  // Display status
  const isRunningNow = serviceRunning || pidRunning;
  
  if (isRunningNow) {
    console.log(chalk.green('  ● Status: running'));
    if (pid) {
      console.log(chalk.gray(`    PID: ${pid}`));
    }
  } else {
    console.log(chalk.red('  ○ Status: stopped'));
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
 */
async function showLogs() {
  const logPath = getLogPath();
  
  if (!fs.existsSync(logPath)) {
    console.log(chalk.gray('\n  No logs yet.\n'));
    return;
  }

  console.log(chalk.cyan(`\n📋 Daemon Logs (${logPath})\n`));
  console.log(chalk.gray('─'.repeat(60)));
  
  // Read last 50 lines
  try {
    const content = fs.readFileSync(logPath, 'utf-8');
    const lines = content.trim().split('\n');
    const lastLines = lines.slice(-50);
    
    lastLines.forEach(line => {
      if (line.includes('[ok]') || line.includes('Connected')) {
        console.log(chalk.green(line));
      } else if (line.includes('[x]') || line.includes('error') || line.includes('Error')) {
        console.log(chalk.red(line));
      } else if (line.includes('[!]') || line.includes('warning')) {
        console.log(chalk.yellow(line));
      } else {
        console.log(chalk.gray(line));
      }
    });
    
    console.log(chalk.gray('─'.repeat(60)));
    console.log(chalk.gray(`\n  Showing last ${lastLines.length} lines. Full log: ${logPath}\n`));
  } catch (error) {
    const err = error as Error;
    console.error(chalk.red(`\n[x] Error reading logs: ${err.message}\n`));
  }
}

