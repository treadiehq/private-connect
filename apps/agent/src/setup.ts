/**
 * Zero-Touch Setup Module
 * 
 * Handles automatic daemon installation and DNS setup after first authentication.
 * This enables the "primitive" experience where things just work after initial setup.
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';
import chalk from 'chalk';
import { getConfigDir } from './config';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SetupStatus {
  daemonInstalled: boolean;
  daemonRunning: boolean;
  dnsInstalled: boolean;
  dnsWorking: boolean;
}

export interface SetupOptions {
  skipDaemon?: boolean;
  skipDns?: boolean;
  silent?: boolean;
  hubUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SERVICE_NAME = 'co.privateconnect.agent';
const SETUP_MARKER_FILE = 'setup-complete';

// ─────────────────────────────────────────────────────────────────────────────
// Setup State
// ─────────────────────────────────────────────────────────────────────────────

function getSetupMarkerPath(): string {
  return path.join(getConfigDir(), SETUP_MARKER_FILE);
}

/**
 * Check if zero-touch setup has been completed
 */
export function isSetupComplete(): boolean {
  return fs.existsSync(getSetupMarkerPath());
}

/**
 * Mark setup as complete
 */
function markSetupComplete(): void {
  const markerPath = getSetupMarkerPath();
  const configDir = getConfigDir();
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true, mode: 0o700 });
  }
  
  fs.writeFileSync(markerPath, new Date().toISOString(), { mode: 0o600 });
}

// ─────────────────────────────────────────────────────────────────────────────
// Daemon Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if daemon is installed as a system service
 */
export function isDaemonInstalled(): boolean {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_NAME}.plist`);
    return fs.existsSync(plistPath);
  } else if (platform === 'linux') {
    const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'private-connect.service');
    return fs.existsSync(servicePath);
  }
  
  return false;
}

/**
 * Install daemon silently (for zero-touch setup)
 */
export async function installDaemonSilently(hubUrl: string): Promise<{ success: boolean; error?: string }> {
  const platform = os.platform();
  
  if (platform !== 'darwin' && platform !== 'linux') {
    return { success: false, error: 'Unsupported platform' };
  }
  
  const connectPath = getConnectBinaryPath();
  
  try {
    if (platform === 'darwin') {
      return await installLaunchdSilent(connectPath, hubUrl);
    } else {
      return await installSystemdSilent(connectPath, hubUrl);
    }
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

async function installLaunchdSilent(connectPath: string, hubUrl: string): Promise<{ success: boolean; error?: string }> {
  const plistPath = path.join(os.homedir(), 'Library', 'LaunchAgents', `${SERVICE_NAME}.plist`);
  const logPath = path.join(getConfigDir(), 'daemon.log');
  
  const plist = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${SERVICE_NAME}</string>
    
    <key>ProgramArguments</key>
    <array>
        <string>${connectPath}</string>
        <string>up</string>
        <string>--hub</string>
        <string>${hubUrl}</string>
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
        <key>CONNECT_DAEMON</key>
        <string>1</string>
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

  // Load the service
  try {
    execSync(`launchctl unload ${plistPath} 2>/dev/null || true`, { stdio: 'ignore' });
    execSync(`launchctl load ${plistPath}`, { stdio: 'ignore' });
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

async function installSystemdSilent(connectPath: string, hubUrl: string): Promise<{ success: boolean; error?: string }> {
  const servicePath = path.join(os.homedir(), '.config', 'systemd', 'user', 'private-connect.service');
  const logPath = path.join(getConfigDir(), 'daemon.log');
  
  const serviceUnit = `[Unit]
Description=Private Connect Agent
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${connectPath} up --hub ${hubUrl}
Restart=always
RestartSec=10
StandardOutput=append:${logPath}
StandardError=append:${logPath}
Environment=PATH=/usr/local/bin:/usr/bin:/bin
Environment=CONNECT_DAEMON=1

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

  // Enable and start the service
  try {
    execSync('systemctl --user daemon-reload', { stdio: 'ignore' });
    execSync('systemctl --user enable private-connect.service', { stdio: 'ignore' });
    execSync('systemctl --user start private-connect.service', { stdio: 'ignore' });
    
    // Try to enable lingering
    try {
      execSync(`loginctl enable-linger ${os.userInfo().username}`, { stdio: 'ignore' });
    } catch {
      // Ignore - not critical
    }
    
    return { success: true };
  } catch (err) {
    const error = err as Error;
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// DNS Setup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if DNS resolver is installed
 */
export function isDnsInstalled(): boolean {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    return fs.existsSync('/etc/resolver/connect');
  } else if (platform === 'linux') {
    // Check /etc/hosts for *.connect entries
    try {
      const hosts = fs.readFileSync('/etc/hosts', 'utf-8');
      return hosts.includes('.connect');
    } catch {
      return false;
    }
  }
  
  return false;
}

