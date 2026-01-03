import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as net from 'net';
import * as dgram from 'dgram';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import { loadConfig, getConfigDir } from '../config';

interface DnsOptions {
  hub: string;
  port?: number;
  domain?: string;
  config?: string;
}

const DNS_PORT = 15353;  // Non-privileged port for DNS server
const DEFAULT_DOMAIN = 'connect';  // service-name.connect
const DNS_PID_FILE = 'dns.pid';
const DNS_LOG_FILE = 'dns.log';
const RESOLVER_DIR = '/etc/resolver';

function getPidPath(): string {
  return path.join(getConfigDir(), DNS_PID_FILE);
}

function getLogPath(): string {
  return path.join(getConfigDir(), DNS_LOG_FILE);
}

function isRunning(): { running: boolean; pid?: number } {
  const pidPath = getPidPath();
  
  if (!fs.existsSync(pidPath)) {
    return { running: false };
  }
  
  try {
    const pid = parseInt(fs.readFileSync(pidPath, 'utf-8').trim(), 10);
    process.kill(pid, 0);
    return { running: true, pid };
  } catch {
    try { fs.unlinkSync(pidPath); } catch { /* ignore */ }
    return { running: false };
  }
}

/**
 * Main DNS command dispatcher
 */
export async function dnsCommand(action: string | undefined, options: DnsOptions) {
  switch (action) {
    case 'install':
      return installDns(options);
    case 'uninstall':
      return uninstallDns();
    case 'start':
      return startDns(options);
    case 'stop':
      return stopDns();
    case 'status':
      return statusDns();
    case 'test':
      return testDns(options);
    default:
      return statusDns();
  }
}

/**
 * Install DNS resolver configuration
 */
async function installDns(options: DnsOptions) {
  const platform = os.platform();
  const domain = options.domain || DEFAULT_DOMAIN;

  console.log(chalk.cyan('\n🌐 Installing Private Connect DNS...\n'));

  if (platform === 'darwin') {
    await installDnsMacOS(domain, options);
  } else if (platform === 'linux') {
    await installDnsLinux(domain, options);
  } else {
    console.error(chalk.red(`[x] Unsupported platform: ${platform}`));
    console.log(chalk.gray('  DNS resolution is supported on macOS and Linux.\n'));
    console.log(chalk.white('  Alternative: Use /etc/hosts entries manually:'));
    console.log(chalk.cyan('    127.0.0.1 prod-db.connect'));
    console.log();
    process.exit(1);
  }
}

async function installDnsMacOS(domain: string, options: DnsOptions) {
  const resolverPath = path.join(RESOLVER_DIR, domain);
  const dnsPort = options.port || DNS_PORT;

  console.log(chalk.white('  Setting up macOS resolver...\n'));

  // Check if resolver directory exists
  if (!fs.existsSync(RESOLVER_DIR)) {
    console.log(chalk.yellow(`  [!] ${RESOLVER_DIR} does not exist.`));
    console.log(chalk.gray('  Creating with sudo...\n'));
    
    try {
      execSync(`sudo mkdir -p ${RESOLVER_DIR}`);
    } catch (error) {
      console.error(chalk.red('\n[x] Failed to create resolver directory.'));
      console.log(chalk.gray('  Run: sudo mkdir -p /etc/resolver\n'));
      process.exit(1);
    }
  }

  // Create resolver file
  const resolverContent = `# Private Connect DNS resolver
# Resolves *.${domain} to local DNS server
nameserver 127.0.0.1
port ${dnsPort}
`;

  try {
    // Write to temp file and move with sudo
    const tempFile = path.join(os.tmpdir(), `pconnect-resolver-${Date.now()}`);
    fs.writeFileSync(tempFile, resolverContent);
    
    execSync(`sudo mv ${tempFile} ${resolverPath}`);
    execSync(`sudo chmod 644 ${resolverPath}`);
    
    console.log(chalk.gray(`  Created: ${resolverPath}`));
  } catch (error) {
    console.error(chalk.red('\n[x] Failed to create resolver file.'));
    console.log(chalk.gray(`  Run: sudo tee ${resolverPath} << 'EOF'\n${resolverContent}EOF\n`));
    process.exit(1);
  }

  // Start DNS server
  await startDns(options);

  console.log(chalk.green('\n[ok] DNS installed successfully!\n'));
  console.log(chalk.white('  You can now access services via:'));
  console.log(chalk.cyan(`    curl http://my-service.${domain}`));
  console.log(chalk.cyan(`    psql -h prod-db.${domain}`));
  console.log();
  console.log(chalk.gray('  Commands:'));
  console.log(chalk.gray(`    Status:    ${chalk.cyan('connect dns status')}`));
  console.log(chalk.gray(`    Test:      ${chalk.cyan('connect dns test prod-db')}`));
  console.log(chalk.gray(`    Uninstall: ${chalk.cyan('connect dns uninstall')}`));
  console.log();
}

