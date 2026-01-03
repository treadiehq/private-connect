import chalk from 'chalk';
import * as os from 'os';
import * as fs from 'fs';
import { spawn } from 'child_process';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUrl: string;
  expiresIn: number;
  interval: number;
}

interface DeviceTokenResponse {
  error?: string;
  api_key?: string;
  workspace_id?: string;
  workspace_name?: string;
  user_email?: string;
}

interface AuthResult {
  apiKey: string;
  workspaceId: string;
  workspaceName: string;
  userEmail: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

// OAuth 2.0 Device Flow recommends minimum 5 second polling interval
const MIN_POLL_INTERVAL_MS = 5000;
const MAX_POLL_INTERVAL_MS = 30000;
const MAX_NETWORK_ERRORS = 10;
const BACKOFF_MULTIPLIER = 1.5;
const JITTER_FACTOR = 0.1; // 10% jitter

// ─────────────────────────────────────────────────────────────────────────────
// Environment Detection
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Check if running in a headless/non-GUI environment
 */
function isHeadlessEnvironment(): boolean {
  // CI/CD environments
  if (process.env.CI || process.env.GITHUB_ACTIONS || process.env.GITLAB_CI ||
      process.env.CIRCLECI || process.env.JENKINS_URL || process.env.BUILDKITE) {
    return true;
  }

  // SSH session (no local display)
  if (process.env.SSH_CLIENT || process.env.SSH_TTY) {
    return true;
  }

  // Container environments (multiple detection methods)
  if (process.env.container || 
      process.env.DOCKER_CONTAINER ||
      fs.existsSync('/.dockerenv') ||
      (fs.existsSync('/proc/1/cgroup') && 
       fs.readFileSync('/proc/1/cgroup', 'utf-8').includes('docker'))) {
    return true;
  }

  // Kubernetes
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return true;
  }

  return false;
}

/**
 * Check if we can open a browser
 */
