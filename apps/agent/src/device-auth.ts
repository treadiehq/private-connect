import chalk from 'chalk';
import * as os from 'os';
import { exec } from 'child_process';

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

/**
 * Check if we can open a browser
 */
export function canOpenBrowser(): boolean {
  // Check for display/GUI environment
  const hasDisplay = process.env.DISPLAY || process.env.WAYLAND_DISPLAY;
  const isMac = os.platform() === 'darwin';
  const isWindows = os.platform() === 'win32';
  const isSSH = process.env.SSH_CLIENT || process.env.SSH_TTY;
  const isDocker = process.env.container === 'docker';
  
  // Can open browser on Mac/Windows or Linux with display, unless in SSH/Docker
  if (isSSH || isDocker) return false;
  return isMac || isWindows || !!hasDisplay;
}

/**
 * Open a URL in the default browser
 */
export function openBrowser(url: string): void {
  const platform = os.platform();
  
  let command: string;
  if (platform === 'darwin') {
    command = `open "${url}"`;
  } else if (platform === 'win32') {
    command = `start "" "${url}"`;
  } else {
    command = `xdg-open "${url}"`;
  }
  
  exec(command, (error) => {
    if (error) {
      console.log(chalk.yellow(`  Could not open browser automatically.`));
    }
  });
}

/**
 * Run the device authorization flow
 */
export async function deviceAuthFlow(
  hubUrl: string,
  label?: string,
  agentName?: string,
): Promise<{ apiKey: string; workspaceId: string; workspaceName: string; userEmail: string } | null> {
  console.log();
  
  // Step 1: Get device code
  const codeResponse = await fetch(`${hubUrl}/v1/device/code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, agentName }),
  });
  
  if (!codeResponse.ok) {
    console.log(chalk.red('  ✗ Failed to start device authorization'));
    return null;
  }
  
  const deviceCode = await codeResponse.json() as DeviceCodeResponse;
  
  // Step 2: Show instructions
  const verifyUrl = `${deviceCode.verificationUrl}?code=${deviceCode.userCode}`;
  
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
  
  // Step 3: Poll for authorization
  const startTime = Date.now();
  const expiresAt = startTime + (deviceCode.expiresIn * 1000);
  const pollInterval = deviceCode.interval * 1000;
  
  while (Date.now() < expiresAt) {
    await sleep(pollInterval);
    
    try {
      const tokenResponse = await fetch(
        `${hubUrl}/v1/device/token?device_code=${deviceCode.deviceCode}`,
      );
      
      const tokenData = await tokenResponse.json() as DeviceTokenResponse;
      
      if (tokenData.error === 'authorization_pending') {
        // Still waiting, continue polling
        process.stdout.write(chalk.gray('.'));
        continue;
      }
      
      if (tokenData.error === 'expired_token') {
        console.log();
        console.log(chalk.red('  ✗ Authorization expired. Please try again.'));
        return null;
      }
      
      if (tokenData.api_key) {
        console.log();
        console.log(chalk.green('  ✓ Authorized!'));
        console.log(chalk.gray(`    Workspace: ${tokenData.workspace_name}`));
        console.log(chalk.gray(`    User: ${tokenData.user_email}`));
        console.log();
        
        return {
          apiKey: tokenData.api_key,
          workspaceId: tokenData.workspace_id!,
          workspaceName: tokenData.workspace_name!,
          userEmail: tokenData.user_email!,
        };
      }
    } catch (error) {
      // Network error, keep trying
      process.stdout.write(chalk.yellow('!'));
    }
  }
  
  console.log();
  console.log(chalk.red('  ✗ Authorization timed out. Please try again.'));
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