async function installDnsLinux(domain: string, options: DnsOptions) {
  console.log(chalk.white('  Setting up Linux DNS...\n'));

  // Check for systemd-resolved
  let hasSystemdResolved = false;
  try {
    execSync('systemctl is-active systemd-resolved', { stdio: 'ignore' });
    hasSystemdResolved = true;
  } catch {
    // Not using systemd-resolved
  }

  if (hasSystemdResolved) {
    console.log(chalk.gray('  Detected: systemd-resolved'));
    
    // Create drop-in configuration
    const dropInDir = '/etc/systemd/resolved.conf.d';
    const dropInFile = path.join(dropInDir, 'pconnect.conf');
    const dnsPort = options.port || DNS_PORT;
    
    const content = `# Private Connect DNS configuration
[Resolve]
DNS=127.0.0.1:${dnsPort}
Domains=~${domain}
`;

    try {
      const tempFile = path.join(os.tmpdir(), `pconnect-resolved-${Date.now()}`);
      fs.writeFileSync(tempFile, content);
      
      execSync(`sudo mkdir -p ${dropInDir}`);
      execSync(`sudo mv ${tempFile} ${dropInFile}`);
      execSync(`sudo systemctl restart systemd-resolved`);
      
      console.log(chalk.gray(`  Created: ${dropInFile}`));
    } catch (error) {
      console.error(chalk.red('\n[x] Failed to configure systemd-resolved.'));
      console.log(chalk.gray('  You may need to configure DNS manually.\n'));
      process.exit(1);
    }
  } else {
    // Fallback: suggest dnsmasq or /etc/hosts
    console.log(chalk.yellow('  [!] systemd-resolved not detected.'));
    console.log();
    console.log(chalk.white('  Option 1: Install dnsmasq'));
    console.log(chalk.gray('    sudo apt install dnsmasq'));
    console.log(chalk.gray(`    echo "address=/.${domain}/127.0.0.1" | sudo tee /etc/dnsmasq.d/pconnect.conf`));
    console.log(chalk.gray('    sudo systemctl restart dnsmasq'));
    console.log();
    console.log(chalk.white('  Option 2: Use /etc/hosts (manual)'));
    console.log(chalk.gray('    Add entries like: 127.0.0.1 prod-db.connect'));
    console.log();
    return;
  }

  // Start DNS server
  await startDns(options);

  console.log(chalk.green('\n[ok] DNS installed successfully!\n'));
}

/**
 * Start the DNS server
 */