/**
 * Install DNS resolver silently (may require sudo)
 * Returns true if successful, false if sudo is needed
 */
export async function installDnsSilently(): Promise<{ success: boolean; needsSudo?: boolean; error?: string }> {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    return await installMacOsDns();
  } else if (platform === 'linux') {
    // Linux typically requires sudo for /etc modifications
    return { success: false, needsSudo: true, error: 'Linux DNS setup requires sudo' };
  }
  
  return { success: false, error: 'Unsupported platform' };
}

async function installMacOsDns(): Promise<{ success: boolean; needsSudo?: boolean; error?: string }> {
  const resolverDir = '/etc/resolver';
  const resolverPath = '/etc/resolver/connect';
  
  // Check if we can write without sudo (unlikely but possible)
  try {
    // Check if resolver directory exists and is writable
    if (!fs.existsSync(resolverDir)) {
      // Need sudo to create /etc/resolver
      return { success: false, needsSudo: true };
    }
    
    // Try to write the resolver file
    fs.writeFileSync(resolverPath, 'nameserver 127.0.0.1\nport 15353\n');
    return { success: true };
  } catch (err) {
    const error = err as NodeJS.ErrnoException;
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      return { success: false, needsSudo: true };
    }
    return { success: false, error: error.message };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Setup Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run zero-touch setup after first authentication
 * This is called automatically after successful device auth
 */
export async function runZeroTouchSetup(options: SetupOptions): Promise<void> {
  // Skip if already set up
  if (isSetupComplete()) {
    return;
  }
  
  const log = (msg: string) => {
    if (!options.silent) console.log(msg);
  };
  
  log('');
  log(chalk.cyan('✨ Setting up Private Connect for first use...\n'));
  
  // 1. Install daemon (auto-start on boot)
  if (!options.skipDaemon && !isDaemonInstalled()) {
    log(chalk.gray('  Installing background service...'));
    
    const result = await installDaemonSilently(options.hubUrl);
    
    if (result.success) {
      log(chalk.green('  [ok] Agent will start automatically on login'));
    } else {
      log(chalk.yellow(`  [!] Could not install daemon: ${result.error}`));
      log(chalk.gray('      Run `connect daemon install` later to enable auto-start'));
    }
  } else if (isDaemonInstalled()) {
    log(chalk.gray('  Background service already installed'));
  }
  
  // 2. Set up DNS (*.connect domains)
  if (!options.skipDns && !isDnsInstalled()) {
    log(chalk.gray('  Setting up local DNS...'));
    
    const result = await installDnsSilently();
    
    if (result.success) {
      log(chalk.green('  [ok] Services available at *.connect'));
    } else if (result.needsSudo) {
      log(chalk.yellow('  [!] DNS setup needs sudo. Run later:'));
      log(chalk.cyan('      sudo connect dns install'));
    } else {
      log(chalk.yellow(`  [!] DNS setup failed: ${result.error}`));
    }
  } else if (isDnsInstalled()) {
    log(chalk.gray('  Local DNS already configured'));
  }
  
  // Mark setup as complete
  markSetupComplete();
  
  log('');
  log(chalk.green.bold('  [ok] Setup complete!\n'));
  log(chalk.gray('  You\'re ready to go. Quick commands:\n'));
  log(chalk.cyan('    connect localhost:5432') + chalk.gray('    # Expose a service'));
  log(chalk.cyan('    connect prod-db') + chalk.gray('           # Connect to a service'));
  log(chalk.cyan('    connect clone alice') + chalk.gray('       # Clone teammate\'s env'));
  log('');
}

/**
 * Check current setup status
 */
export function getSetupStatus(): SetupStatus {
  return {
    daemonInstalled: isDaemonInstalled(),
    daemonRunning: isDaemonRunning(),
    dnsInstalled: isDnsInstalled(),
    dnsWorking: isDnsWorking(),
  };
}

function isDaemonRunning(): boolean {
  const platform = os.platform();
  
  if (platform === 'darwin') {
    try {
      const output = execSync(`launchctl list | grep ${SERVICE_NAME}`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'ignore'] });
      return !output.includes('-');
    } catch {
      return false;
    }
  } else if (platform === 'linux') {
    try {
      execSync('systemctl --user is-active private-connect.service', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }
  
  return false;
}

function isDnsWorking(): boolean {
  if (!isDnsInstalled()) return false;
  
  // Try to resolve a test domain
  const result = spawnSync('dig', ['+short', '@127.0.0.1', '-p', '15353', 'test.connect'], {
    encoding: 'utf-8',
    timeout: 2000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  
  return result.status === 0 && result.stdout.includes('127.0.0.1');
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function getConnectBinaryPath(): string {
  // Try to find the connect binary
  try {
    const which = execSync('which connect', { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
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