export function canOpenBrowser(): boolean {
  const platform = os.platform();
  const isMac = platform === 'darwin';
  const isWindows = platform === 'win32';

  // Headless environments can't open browsers
  if (isHeadlessEnvironment()) {
    return false;
  }

  // Mac and Windows typically have GUI
  if (isMac || isWindows) {
    return true;
  }

  // Linux: check for display server
  const hasDisplay = process.env.DISPLAY || process.env.WAYLAND_DISPLAY;
  if (!hasDisplay) {
    return false;
  }

  // Additional check: try to verify display is accessible
  // (DISPLAY might be set but X server not running)
  if (process.env.DISPLAY) {
    try {
      // Quick check if xdg-open or similar exists
      const xdgPath = ['/usr/bin/xdg-open', '/usr/local/bin/xdg-open']
        .find(p => fs.existsSync(p));
      if (!xdgPath) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Open a URL in the default browser (safe, no shell injection)
 */
export function openBrowser(url: string): void {
  const platform = os.platform();

  let command: string;
  let args: string[];

  if (platform === 'darwin') {
    command = 'open';
    args = [url];
  } else if (platform === 'win32') {
    // On Windows, use 'cmd' with /c and start
    command = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    // Linux/BSD
    command = 'xdg-open';
    args = [url];
  }

  // Use spawn with explicit args array — no shell interpolation
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.on('error', () => {
    console.log(chalk.yellow(`  Could not open browser automatically.`));
  });

  // Don't wait for the browser process
  child.unref();
}

// ─────────────────────────────────────────────────────────────────────────────
// Response Validation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Validate device code response schema
 */
function validateDeviceCodeResponse(data: unknown): DeviceCodeResponse | null {
  if (!data || typeof data !== 'object') return null;

  const obj = data as Record<string, unknown>;

  if (typeof obj.deviceCode !== 'string' || !obj.deviceCode) return null;
  if (typeof obj.userCode !== 'string' || !obj.userCode) return null;
  if (typeof obj.verificationUrl !== 'string' || !obj.verificationUrl) return null;
  if (typeof obj.expiresIn !== 'number' || obj.expiresIn <= 0) return null;
  if (typeof obj.interval !== 'number' || obj.interval < 0) return null;

  return {
    deviceCode: obj.deviceCode,
    userCode: obj.userCode,
    verificationUrl: obj.verificationUrl,
    expiresIn: obj.expiresIn,
    interval: obj.interval,
  };
}

/**
 * Validate token response and extract auth result
 */
function validateTokenResponse(data: unknown): { 
  result?: AuthResult; 
  error?: string;
  pending?: boolean;
  expired?: boolean;
} {
  if (!data || typeof data !== 'object') {
    return { error: 'Invalid response from server' };
  }

  const obj = data as Record<string, unknown>;

  // Check for error states
  if (obj.error === 'authorization_pending') {
    return { pending: true };
  }

  if (obj.error === 'expired_token') {
    return { expired: true };
  }

  if (typeof obj.error === 'string') {
    return { error: obj.error };
  }

  // Validate successful response
  if (typeof obj.api_key === 'string' && obj.api_key) {
    // Require all fields for successful auth
    if (typeof obj.workspace_id !== 'string' || !obj.workspace_id) {
      return { error: 'Missing workspace_id in response' };
    }
    if (typeof obj.workspace_name !== 'string') {
      return { error: 'Missing workspace_name in response' };
    }
    if (typeof obj.user_email !== 'string') {
      return { error: 'Missing user_email in response' };
    }

    return {
      result: {
        apiKey: obj.api_key,
        workspaceId: obj.workspace_id,
        workspaceName: obj.workspace_name,
        userEmail: obj.user_email,
      },
    };
  }

  return { error: 'Unexpected response format' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Polling Utilities
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Clamp polling interval to safe bounds
 */
function clampInterval(intervalSeconds: number): number {
  const intervalMs = intervalSeconds * 1000;
  return Math.max(MIN_POLL_INTERVAL_MS, Math.min(MAX_POLL_INTERVAL_MS, intervalMs));
}

/**
 * Add jitter to prevent thundering herd
 */
function addJitter(intervalMs: number): number {
  const jitter = intervalMs * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(intervalMs + jitter);
}

/**
 * Sleep with optional early cancellation
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Device Auth Flow
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Run the device authorization flow
 */
export async function deviceAuthFlow(
  hubUrl: string,
  label?: string,
  agentName?: string,
): Promise<AuthResult | null> {
  console.log();

  // Step 1: Get device code
  let codeResponse: Response;
  try {
    // Only include defined fields in request body
    const body: Record<string, string> = {};
    if (label) body.label = label;
    if (agentName) body.agentName = agentName;

    codeResponse = await fetch(`${hubUrl}/v1/device/code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.log(chalk.red(`  [x] Failed to connect to hub: ${message}`));
    return null;
  }

  if (!codeResponse.ok) {
    const text = await codeResponse.text().catch(() => 'Unknown error');
    console.log(chalk.red(`  [x] Failed to start device authorization: ${text}`));
    return null;
  }

  let rawData: unknown;
  try {
    rawData = await codeResponse.json();
  } catch {
    console.log(chalk.red('  [x] Invalid response from server'));
    return null;
  }

  const deviceCode = validateDeviceCodeResponse(rawData);
  if (!deviceCode) {
    console.log(chalk.red('  [x] Invalid device code response from server'));
    return null;
  }

  // Step 2: Show instructions
  // URL-encode the user code to handle special characters safely
  const encodedUserCode = encodeURIComponent(deviceCode.userCode);
  const verifyUrl = `${deviceCode.verificationUrl}?code=${encodedUserCode}`;

  if (canOpenBrowser()) {
    console.log(chalk.cyan('  Opening browser for authorization...'));
    console.log();
    openBrowser(verifyUrl);
    console.log(chalk.gray(`  If browser doesn't open, visit:`));
    console.log(chalk.white(`  ${deviceCode.verificationUrl}`));
    console.log();
    console.log(chalk.gray(`  And enter code: `) + chalk.white.bold(deviceCode.userCode));
  } else {
    console.log(chalk.cyan('  To authorize this device, visit:'));
    console.log();
    console.log(chalk.white.bold(`    ${deviceCode.verificationUrl}`));
    console.log();
    console.log(chalk.gray(`  And enter code: `) + chalk.white.bold(deviceCode.userCode));
  }

  console.log();
  console.log(chalk.gray(`  Waiting for authorization...`));

  // Step 3: Poll for authorization with exponential backoff
  const startTime = Date.now();
  const expiresAt = startTime + (deviceCode.expiresIn * 1000);
  let pollInterval = clampInterval(deviceCode.interval);
  let consecutiveErrors = 0;

  while (Date.now() < expiresAt) {
    await sleep(addJitter(pollInterval));

    try {
      const tokenResponse = await fetch(
        `${hubUrl}/v1/device/token?device_code=${encodeURIComponent(deviceCode.deviceCode)}`,
        { method: 'GET' },
      );

      // Check HTTP status before parsing
      if (!tokenResponse.ok && tokenResponse.status !== 400) {
        // 400 is expected for pending/expired states
        throw new Error(`HTTP ${tokenResponse.status}`);
      }

      let tokenData: unknown;
      try {
        tokenData = await tokenResponse.json();
      } catch {
        throw new Error('Invalid JSON response');
      }

      const validated = validateTokenResponse(tokenData);

      if (validated.pending) {
        // Still waiting, continue polling
        process.stdout.write(chalk.gray('.'));
        consecutiveErrors = 0; // Reset error count on successful response
        continue;
      }

      if (validated.expired) {
        console.log();
        console.log(chalk.red('  [x] Authorization expired. Please try again.'));
        return null;
      }

      if (validated.error) {
        console.log();
        console.log(chalk.red(`  [x] Authorization failed: ${validated.error}`));
        return null;
      }

      if (validated.result) {
        console.log();
        console.log(chalk.green('  [ok] Authorized!'));
        console.log(chalk.gray(`    Workspace: ${validated.result.workspaceName}`));
        console.log(chalk.gray(`    User: ${validated.result.userEmail}`));
        console.log();
        return validated.result;
      }

    } catch (error) {
      consecutiveErrors++;

      // Limit consecutive network errors to prevent infinite retry on fatal errors
      if (consecutiveErrors >= MAX_NETWORK_ERRORS) {
        console.log();
        console.log(chalk.red('  [x] Too many network errors. Please check your connection.'));
        return null;
      }

      // Show warning indicator (but don't flood terminal)
      if (consecutiveErrors <= 3) {
        process.stdout.write(chalk.yellow('!'));
      }

      // Exponential backoff on errors
      pollInterval = Math.min(pollInterval * BACKOFF_MULTIPLIER, MAX_POLL_INTERVAL_MS);
    }
  }

  console.log();
  console.log(chalk.red('  [x] Authorization timed out. Please try again.'));
  return null;
}