async function startDns(options: DnsOptions) {
  const { running, pid: existingPid } = isRunning();
  
  if (running) {
    console.log(chalk.yellow(`  [!] DNS server already running (PID: ${existingPid})`));
    return;
  }

  const config = loadConfig();
  if (!config) {
    console.error(chalk.red('[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first.\n`));
    process.exit(1);
  }

  const dnsPort = options.port || DNS_PORT;
  const domain = options.domain || DEFAULT_DOMAIN;
  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.gray(`  Starting DNS server on port ${dnsPort}...`));

  const logPath = getLogPath();
  const pidPath = getPidPath();
  const configDir = getConfigDir();
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  const logStream = fs.openSync(logPath, 'a');

  // Start DNS server as background process
  const child = spawn(process.execPath, [
    process.argv[1],
    'dns',
    'serve',
    '--port', dnsPort.toString(),
    '--domain', domain,
    '--hub', hubUrl,
  ], {
    detached: true,
    stdio: ['ignore', logStream, logStream],
    env: { ...process.env, CONNECT_DNS_SERVER: '1' },
  });

  child.unref();
  fs.writeFileSync(pidPath, child.pid?.toString() || '');

  console.log(chalk.green(`  [ok] DNS server started (PID: ${child.pid})`));
}

/**
 * Actually run the DNS server (called with 'serve' action)
 */
export async function serveDns(options: DnsOptions) {
  const config = loadConfig();
  if (!config) {
    console.error('DNS server: No configuration found');
    process.exit(1);
  }

  const port = options.port || DNS_PORT;
  const domain = options.domain || DEFAULT_DOMAIN;
  const hubUrl = config.hubUrl || options.hub;
  const apiKey = config.apiKey;

  // Cache for service -> port mappings
  let serviceCache: Map<string, number> = new Map();
  let lastFetch = 0;
  const CACHE_TTL = 5000; // 5 seconds

  async function refreshServiceCache() {
    const now = Date.now();
    if (now - lastFetch < CACHE_TTL) return;
    
    try {
      const response = await fetch(`${hubUrl}/v1/services`, {
        headers: { 'x-api-key': apiKey },
      });
      
      if (response.ok) {
        const services = await response.json() as Array<{ name: string; targetPort: number; tunnelPort?: number }>;
        serviceCache.clear();
        for (const service of services) {
          if (service.tunnelPort) {
            serviceCache.set(service.name.toLowerCase(), service.tunnelPort);
          }
        }
        lastFetch = now;
      }
    } catch (error) {
      console.error('DNS: Failed to refresh service cache:', error);
    }
  }

  // Simple DNS server
  const server = dgram.createSocket('udp4');

  server.on('message', async (msg, rinfo) => {
    await refreshServiceCache();

    try {
      // Parse DNS query (simplified)
      const queryName = parseDnsQueryName(msg);
      
      if (!queryName || !queryName.endsWith(`.${domain}`)) {
        // Not our domain, send empty response
        sendDnsResponse(server, rinfo, msg, null);
        return;
      }

      // Extract service name
      const serviceName = queryName.slice(0, -(domain.length + 1)).toLowerCase();
      
      // Always resolve to 127.0.0.1 - the proxy/reach will handle the actual routing
      const ip = '127.0.0.1';
      
      console.log(`DNS: ${queryName} -> ${ip}`);
      sendDnsResponse(server, rinfo, msg, ip);
      
    } catch (error) {
      console.error('DNS: Error processing query:', error);
      sendDnsResponse(server, rinfo, msg, null);
    }
  });

  server.on('error', (error) => {
    console.error('DNS server error:', error);
    process.exit(1);
  });

  server.bind(port, '127.0.0.1', () => {
    console.log(`DNS server listening on 127.0.0.1:${port}`);
    console.log(`Resolving *.${domain} -> 127.0.0.1`);
  });

  // Handle shutdown
  process.on('SIGTERM', () => {
    console.log('DNS server shutting down...');
    server.close();
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('DNS server shutting down...');
    server.close();
    process.exit(0);
  });
}

/**
 * Parse DNS query name from message
 */
function parseDnsQueryName(msg: Buffer): string | null {
  try {
    // Skip header (12 bytes)
    let offset = 12;
    const parts: string[] = [];
    
    while (offset < msg.length) {
      const len = msg[offset];
      if (len === 0) break;
      
      offset++;
      parts.push(msg.slice(offset, offset + len).toString('ascii'));
      offset += len;
    }
    
    return parts.join('.');
  } catch {
    return null;
  }
}

/**
 * Send DNS response
 */
function sendDnsResponse(
  server: dgram.Socket,
  rinfo: dgram.RemoteInfo,
  query: Buffer,
  ip: string | null
) {
  // Build response header
  const response = Buffer.alloc(512);
  let offset = 0;
  
  // Transaction ID (copy from query)
  response[offset++] = query[0];
  response[offset++] = query[1];
  
  // Flags: QR=1, OPCODE=0, AA=1, TC=0, RD=1, RA=1, RCODE=0 or 3 (NXDOMAIN)
  response[offset++] = 0x84; // QR=1, AA=1
  response[offset++] = ip ? 0x80 : 0x83; // RA=1, RCODE=0 or 3
  
  // QDCOUNT = 1
  response[offset++] = 0;
  response[offset++] = 1;
  
  // ANCOUNT = 1 if we have an answer
  response[offset++] = 0;
  response[offset++] = ip ? 1 : 0;
  
  // NSCOUNT = 0
  response[offset++] = 0;
  response[offset++] = 0;
  
  // ARCOUNT = 0
  response[offset++] = 0;
  response[offset++] = 0;
  
  // Copy question section from query
  let qOffset = 12;
  while (qOffset < query.length && query[qOffset] !== 0) {
    const len = query[qOffset];
    for (let i = 0; i <= len; i++) {
      response[offset++] = query[qOffset++];
    }
  }
  response[offset++] = 0; // null terminator
  qOffset++;
  
  // QTYPE
  response[offset++] = query[qOffset++];
  response[offset++] = query[qOffset++];
  
  // QCLASS
  response[offset++] = query[qOffset++];
  response[offset++] = query[qOffset++];
  
  // Add answer if we have one
  if (ip) {
    // Name pointer to question
    response[offset++] = 0xc0;
    response[offset++] = 0x0c;
    
    // TYPE A
    response[offset++] = 0;
    response[offset++] = 1;
    
    // CLASS IN
    response[offset++] = 0;
    response[offset++] = 1;
    
    // TTL (60 seconds)
    response[offset++] = 0;
    response[offset++] = 0;
    response[offset++] = 0;
    response[offset++] = 60;
    
    // RDLENGTH
    response[offset++] = 0;
    response[offset++] = 4;
    
    // RDATA (IP address)
    const ipParts = ip.split('.').map(p => parseInt(p, 10));
    response[offset++] = ipParts[0];
    response[offset++] = ipParts[1];
    response[offset++] = ipParts[2];
    response[offset++] = ipParts[3];
  }
  
  server.send(response.slice(0, offset), rinfo.port, rinfo.address);
}

/**
 * Stop DNS server
 */
async function stopDns() {
  const { running, pid } = isRunning();
  
  if (!running) {
    console.log(chalk.yellow('\n[!] DNS server is not running\n'));
    return;
  }

  try {
    process.kill(pid!, 'SIGTERM');
    
    // Wait for exit
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 200));
      const { running: stillRunning } = isRunning();
      if (!stillRunning) break;
    }
    
    const pidPath = getPidPath();
    if (fs.existsSync(pidPath)) {
      fs.unlinkSync(pidPath);
    }
    
    console.log(chalk.green('\n[ok] DNS server stopped\n'));
  } catch (error) {
    console.error(chalk.red(`\n[x] Failed to stop DNS server\n`));
  }
}

