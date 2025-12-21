import chalk from 'chalk';
import ora from 'ora';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as https from 'https';

const REPO = 'treadiehq/private-connect';

interface ReleaseInfo {
  tag_name: string;
  assets: { name: string; browser_download_url: string }[];
}

function getInstalledVersion(): string {
  try {
    const result = execSync('connect --version', { encoding: 'utf-8' });
    return result.trim();
  } catch {
    return 'unknown';
  }
}

function getPlatformBinary(): string {
  const platform = os.platform();
  const arch = os.arch();
  
  let osName: string;
  if (platform === 'darwin') {
    osName = 'darwin';
  } else if (platform === 'linux') {
    osName = 'linux';
  } else {
    throw new Error(`Unsupported platform: ${platform}`);
  }
  
  let archName: string;
  if (arch === 'x64') {
    archName = 'x64';
  } else if (arch === 'arm64') {
    archName = 'arm64';
  } else {
    throw new Error(`Unsupported architecture: ${arch}`);
  }
  
  return `connect-${osName}-${archName}`;
}

function fetchLatestRelease(): Promise<ReleaseInfo> {
  return new Promise((resolve, reject) => {
    const url = `https://api.github.com/repos/${REPO}/releases/latest`;
    
    https.get(url, {
      headers: { 'User-Agent': 'private-connect-cli' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error('Failed to parse release info'));
        }
      });
    }).on('error', reject);
  });
}

function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    
    const request = (downloadUrl: string) => {
      https.get(downloadUrl, {
        headers: { 'User-Agent': 'private-connect-cli' }
      }, (res) => {
        // Follow redirects
        if (res.statusCode === 302 || res.statusCode === 301) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            request(redirectUrl);
            return;
          }
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`Download failed: ${res.statusCode}`));
          return;
        }
        
        res.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        fs.unlink(dest, () => {});
        reject(err);
      });
    };
    
    request(url);
  });
}

export async function updateCommand(options: { force?: boolean }) {
  console.log(chalk.cyan('\n🔄 Private Connect CLI Updater\n'));
  
  const currentVersion = getInstalledVersion();
  console.log(`Current version: ${chalk.yellow(currentVersion)}`);
  
  const spinner = ora('Checking for updates...').start();
  
  try {
    const release = await fetchLatestRelease();
    const latestVersion = release.tag_name.replace(/^v/, '');
    
    spinner.succeed(`Latest version: ${chalk.green(latestVersion)}`);
    
    if (currentVersion === latestVersion && !options.force) {
      console.log(chalk.green('\n✓ You already have the latest version!'));
      return;
    }
    
    if (currentVersion !== latestVersion) {
      console.log(chalk.yellow(`\nNew version available: ${currentVersion} → ${latestVersion}`));
    }
    
    // Find the right binary
    const binaryName = getPlatformBinary();
    const asset = release.assets.find(a => a.name === binaryName);
    
    if (!asset) {
      console.error(chalk.red(`\nNo binary found for your platform: ${binaryName}`));
      console.log('Available binaries:', release.assets.map(a => a.name).join(', '));
      process.exit(1);
    }
    
    // Download to temp file
    const tmpDir = os.tmpdir();
    const tmpFile = path.join(tmpDir, 'connect-update');
    
    const downloadSpinner = ora(`Downloading ${binaryName}...`).start();
    
    await downloadFile(asset.browser_download_url, tmpFile);
    
    downloadSpinner.succeed('Downloaded');
    
    // Make executable
    fs.chmodSync(tmpFile, 0o755);
    
    // Find current binary location
    let installPath = '/usr/local/bin/connect';
    try {
      const which = execSync('which connect', { encoding: 'utf-8' }).trim();
      if (which) installPath = which;
    } catch {
      // Use default
    }
    
    // Replace binary
    const installSpinner = ora(`Installing to ${installPath}...`).start();
    
    try {
      fs.copyFileSync(tmpFile, installPath);
      installSpinner.succeed('Installed');
    } catch (e: any) {
      if (e.code === 'EACCES') {
        installSpinner.info('Requires sudo to install');
        try {
          execSync(`sudo cp "${tmpFile}" "${installPath}"`, { stdio: 'inherit' });
          console.log(chalk.green('✓ Installed with sudo'));
        } catch {
          console.error(chalk.red('Failed to install. Try running with sudo.'));
          process.exit(1);
        }
      } else {
        throw e;
      }
    }
    
    // Cleanup
    fs.unlinkSync(tmpFile);
    
    // Verify
    const newVersion = getInstalledVersion();
    console.log(chalk.green(`\n✓ Updated to version ${newVersion}!`));
    
  } catch (error: any) {
    spinner.fail('Update failed');
    console.error(chalk.red(error.message));
    process.exit(1);
  }
}