/**
 * Uninstall DNS configuration
 */
async function uninstallDns() {
  const platform = os.platform();
  const domain = DEFAULT_DOMAIN;

  console.log(chalk.cyan('\n🌐 Uninstalling Private Connect DNS...\n'));

  // Stop server first
  await stopDns();

  if (platform === 'darwin') {
    const resolverPath = path.join(RESOLVER_DIR, domain);
    
    if (fs.existsSync(resolverPath)) {
      try {
        execSync(`sudo rm ${resolverPath}`);
        console.log(chalk.gray(`  Removed: ${resolverPath}`));
      } catch {
        console.log(chalk.yellow(`  [!] Could not remove ${resolverPath}`));
        console.log(chalk.gray(`  Run: sudo rm ${resolverPath}`));
      }
    }
  } else if (platform === 'linux') {
    const dropInFile = '/etc/systemd/resolved.conf.d/pconnect.conf';
    
    if (fs.existsSync(dropInFile)) {
      try {
        execSync(`sudo rm ${dropInFile}`);
        execSync('sudo systemctl restart systemd-resolved');
        console.log(chalk.gray(`  Removed: ${dropInFile}`));
      } catch {
        console.log(chalk.yellow(`  [!] Could not remove ${dropInFile}`));
      }
    }
  }

  console.log(chalk.green('\n[ok] DNS uninstalled\n'));
}

/**
 * Show DNS status
 */
async function statusDns() {
  const { running, pid } = isRunning();
  const platform = os.platform();
  const domain = DEFAULT_DOMAIN;

  console.log(chalk.cyan('\n🌐 Private Connect DNS Status\n'));

  if (running) {
    console.log(chalk.green(`  ● DNS Server: running (PID: ${pid})`));
  } else {
    console.log(chalk.red('  ○ DNS Server: stopped'));
  }

  // Check resolver configuration
  if (platform === 'darwin') {
    const resolverPath = path.join(RESOLVER_DIR, domain);
    const configured = fs.existsSync(resolverPath);
    console.log(chalk.gray(`    Resolver configured: ${configured ? 'yes' : 'no'}`));
  } else if (platform === 'linux') {
    const dropInFile = '/etc/systemd/resolved.conf.d/pconnect.conf';
    const configured = fs.existsSync(dropInFile);
    console.log(chalk.gray(`    systemd-resolved configured: ${configured ? 'yes' : 'no'}`));
  }

  console.log(chalk.gray(`    Domain: *.${domain}`));
  console.log();

  if (!running) {
    console.log(chalk.gray(`  Start with: ${chalk.cyan('connect dns start')}`));
    console.log(chalk.gray(`  Install with: ${chalk.cyan('connect dns install')}`));
    console.log();
  }
}

/**
 * Test DNS resolution
 */
async function testDns(options: DnsOptions) {
  const domain = options.domain || DEFAULT_DOMAIN;
  const serviceName = process.argv[4] || 'test-service';
  const testHost = `${serviceName}.${domain}`;

  console.log(chalk.cyan(`\n🔍 Testing DNS resolution for ${testHost}...\n`));

  try {
    const dns = await import('dns');
    const { promisify } = await import('util');
    const lookup = promisify(dns.lookup);
    
    const result = await lookup(testHost);
    console.log(chalk.green(`  [ok] Resolved: ${testHost} -> ${result.address}`));
    console.log();
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    console.log(chalk.red(`  [x] Resolution failed: ${err.code || err.message}`));
    console.log();
    console.log(chalk.gray('  Possible issues:'));
    console.log(chalk.gray('    • DNS server not running (connect dns start)'));
    console.log(chalk.gray('    • Resolver not configured (connect dns install)'));
    console.log(chalk.gray('    • DNS cache needs flush'));
    console.log();
    
    if (os.platform() === 'darwin') {
      console.log(chalk.gray('  Try flushing DNS cache:'));
      console.log(chalk.cyan('    sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder'));
      console.log();
    }
  }
}

