#!/usr/bin/env node
/**
 * Private Connect CLI
 * 
 * Zero-friction connectivity testing and temporary tunnels. No signup required.
 * 
 * Usage:
 *   npx private-connect test vault.internal:8200
 *   npx private-connect tunnel 3000
 *
 * Programmatic API:
 *   import { createTunnel } from 'private-connect';
 *   const tunnel = await createTunnel({ port: 3000 });
 *   console.log(tunnel.url);
 */

// Re-export the programmatic API so the package is importable as a library.
export { createTunnel } from './tunnel';
export type { TunnelOptions, TunnelHandle, TunnelType } from './tunnel';

import * as net from 'net';
import * as dgram from 'dgram';
import * as tls from 'tls';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { URL } from 'url';
import { randomBytes } from 'crypto';
import { io, Socket } from 'socket.io-client';

// Colors (no dependencies)
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
};

const ok = `${c.green}✓${c.reset}`;
const fail = `${c.red}✗${c.reset}`;
const warn = `${c.yellow}⚠${c.reset}`;

// Color helpers for request logging
function colorForStatus(status: number): string {
  if (status >= 500) return c.red;
  if (status >= 400) return c.yellow;
  if (status >= 300) return c.cyan;
  return c.green;
}

function colorForDuration(ms: number): string {
  if (ms > 500) return c.red;
  if (ms > 100) return c.yellow;
  return c.green;
}

function colorForMethod(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET': return c.cyan;
    case 'POST': return c.magenta;
    case 'PUT':
    case 'PATCH': return c.yellow;
    case 'DELETE': return c.red;
    default: return c.dim;
  }
}

function formatStats(durations: number[]): string {
  if (durations.length === 0) return 'No requests';
  const avg = Math.round(durations.reduce((a, b) => a + b, 0) / durations.length);
  const sorted = [...durations].sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
  const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
  return `${durations.length} requests | avg ${avg}ms | p50 ${p50}ms | p95 ${p95}ms`;
}

// Track usage (fire and forget, don't block)
function trackUsage(command: string): void {
  const data = JSON.stringify({
    os: process.platform,
    arch: process.arch === 'arm64' ? 'arm64' : 'x64',
    version: 'npx',
    source: 'npx',
  });
  
  const req = https.request('https://api.privateconnect.co/v1/events/install', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
    },
    timeout: 3000,
  });
  
  req.on('error', () => {}); // Silently ignore errors
  req.write(data);
  req.end();
}

interface TestResult {
  tcp: { ok: boolean; latency?: number; error?: string };
  tls: { ok: boolean; issuer?: string; expiry?: string; error?: string } | null;
  http: { ok: boolean; status?: number; latency?: number; error?: string } | null;
}

async function testTcp(host: string, port: number, timeout = 5000): Promise<{ ok: boolean; latency?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    
    socket.setTimeout(timeout);
    
    socket.on('connect', () => {
      const latency = Date.now() - start;
      socket.destroy();
      resolve({ ok: true, latency });
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'Connection timeout' });
    });
    
    socket.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
    
    socket.connect(port, host);
  });
}

async function testTls(host: string, port: number, timeout = 5000): Promise<{ ok: boolean; issuer?: string; expiry?: string; error?: string }> {
  return new Promise((resolve) => {
    const socket = tls.connect({
      host,
      port,
      timeout,
      rejectUnauthorized: false, // We want to check even self-signed certs
    });
    
    socket.on('secureConnect', () => {
      const cert = socket.getPeerCertificate();
      socket.destroy();
      
      if (cert && cert.issuer) {
        resolve({
          ok: true,
          issuer: cert.issuer.O || cert.issuer.CN || 'Unknown',
          expiry: cert.valid_to,
        });
      } else {
        resolve({ ok: true });
      }
    });
    
    socket.on('timeout', () => {
      socket.destroy();
      resolve({ ok: false, error: 'TLS timeout' });
    });
    
    socket.on('error', (err) => {
      // Not all services support TLS
      if (err.message.includes('wrong version') || err.message.includes('ECONNRESET')) {
        resolve({ ok: false, error: 'Not TLS' });
      } else {
        resolve({ ok: false, error: err.message });
      }
    });
  });
}

async function testHttp(url: string, timeout = 5000): Promise<{ ok: boolean; status?: number; latency?: number; error?: string }> {
  return new Promise((resolve) => {
    const start = Date.now();
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: 'GET',
      timeout,
      rejectUnauthorized: false,
    }, (res) => {
      const latency = Date.now() - start;
      res.destroy();
      resolve({
        ok: res.statusCode !== undefined && res.statusCode < 500,
        status: res.statusCode,
        latency,
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ ok: false, error: 'HTTP timeout' });
    });
    
    req.on('error', (err) => {
      resolve({ ok: false, error: err.message });
    });
    
    req.end();
  });
}

function parseTarget(target: string): { host: string; port: number; isHttp: boolean; url?: string } {
  // Handle URLs
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const url = new URL(target);
    const port = url.port ? parseInt(url.port, 10) : (url.protocol === 'https:' ? 443 : 80);
    return { host: url.hostname, port, isHttp: true, url: target };
  }
  
  // Handle host:port
  const parts = target.split(':');
  if (parts.length === 2) {
    return { host: parts[0], port: parseInt(parts[1], 10), isHttp: false };
  }
  
  // Default to port 443
  return { host: target, port: 443, isHttp: false };
}

async function runTest(target: string): Promise<void> {
  const { host, port, isHttp, url } = parseTarget(target);
  
  console.log();
  console.log(`${c.bold}Testing ${c.cyan}${target}${c.reset}`);
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();
  
  // TCP test
  process.stdout.write(`  TCP      `);
  const tcpResult = await testTcp(host, port);
  if (tcpResult.ok) {
    console.log(`${ok} ${c.dim}${tcpResult.latency}ms${c.reset}`);
  } else {
    console.log(`${fail} ${c.red}${tcpResult.error}${c.reset}`);
    // Can't continue if TCP fails
    printCta(false);
    return;
  }
  
  // TLS test (only for likely TLS ports or explicit https)
  const tlsPorts = [443, 8443, 5432, 6379, 27017, 9200];
  const shouldTestTls = isHttp || tlsPorts.includes(port) || port > 1024;
  
  let tlsResult: { ok: boolean; issuer?: string; expiry?: string; error?: string } | null = null;
  if (shouldTestTls) {
    process.stdout.write(`  TLS      `);
    tlsResult = await testTls(host, port);
    if (tlsResult.ok) {
      const extra = tlsResult.issuer ? `${c.dim}(${tlsResult.issuer})${c.reset}` : '';
      console.log(`${ok} ${extra}`);
    } else if (tlsResult.error === 'Not TLS') {
      console.log(`${c.gray}– No TLS${c.reset}`);
    } else {
      console.log(`${warn} ${c.yellow}${tlsResult.error}${c.reset}`);
    }
  }
  
  // HTTP test (if it looks like HTTP)
  let httpResult: { ok: boolean; status?: number; latency?: number; error?: string } | null = null;
  const httpUrl = url || (tlsResult?.ok ? `https://${host}:${port}` : `http://${host}:${port}`);
  
  if (isHttp || [80, 443, 8080, 8443, 3000, 5000, 8000].includes(port)) {
    process.stdout.write(`  HTTP     `);
    httpResult = await testHttp(httpUrl);
    if (httpResult.ok) {
      console.log(`${ok} ${c.dim}${httpResult.status} (${httpResult.latency}ms)${c.reset}`);
    } else if (httpResult.error) {
      console.log(`${c.gray}– ${httpResult.error}${c.reset}`);
    } else {
      console.log(`${warn} ${c.yellow}${httpResult.status}${c.reset}`);
    }
  }
  
  // Latency summary
  const latency = tcpResult.latency || httpResult?.latency;
  if (latency) {
    console.log();
    console.log(`  Latency  ${c.bold}${latency}ms${c.reset}`);
  }
  
  console.log();
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  
  const allOk = tcpResult.ok && (tlsResult === null || tlsResult.ok || tlsResult.error === 'Not TLS');
  
  if (allOk) {
    console.log(`  ${c.green}${c.bold}REACHABLE${c.reset}`);
  } else {
    console.log(`  ${c.yellow}${c.bold}ISSUES DETECTED${c.reset}`);
  }
  
  printCta(allOk);
}

function printCta(success: boolean): void {
  console.log();
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();
  
  if (success) {
    console.log(`  ${c.bold}Want to share this securely?${c.reset}`);
    console.log();
    console.log(`  ${c.cyan}curl -fsSL https://privateconnect.co/install.sh | bash${c.reset}`);
    console.log(`  ${c.cyan}connect up${c.reset}`);
    console.log();
    console.log(`  Then: ${c.bold}connect <target> --share${c.reset}`);
    console.log(`  → Get a shareable link anyone can use`);
  } else {
    console.log(`  ${c.bold}Need help debugging?${c.reset}`);
    console.log();
    console.log(`  ${c.cyan}https://privateconnect.co${c.reset}`);
  }
  
  console.log();
}

function printHelp(): void {
  console.log(`
${c.bold}Private Connect${c.reset} - Zero-friction connectivity tools

${c.bold}Commands:${c.reset}
  scan               Detect private services running locally
  up <ports...>      Share local services with a join code
  join <code>        Connect to a shared environment
  check <target>     Test connectivity to any service
  test <target>      Alias for check
  tunnel <port>      Create a temporary public tunnel
  <provider> <port>  Webhook tunnel with provider-specific setup
  list               List all active tunnels
  close <id>         Close a tunnel by ID
  close --all        Close all active tunnels
  setup-openclaw     One-command OpenClaw gateway setup
  pair               Generate QR code for mobile pairing

${c.bold}Examples:${c.reset}
  ${c.green}npx private-connect scan${c.reset}
  ${c.green}npx private-connect up 3000 5432 6379${c.reset}
  ${c.green}npx private-connect join abc123${c.reset}
  npx private-connect test vault.internal:8200
  npx private-connect tunnel 3000
  npx private-connect tunnel 4096 --tcp
  npx private-connect stripe 3000
  npx private-connect list

${c.bold}Share (up/join):${c.reset}
  • Share your entire local environment in one command
  • Your teammate runs the join code and gets all ports locally
  • No signup, no config, auto-expires in 2 hours

${c.bold}Tunnel:${c.reset}
  • No signup required
  • Sessions up to 24h (--ttl minutes); stable URL with --slug
  • HTTP, TCP (--tcp), or UDP (--udp)

${c.bold}Webhooks:${c.reset}
  • Use any provider name: polar, stripe, github, shopify, or your own
  • Known providers get tailored setup instructions

${c.bold}Test:${c.reset}
  • TCP reachability, TLS validation, HTTP response, latency

${c.dim}For permanent tunnels: https://privateconnect.co${c.reset}
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Providers
// ─────────────────────────────────────────────────────────────────────────────

interface WebhookProvider {
  name: string;           // Display name
  dashboardUrl: string;   // Where to add the webhook URL
  docsUrl: string;        // Docs link
  secretEnvVar?: string;  // e.g. POLAR_WEBHOOK_SECRET
  instructions: string[]; // Step-by-step lines printed after public URL
}

const WEBHOOK_PROVIDERS: Record<string, WebhookProvider> = {
  polar: {
    name: 'Polar',
    dashboardUrl: 'https://polar.sh',
    docsUrl: 'https://polar.sh/docs/integrate/webhooks',
    secretEnvVar: 'POLAR_WEBHOOK_SECRET',
    instructions: [
      'Go to ${dashboardUrl} → Settings → Webhooks',
      'Add the public URL above as your webhook endpoint',
      'Copy the signing secret and set it as ${secretEnvVar}',
      'Docs: ${docsUrl}',
    ],
  },
  stripe: {
    name: 'Stripe',
    dashboardUrl: 'https://dashboard.stripe.com',
    docsUrl: 'https://docs.stripe.com/webhooks',
    secretEnvVar: 'STRIPE_WEBHOOK_SECRET',
    instructions: [
      'Go to ${dashboardUrl} → Developers → Webhooks',
      'Add the public URL above as your webhook endpoint',
      'Copy the signing secret (whsec_...) and set it as ${secretEnvVar}',
      'Docs: ${docsUrl}',
    ],
  },
  github: {
    name: 'GitHub',
    dashboardUrl: 'https://github.com',
    docsUrl: 'https://docs.github.com/en/webhooks',
    secretEnvVar: 'GITHUB_WEBHOOK_SECRET',
    instructions: [
      'Go to your repo → Settings → Webhooks → Add webhook',
      'Set the Payload URL to the public URL above',
      'Set a secret and store it as ${secretEnvVar}',
      'Docs: ${docsUrl}',
    ],
  },
  shopify: {
    name: 'Shopify',
    dashboardUrl: 'https://admin.shopify.com',
    docsUrl: 'https://shopify.dev/docs/apps/build/webhooks',
    secretEnvVar: 'SHOPIFY_WEBHOOK_SECRET',
    instructions: [
      'Go to ${dashboardUrl} → Settings → Notifications → Webhooks',
      'Add the public URL above as your webhook endpoint',
      'Use the signing secret from your app settings as ${secretEnvVar}',
      'Docs: ${docsUrl}',
    ],
  },
};

// Reserved CLI commands that should NOT be treated as provider names
const RESERVED_COMMANDS = ['scan', 'test', 'check', 'tunnel', 'list', 'ls', 'close', 'kill', 'up', 'join', 'setup-openclaw', 'openclaw-setup', 'setup-moltbot', 'moltbot-setup', 'pair', 'qr', '--help', '-h'];

function getProviderInstructions(provider: WebhookProvider): string[] {
  return provider.instructions.map(line =>
    line
      .replace('${dashboardUrl}', provider.dashboardUrl)
      .replace('${docsUrl}', provider.docsUrl)
      .replace('${secretEnvVar}', provider.secretEnvVar || 'WEBHOOK_SECRET')
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Temporary Tunnel
// ─────────────────────────────────────────────────────────────────────────────

const HUB_URL = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';
const TUNNEL_DOMAIN = process.env.CONNECT_TUNNEL_DOMAIN || 'tunnel.privateconnect.co';

const TUNNEL_STORE_DIR = path.join(os.homedir(), '.private-connect');
const TUNNEL_STORE_FILE = path.join(TUNNEL_STORE_DIR, 'tunnels.json');

interface StoredTunnel {
  tunnelId: string;
  managementToken: string;
  type: string;
  expiresAt: string;
  subdomain?: string;
  createdAt: string;
}

function loadTunnelStore(): StoredTunnel[] {
  try {
    const raw = fs.readFileSync(TUNNEL_STORE_FILE, 'utf8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveTunnelToStore(tunnelId: string, managementToken: string, type: string, expiresAt: string, subdomain?: string): void {
  try {
    if (!fs.existsSync(TUNNEL_STORE_DIR)) {
      fs.mkdirSync(TUNNEL_STORE_DIR, { recursive: true });
    }
    const store = loadTunnelStore().filter((t) => t.tunnelId !== tunnelId);
    store.push({
      tunnelId,
      managementToken,
      type,
      expiresAt,
      subdomain,
      createdAt: new Date().toISOString(),
    });
    fs.writeFileSync(TUNNEL_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch (err) {
    // Non-fatal: tunnel still works, just list/close from this machine won't have token
  }
}

function removeTunnelFromStore(tunnelId: string): void {
  try {
    const store = loadTunnelStore().filter((t) => t.tunnelId !== tunnelId);
    fs.writeFileSync(TUNNEL_STORE_FILE, JSON.stringify(store, null, 2), 'utf8');
  } catch {
    // ignore
  }
}

const DB_PORTS: Record<number, string> = {
  5432: 'PostgreSQL',
  3306: 'MySQL',
  27017: 'MongoDB',
  6379: 'Redis',
  9200: 'Elasticsearch',
  5984: 'CouchDB',
  8529: 'ArangoDB',
  7687: 'Neo4j',
  9042: 'Cassandra',
};

interface TunnelOptions {
  host: string;
  port: number;
  ttl?: number; // minutes, default 120 (server allows up to e.g. 24h)
  tcp?: boolean; // raw TCP mode instead of HTTP
  udp?: boolean; // raw UDP mode instead of HTTP
  provider?: string; // webhook provider name (e.g. 'polar', 'stripe')
  slug?: string; // stable subdomain (e.g. "mygame" → https://mygame.privateconnect.co)
}

async function createTemporaryTunnel(options: TunnelOptions): Promise<void> {
  const { host, port, ttl = 120, udp = false, provider: providerName, slug: slugOpt } = options;
  const isDbPort = port in DB_PORTS;
  const tcp = options.tcp || (isDbPort && !udp);
  const tunnelType = udp ? 'udp' : (tcp ? 'tcp' : 'http');
  const provider = providerName ? WEBHOOK_PROVIDERS[providerName.toLowerCase()] : undefined;
  const slug = slugOpt ?? (providerName || undefined);
  
  console.log();
  if (provider) {
    console.log(`${c.bold}Private Connect${c.reset} - ${provider.name} Webhooks → localhost:${port}`);
  } else if (providerName) {
    // Unknown provider — generic webhook mode
    console.log(`${c.bold}Private Connect${c.reset} - ${providerName} Webhooks → localhost:${port}`);
  } else {
    console.log(`${c.bold}Private Connect${c.reset} - Temporary ${udp ? 'UDP ' : tcp ? 'TCP ' : ''}Tunnel`);
  }
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();
  
  // Check if local service is running
  process.stdout.write(`  Checking ${c.cyan}${host}:${port}${c.reset}... `);
  
  if (udp) {
    // For UDP, we can't really test connectivity without sending data
    // Just verify it's a valid port
    if (port < 1 || port > 65535) {
      console.log(`${fail}`);
      console.log();
      console.log(`  ${c.red}Invalid port: ${port}${c.reset}`);
      console.log();
      process.exit(1);
    }
    console.log(`${ok} ${c.dim}(UDP - assuming service is ready)${c.reset}`);
  } else {
    const localCheck = await testTcp(host, port, 2000);
    if (!localCheck.ok) {
      console.log(`${fail}`);
      console.log();
      console.log(`  ${c.red}Cannot connect to ${host}:${port}${c.reset}`);
      console.log(`  ${c.gray}Make sure your service is running${c.reset}`);
      console.log();
      process.exit(1);
    }
    console.log(`${ok}`);
  }
  
  // Generate a temporary tunnel ID
  const tunnelId = randomBytes(6).toString('hex');
  
  // Request tunnel from hub
  process.stdout.write(`  Requesting ${tunnelType} tunnel... `);
  
  try {
    const response = await httpRequest(`${HUB_URL}/v1/tunnels/temporary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tunnelId,
        localHost: host,
        localPort: port,
        ttlMinutes: ttl,
        type: tunnelType,
        ...(slug && { slug }),
      }),
    });
    
    if (!response.ok) {
      console.log(`${fail}`);
      console.log();
      if (response.status === 503 || response.status === 404 || response.status === 501) {
        console.log(`  ${c.yellow}Temporary tunnels coming soon!${c.reset}`);
        console.log();
        console.log(`  For now, use the full CLI:`);
        console.log(`  ${c.cyan}curl -fsSL https://privateconnect.co/install.sh | bash${c.reset}`);
        console.log(`  ${c.cyan}connect up && connect localhost:${port} --share${c.reset}`);
      } else {
        console.log(`  ${c.red}Failed to create tunnel: ${response.status}${c.reset}`);
      }
      console.log();
      process.exit(1);
    }
    
    console.log(`${ok}`);
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    const data = JSON.parse(response.body) as { 
      tunnel: { 
        tunnelId: string; 
        managementToken: string;
        type: 'http' | 'tcp' | 'udp';
        publicUrl: string; 
        subdomain?: string;
        wsUrl: string; 
        expiresAt: string; 
        ttlMinutes: number;
        tcpHost?: string;
        tcpPort?: number;
        udpHost?: string;
        udpPort?: number;
        webUrl?: string;
      } 
    };
    
    // For local dev, adjust the WS URL
    let wsUrl = data.tunnel.wsUrl;
    if (HUB_URL.includes('localhost')) {
      wsUrl = HUB_URL.replace('http', 'ws') + '/temp-tunnel';
    }
    
    // Persist tunnel for local list/close (management token required for API operations)
    saveTunnelToStore(data.tunnel.tunnelId, data.tunnel.managementToken, data.tunnel.type, data.tunnel.expiresAt, data.tunnel.subdomain);
    
    // Auto-create debug session for HTTP tunnels (requires management token)
    let debugSession: { token: string; url: string } | null = null;
    if (data.tunnel.type === 'http') {
      try {
        const debugResponse = await httpRequest(`${HUB_URL}/v1/tunnels/temporary/${data.tunnel.tunnelId}/debug`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'X-Tunnel-Management-Token': data.tunnel.managementToken,
          },
          body: JSON.stringify({ aiEnabled: false }),
        });
        
        if (debugResponse.ok) {
          const debugData = JSON.parse(debugResponse.body) as { session: { token: string; url: string } };
          debugSession = { token: debugData.session.token, url: debugData.session.url };
        }
      } catch (err) {
        // Silently fail - debug is optional
      }
    }
    
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.bold}Local:${c.reset}   ${c.cyan}${host}:${port}${c.reset}`);
    
    // Show public URL prominently
    if (data.tunnel.subdomain) {
      console.log(`  ${c.bold}Public:${c.reset}  ${c.green}${c.bold}${data.tunnel.publicUrl}${c.reset}`);
      console.log(`  ${c.gray}         Anyone can access this URL${c.reset}`);
    } else {
      console.log(`  ${c.bold}Public:${c.reset}  ${c.green}${data.tunnel.publicUrl}${c.reset}`);
    }
    
    // Show debug inspector link
    if (debugSession) {
      console.log(`  ${c.bold}Inspector:${c.reset} ${c.cyan}${debugSession.url}${c.reset}`);
      console.log(`  ${c.gray}         Live traffic monitoring & request replay${c.reset}`);
    }
    
    if (data.tunnel.type === 'tcp' && data.tunnel.tcpHost && data.tunnel.tcpPort) {
      console.log(`  ${c.bold}Connect:${c.reset} ${c.cyan}${data.tunnel.tcpHost}:${data.tunnel.tcpPort}${c.reset}`);
    }
    if (data.tunnel.type === 'udp' && data.tunnel.udpHost && data.tunnel.udpPort) {
      console.log(`  ${c.bold}Connect:${c.reset} ${c.cyan}${data.tunnel.udpHost}:${data.tunnel.udpPort}${c.reset} ${c.dim}(UDP)${c.reset}`);
    }
    
    // Show web viewer for database tunnels
    if (data.tunnel.webUrl) {
      console.log();
      console.log(`  ${c.bold}Browser:${c.reset} ${c.green}${c.bold}${data.tunnel.webUrl}${c.reset}`);
      const dbName = DB_PORTS[port] || 'database';
      console.log(`  ${c.gray}         Query your ${dbName} from the browser — no install needed${c.reset}`);
    }
    
    console.log(`  ${c.bold}Expires:${c.reset} ${data.tunnel.ttlMinutes} minutes`);
    
    // Show provider-specific webhook instructions
    if (provider) {
      console.log();
      console.log(`${c.gray}────────────────────────────────────${c.reset}`);
      console.log();
      console.log(`  ${c.bold}${provider.name} Setup:${c.reset}`);
      const lines = getProviderInstructions(provider);
      lines.forEach((line, i) => {
        console.log(`  ${c.dim}${i + 1}.${c.reset} ${line}`);
      });
    } else if (providerName) {
      // Generic webhook instructions for unknown providers
      console.log();
      console.log(`${c.gray}────────────────────────────────────${c.reset}`);
      console.log();
      console.log(`  ${c.bold}Webhook Setup:${c.reset}`);
      console.log(`  ${c.dim}1.${c.reset} Add the public URL above as your webhook endpoint in ${providerName}`);
      console.log(`  ${c.dim}2.${c.reset} Copy the signing secret from your ${providerName} dashboard`);
      console.log(`  ${c.dim}3.${c.reset} Verify webhook signatures in your local handler`);
    }
    
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    if (providerName) {
      console.log(`  ${c.dim}Waiting for webhooks... Press Ctrl+C to stop${c.reset}`);
    } else {
      console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`);
    }
    console.log();
    
    // Keep connection alive and handle incoming requests
    if (data.tunnel.type === 'udp') {
      await runUdpTunnelProxy(data.tunnel.tunnelId, wsUrl, host, port);
    } else if (data.tunnel.type === 'tcp') {
      await runTcpTunnelProxy(data.tunnel.tunnelId, wsUrl, host, port);
    } else {
      await runTunnelProxy(data.tunnel.tunnelId, wsUrl, host, port);
    }
    
  } catch (err: any) {
    console.log(`${fail}`);
    console.log();
    
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.log(`  ${c.yellow}Temporary tunnels coming soon!${c.reset}`);
      console.log();
      console.log(`  For now, use the full CLI:`);
      console.log(`  ${c.cyan}curl -fsSL https://privateconnect.co/install.sh | bash${c.reset}`);
      console.log(`  ${c.cyan}connect up && connect localhost:${port} --share${c.reset}`);
    } else {
      console.log(`  ${c.red}Error: ${err.message}${c.reset}`);
    }
    console.log();
    process.exit(1);
  }
}

// Simple HTTP request helper (no dependencies)
function httpRequest(url: string, options: { 
  method?: string; 
  headers?: Record<string, string>; 
  body?: string;
}): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.request(url, {
      method: options.method || 'GET',
      headers: options.headers,
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          ok: res.statusCode! >= 200 && res.statusCode! < 300,
          status: res.statusCode!,
          body,
        });
      });
    });
    
    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));
    
    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

/**
 * Connect to hub via WebSocket and forward HTTP requests to local service
 */
async function runTunnelProxy(tunnelId: string, wsUrl: string, localHost: string, localPort: number): Promise<void> {
  return new Promise<void>((resolve) => {
    // Extract base URL and namespace
    const url = new URL(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    const baseUrl = `${url.protocol}//${url.host}`;
    const namespace = url.pathname || '/temp-tunnel';
    
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    let requestCount = 0;
    const requestDurations: number[] = [];

    socket.on('connect', () => {
      // Register this tunnel
      socket.emit('register', { tunnelId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.log(`  ${c.red}Failed to register: ${response.error}${c.reset}`);
          socket.disconnect();
          resolve();
        }
      });
    });

    socket.on('disconnect', (reason) => {
      if (reason === 'io server disconnect') {
        console.log(`  ${c.yellow}Tunnel expired or closed by server${c.reset}`);
      }
    });

    socket.on('tunnel_expired', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel expired${c.reset}`);
      console.log();
      socket.disconnect();
      resolve();
    });

    socket.on('server_shutdown', (data: { reason?: string; message?: string; reconnectIn?: number }) => {
      console.log();
      console.log(`  ${c.yellow}⚠ Server shutting down${c.reset}`);
      if (data.message) {
        console.log(`  ${c.dim}${data.message}${c.reset}`);
      }
      if (data.reconnectIn) {
        console.log(`  ${c.dim}Reconnect in ${data.reconnectIn} seconds...${c.reset}`);
      }
      console.log();
    });

    socket.on('connect_error', (err) => {
      console.log(`  ${c.red}Connection error: ${err.message}${c.reset}`);
    });

    // Handle incoming HTTP requests from the hub
    socket.on('http_request', async (data: {
      requestId: string;
      method: string;
      path: string;
      headers: Record<string, string>;
      body: string;
    }) => {
      requestCount++;
      const start = Date.now();
      const timestamp = new Date().toLocaleTimeString();

      try {
        // Forward request to local service
        const response = await forwardToLocal(localHost, localPort, data);
        const duration = Date.now() - start;
        requestDurations.push(duration);

        const sc = colorForStatus(response.status);
        const dc = colorForDuration(duration);
        const mc = colorForMethod(data.method);
        console.log(`  ${c.gray}[${timestamp}]${c.reset} ${mc}${data.method}${c.reset} ${data.path} ${sc}${response.status}${c.reset} ${dc}${duration}ms${c.reset}`);

        // Send response back to hub
        socket.emit('http_response', {
          requestId: data.requestId,
          status: response.status,
          headers: response.headers,
          body: response.body,
        });
      } catch (err: any) {
        const duration = Date.now() - start;
        requestDurations.push(duration);
        console.log(`  ${c.gray}[${timestamp}]${c.reset} ${colorForMethod(data.method)}${data.method}${c.reset} ${data.path} ${c.red}502${c.reset} ${c.red}${duration}ms${c.reset}`);

        // Send error response
        socket.emit('http_response', {
          requestId: data.requestId,
          status: 502,
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ error: 'Bad Gateway', message: err.message }),
        });
      }
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel closed${c.reset}`);
      console.log(`  ${c.gray}${formatStats(requestDurations)}${c.reset}`);
      console.log();
      socket.disconnect();
      resolve();
    });
  });
}

/**
 * Forward an HTTP request to the local service
 */
function forwardToLocal(
  host: string, 
  port: number, 
  request: { method: string; path: string; headers: Record<string, string>; body: string }
): Promise<{ status: number; headers: Record<string, string>; body: string }> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: host,
      port: port,
      path: request.path,
      method: request.method,
      headers: { ...request.headers, host: `${host}:${port}` },
      timeout: 30000,
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        const headers: Record<string, string> = {};
        
        for (const [key, value] of Object.entries(res.headers)) {
          if (typeof value === 'string') {
            headers[key] = value;
          } else if (Array.isArray(value)) {
            headers[key] = value.join(', ');
          }
        }
        
        resolve({
          status: res.statusCode || 500,
          headers,
          body,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => reject(new Error('Request timeout')));

    if (request.body) {
      req.write(request.body);
    }
    req.end();
  });
}

/**
 * Run TCP tunnel proxy - forward raw TCP connections
 */
async function runTcpTunnelProxy(tunnelId: string, wsUrl: string, localHost: string, localPort: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const url = new URL(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    const baseUrl = `${url.protocol}//${url.host}`;
    const namespace = url.pathname || '/temp-tunnel';
    
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // Track active TCP connections
    const tcpConnections = new Map<string, net.Socket>();
    let connectionCount = 0;

    socket.on('connect', () => {
      socket.emit('register', { tunnelId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.log(`  ${c.red}Failed to register: ${response.error}${c.reset}`);
          socket.disconnect();
          resolve();
        }
      });
    });

    socket.on('disconnect', (reason) => {
      // Close all TCP connections
      for (const [, conn] of tcpConnections) {
        conn.end();
      }
      tcpConnections.clear();
      
      if (reason === 'io server disconnect') {
        console.log(`  ${c.yellow}Tunnel expired or closed by server${c.reset}`);
      }
    });

    socket.on('tunnel_expired', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel expired${c.reset}`);
      console.log();
      socket.disconnect();
      resolve();
    });

    socket.on('server_shutdown', (data: { reason?: string; message?: string; reconnectIn?: number }) => {
      console.log();
      console.log(`  ${c.yellow}⚠ Server shutting down${c.reset}`);
      if (data.message) {
        console.log(`  ${c.dim}${data.message}${c.reset}`);
      }
      if (data.reconnectIn) {
        console.log(`  ${c.dim}Reconnect in ${data.reconnectIn} seconds...${c.reset}`);
      }
      console.log();
      
      // Close all TCP connections gracefully
      for (const [, conn] of tcpConnections) {
        conn.end();
      }
      tcpConnections.clear();
    });

    // Handle TCP dial request from hub
    socket.on('tcp_dial', (data: { connectionId: string; targetHost: string; targetPort: number }) => {
      connectionCount++;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`  ${c.gray}[${timestamp}]${c.reset} ${c.cyan}TCP${c.reset} connection ${data.connectionId.slice(0, 8)}`);

      // Connect to local service - use validated localHost/localPort, not server-provided values
      // This prevents SSRF attacks where a compromised server could redirect connections
      const localSocket = net.createConnection({
        host: localHost,
        port: localPort,
      });

      tcpConnections.set(data.connectionId, localSocket);

      localSocket.on('connect', () => {
        socket.emit('tcp_dial_success', { connectionId: data.connectionId });
      });

      localSocket.on('data', (chunk: Buffer) => {
        socket.emit('tcp_data', {
          connectionId: data.connectionId,
          data: chunk.toString('base64'),
        });
      });

      localSocket.on('close', () => {
        socket.emit('tcp_close', { connectionId: data.connectionId });
        tcpConnections.delete(data.connectionId);
      });

      localSocket.on('error', (err) => {
        console.log(`  ${c.red}TCP error: ${err.message}${c.reset}`);
        socket.emit('tcp_close', { connectionId: data.connectionId });
        tcpConnections.delete(data.connectionId);
      });
    });

    // Handle TCP data from hub (from remote client)
    socket.on('tcp_data', (data: { connectionId: string; data: string }) => {
      const localSocket = tcpConnections.get(data.connectionId);
      if (localSocket) {
        const buffer = Buffer.from(data.data, 'base64');
        localSocket.write(buffer);
      }
    });

    // Handle TCP close from hub
    socket.on('tcp_close', (data: { connectionId: string }) => {
      const localSocket = tcpConnections.get(data.connectionId);
      if (localSocket) {
        localSocket.end();
        tcpConnections.delete(data.connectionId);
      }
    });

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel closed${c.reset}`);
      console.log(`  ${c.gray}Handled ${connectionCount} connections${c.reset}`);
      console.log();
      
      // Close all connections
      for (const [, conn] of tcpConnections) {
        conn.end();
      }
      
      socket.disconnect();
      resolve();
    });
  });
}

/**
 * Run UDP tunnel proxy - forward UDP datagrams
 */
async function runUdpTunnelProxy(tunnelId: string, wsUrl: string, localHost: string, localPort: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const url = new URL(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    const baseUrl = `${url.protocol}//${url.host}`;
    const namespace = url.pathname || '/temp-tunnel';
    
    const socket = io(`${baseUrl}${namespace}`, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    // Create local UDP socket for forwarding to local service
    const localUdpSocket = dgram.createSocket('udp4');
    
    // Track UDP "sessions" by remote address for response routing
    // sessionId -> { remoteInfo from server }
    const sessions = new Map<string, { address: string; port: number }>();
    
    let packetCount = 0;

    socket.on('connect', () => {
      socket.emit('register', { tunnelId }, (response: { success: boolean; error?: string }) => {
        if (!response.success) {
          console.log(`  ${c.red}Failed to register: ${response.error}${c.reset}`);
          socket.disconnect();
          resolve();
        }
      });
    });

    socket.on('disconnect', (reason) => {
      localUdpSocket.close();
      if (reason === 'io server disconnect') {
        console.log(`  ${c.yellow}Tunnel expired or closed by server${c.reset}`);
      }
    });

    socket.on('tunnel_expired', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel expired${c.reset}`);
      console.log();
      localUdpSocket.close();
      socket.disconnect();
      resolve();
    });

    socket.on('server_shutdown', (data: { reason?: string; message?: string; reconnectIn?: number }) => {
      console.log();
      console.log(`  ${c.yellow}⚠ Server shutting down${c.reset}`);
      if (data.message) {
        console.log(`  ${c.dim}${data.message}${c.reset}`);
      }
      if (data.reconnectIn) {
        console.log(`  ${c.dim}Reconnect in ${data.reconnectIn} seconds...${c.reset}`);
      }
      console.log();
    });

    // Handle incoming UDP datagram from server (from remote client)
    socket.on('udp_datagram', (data: { 
      sessionId: string; 
      data: string; 
      remoteAddress: string; 
      remotePort: number;
    }) => {
      packetCount++;
      const timestamp = new Date().toLocaleTimeString();
      console.log(`  ${c.gray}[${timestamp}]${c.reset} ${c.cyan}UDP${c.reset} ← ${data.remoteAddress}:${data.remotePort} (${Buffer.from(data.data, 'base64').length} bytes)`);

      // Store session info for response routing
      sessions.set(data.sessionId, { address: data.remoteAddress, port: data.remotePort });

      // Forward to local UDP service
      const buffer = Buffer.from(data.data, 'base64');
      localUdpSocket.send(buffer, localPort, localHost, (err) => {
        if (err) {
          console.log(`  ${c.red}UDP send error: ${err.message}${c.reset}`);
        }
      });
    });

    // Handle response from local UDP service
    localUdpSocket.on('message', (msg: Buffer, rinfo: dgram.RemoteInfo) => {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`  ${c.gray}[${timestamp}]${c.reset} ${c.cyan}UDP${c.reset} → response (${msg.length} bytes)`);

      // Find the most recent session to send response to
      // In practice, you might need more sophisticated session tracking
      const lastSession = Array.from(sessions.entries()).pop();
      if (lastSession) {
        socket.emit('udp_response', {
          sessionId: lastSession[0],
          data: msg.toString('base64'),
        });
      }
    });

    localUdpSocket.on('error', (err) => {
      console.log(`  ${c.red}Local UDP socket error: ${err.message}${c.reset}`);
    });

    // Bind local socket to receive responses
    localUdpSocket.bind();

    // Handle shutdown
    process.on('SIGINT', () => {
      console.log();
      console.log(`  ${c.yellow}Tunnel closed${c.reset}`);
      console.log(`  ${c.gray}Handled ${packetCount} UDP packets${c.reset}`);
      console.log();
      
      localUdpSocket.close();
      socket.disconnect();
      resolve();
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Share Environment (up/join)
// ─────────────────────────────────────────────────────────────────────────────

async function runUpCommand(ports: number[]): Promise<void> {
  console.log();
  console.log(`${c.bold}Private Connect${c.reset} - Share Environment`);
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();

  // Check all ports
  for (const port of ports) {
    process.stdout.write(`  Checking ${c.cyan}localhost:${port}${c.reset}... `);
    const check = await testTcp('localhost', port, 2000);
    if (!check.ok) {
      console.log(`${fail}`);
      console.log();
      console.log(`  ${c.red}Cannot connect to localhost:${port}${c.reset}`);
      console.log(`  ${c.gray}Make sure your service is running${c.reset}`);
      console.log();
      process.exit(1);
    }
    const dbName = DB_PORTS[port];
    console.log(`${ok}${dbName ? ` ${c.dim}(${dbName})${c.reset}` : ''}`);
  }

  console.log();
  process.stdout.write(`  Creating bundle... `);

  try {
    const response = await httpRequest(`${HUB_URL}/v1/tunnels/temporary/bundle`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ports }),
    });

    if (!response.ok) {
      console.log(`${fail}`);
      console.log();
      console.log(`  ${c.red}Failed to create bundle: ${response.status}${c.reset}`);
      console.log();
      process.exit(1);
    }

    console.log(`${ok}`);

    const data = JSON.parse(response.body) as {
      code: string;
      tcpHost: string;
      wsUrl: string;
      ttlMinutes: number;
      expiresAt: string;
      tunnels: Array<{ tunnelId: string; localPort: number; tcpPort: number }>;
    };

    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.bold}Sharing ${ports.length} service${ports.length > 1 ? 's' : ''}:${c.reset}`);
    console.log();

    for (const tunnel of data.tunnels) {
      const dbName = DB_PORTS[tunnel.localPort];
      const label = dbName || `port ${tunnel.localPort}`;
      console.log(`    ${c.cyan}localhost:${tunnel.localPort}${c.reset} ${c.dim}→${c.reset} ${c.green}${data.tcpHost}:${tunnel.tcpPort}${c.reset} ${c.dim}(${label})${c.reset}`);
    }

    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.bold}Share this with your teammate:${c.reset}`);
    console.log();
    console.log(`    ${c.green}${c.bold}npx private-connect join ${data.code}${c.reset}`);
    console.log();
    console.log(`  ${c.dim}Expires in ${data.ttlMinutes} minutes${c.reset}`);
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.dim}Press Ctrl+C to stop sharing${c.reset}`);
    console.log();

    // Adjust WS URL for local dev
    let wsUrl = data.wsUrl;
    if (HUB_URL.includes('localhost')) {
      wsUrl = HUB_URL.replace('http', 'ws') + '/temp-tunnel';
    }

    await runBundleProxy(data.tunnels, wsUrl);

  } catch (err: any) {
    console.log(`${fail}`);
    console.log();
    console.log(`  ${c.red}Error: ${err.message}${c.reset}`);
    console.log();
    process.exit(1);
  }
}

/**
 * Manage WebSocket connections for all tunnels in a bundle (sharer side)
 */
async function runBundleProxy(
  tunnels: Array<{ tunnelId: string; localPort: number; tcpPort: number }>,
  wsUrl: string,
): Promise<void> {
  return new Promise<void>((resolve) => {
    const url = new URL(wsUrl.replace('ws://', 'http://').replace('wss://', 'https://'));
    const baseUrl = `${url.protocol}//${url.host}`;
    const namespace = url.pathname || '/temp-tunnel';

    const sockets: ReturnType<typeof io>[] = [];
    const allTcpConnections = new Map<string, net.Socket>();
    let totalConnections = 0;

    for (const tunnel of tunnels) {
      const socket = io(`${baseUrl}${namespace}`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
      });

      sockets.push(socket);

      socket.on('connect', () => {
        socket.emit('register', { tunnelId: tunnel.tunnelId }, (response: { success: boolean; error?: string }) => {
          if (!response.success) {
            const dbName = DB_PORTS[tunnel.localPort];
            const label = dbName || `port ${tunnel.localPort}`;
            console.log(`  ${c.red}Failed to register ${label}: ${response.error}${c.reset}`);
          }
        });
      });

      socket.on('tunnel_expired', () => {
        const dbName = DB_PORTS[tunnel.localPort];
        const label = dbName || `port ${tunnel.localPort}`;
        console.log(`  ${c.yellow}Tunnel for ${label} expired${c.reset}`);
      });

      socket.on('server_shutdown', (data: { message?: string; reconnectIn?: number }) => {
        console.log(`  ${c.yellow}⚠ Server shutting down${c.reset}`);
        if (data.message) console.log(`  ${c.dim}${data.message}${c.reset}`);
      });

      socket.on('tcp_dial', (data: { connectionId: string; targetHost: string; targetPort: number }) => {
        totalConnections++;
        const timestamp = new Date().toLocaleTimeString();
        const dbName = DB_PORTS[tunnel.localPort];
        const label = dbName || `port ${tunnel.localPort}`;
        console.log(`  ${c.gray}[${timestamp}]${c.reset} ${c.cyan}TCP${c.reset} ${label} ← connection`);

        const localSocket = net.createConnection({
          host: 'localhost',
          port: tunnel.localPort,
        });

        allTcpConnections.set(data.connectionId, localSocket);

        localSocket.on('connect', () => {
          socket.emit('tcp_dial_success', { connectionId: data.connectionId });
        });

        localSocket.on('data', (chunk: Buffer) => {
          socket.emit('tcp_data', {
            connectionId: data.connectionId,
            data: chunk.toString('base64'),
          });
        });

        localSocket.on('close', () => {
          socket.emit('tcp_close', { connectionId: data.connectionId });
          allTcpConnections.delete(data.connectionId);
        });

        localSocket.on('error', (err) => {
          console.log(`  ${c.red}TCP error (${label}): ${err.message}${c.reset}`);
          socket.emit('tcp_close', { connectionId: data.connectionId });
          allTcpConnections.delete(data.connectionId);
        });
      });

      socket.on('tcp_data', (data: { connectionId: string; data: string }) => {
        const localSocket = allTcpConnections.get(data.connectionId);
        if (localSocket) {
          localSocket.write(Buffer.from(data.data, 'base64'));
        }
      });

      socket.on('tcp_close', (data: { connectionId: string }) => {
        const localSocket = allTcpConnections.get(data.connectionId);
        if (localSocket) {
          localSocket.end();
          allTcpConnections.delete(data.connectionId);
        }
      });
    }

    process.on('SIGINT', () => {
      console.log();
      console.log(`  ${c.yellow}Sharing stopped${c.reset}`);
      console.log(`  ${c.gray}Handled ${totalConnections} connections${c.reset}`);
      console.log();

      for (const [, conn] of allTcpConnections) {
        conn.end();
      }
      for (const socket of sockets) {
        socket.disconnect();
      }
      resolve();
    });
  });
}

/**
 * Check if a port is available for binding
 */
function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port, starting from the preferred one
 */
async function findAvailablePort(preferredPort: number): Promise<number> {
  if (await isPortAvailable(preferredPort)) return preferredPort;

  for (let offset = 1; offset <= 100; offset++) {
    const port = preferredPort + offset;
    if (port > 65535) break;
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`No available port near ${preferredPort}`);
}

/**
 * Join a shared environment by code (joiner side).
 * Creates local TCP proxies for each port in the bundle.
 */
async function runJoinCommand(code: string): Promise<void> {
  console.log();
  console.log(`${c.bold}Private Connect${c.reset} - Join Environment`);
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();

  process.stdout.write(`  Fetching bundle ${c.cyan}${code}${c.reset}... `);

  try {
    const response = await httpRequest(`${HUB_URL}/v1/tunnels/temporary/bundle/${code}`, {
      method: 'GET',
    });

    if (!response.ok) {
      console.log(`${fail}`);
      console.log();
      if (response.status === 404) {
        console.log(`  ${c.red}Bundle not found or expired${c.reset}`);
        console.log(`  ${c.gray}Ask your teammate for a new code${c.reset}`);
      } else {
        console.log(`  ${c.red}Error: ${response.status}${c.reset}`);
      }
      console.log();
      process.exit(1);
    }

    console.log(`${ok}`);

    const data = JSON.parse(response.body) as {
      code: string;
      tcpHost: string;
      expiresAt: string;
      tunnels: Array<{ localPort: number; tcpPort: number; connected: boolean }>;
    };

    console.log();
    console.log(`  ${c.bold}Connecting to ${data.tunnels.length} service${data.tunnels.length > 1 ? 's' : ''}:${c.reset}`);
    console.log();

    const servers: net.Server[] = [];
    const portMappings: Array<{ localPort: number; actualPort: number; label: string }> = [];

    for (const tunnel of data.tunnels) {
      const actualPort = await findAvailablePort(tunnel.localPort);
      const dbName = DB_PORTS[tunnel.localPort];
      const label = dbName || `port ${tunnel.localPort}`;
      const portNote = actualPort !== tunnel.localPort
        ? ` ${c.yellow}(${tunnel.localPort} busy → ${actualPort})${c.reset}`
        : '';

      const server = net.createServer((clientSocket) => {
        const remoteSocket = net.createConnection({
          host: data.tcpHost,
          port: tunnel.tcpPort,
        });

        remoteSocket.on('connect', () => {
          clientSocket.pipe(remoteSocket);
          remoteSocket.pipe(clientSocket);
        });

        remoteSocket.on('error', () => {
          clientSocket.destroy();
        });

        clientSocket.on('error', () => {
          remoteSocket.destroy();
        });
      });

      await new Promise<void>((res, rej) => {
        server.on('error', rej);
        server.listen(actualPort, '127.0.0.1', () => res());
      });

      servers.push(server);
      portMappings.push({ localPort: tunnel.localPort, actualPort, label });

      console.log(`    ${c.green}localhost:${actualPort}${c.reset} ${c.dim}→${c.reset} ${label}${portNote}`);
    }

    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.green}${c.bold}Connected!${c.reset} Use these in your app:`);
    console.log();

    for (const mapping of portMappings) {
      console.log(`    ${mapping.label}: ${c.cyan}localhost:${mapping.actualPort}${c.reset}`);
    }

    const expiresIn = Math.max(0, Math.floor((new Date(data.expiresAt).getTime() - Date.now()) / 60000));
    console.log();
    console.log(`  ${c.dim}Expires in ${expiresIn} minutes${c.reset}`);
    console.log();
    console.log(`  ${c.dim}Press Ctrl+C to disconnect${c.reset}`);
    console.log();

    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        console.log();
        console.log(`  ${c.yellow}Disconnected${c.reset}`);
        console.log();
        for (const server of servers) {
          server.close();
        }
        resolve();
      });
    });

  } catch (err: any) {
    console.log(`${fail}`);
    console.log();
    console.log(`  ${c.red}Error: ${err.message}${c.reset}`);
    console.log();
    process.exit(1);
  }
}

function parseTunnelTarget(target: string): { host: string; port: number } {
  // Handle just port number
  if (/^\d+$/.test(target)) {
    return { host: 'localhost', port: parseInt(target, 10) };
  }
  
  // Handle host:port
  const parts = target.split(':');
  if (parts.length === 2) {
    return { host: parts[0], port: parseInt(parts[1], 10) };
  }
  
  // Default to localhost with provided port
  return { host: 'localhost', port: parseInt(target, 10) || 3000 };
}

/**
 * List tunnels from local store (tunnels created by this CLI on this machine)
 */
async function listTunnels(): Promise<void> {
  console.log();
  console.log(`  ${c.cyan}${c.bold}Private Connect${c.reset} ${c.dim}Tracked Tunnels${c.reset}`);
  console.log();

  const store = loadTunnelStore();
  if (store.length === 0) {
    console.log(`  ${c.dim}No tunnels tracked. Create a tunnel with \`connect tunnel <port>\` to see it here.${c.reset}`);
  } else {
    console.log(`  ${c.green}${store.length}${c.reset} tunnel${store.length > 1 ? 's' : ''} in local store`);
    console.log();
    for (const t of store) {
      const expiresIn = Math.max(0, Math.floor((new Date(t.expiresAt).getTime() - Date.now()) / 60000));
      console.log(`  ${c.cyan}${t.tunnelId}${c.reset}`);
      console.log(`    Type: ${t.type}  Expires: ${expiresIn}m`);
      if (t.subdomain) {
        console.log(`    Subdomain: ${c.dim}${t.subdomain}${c.reset}`);
      }
      console.log();
    }
  }
  console.log();
}

/**
 * Close a tunnel by ID (uses management token from local store)
 */
async function closeTunnel(tunnelId: string, tokenOverride?: string): Promise<void> {
  console.log();
  console.log(`  ${c.cyan}${c.bold}Private Connect${c.reset} ${c.dim}Close Tunnel${c.reset}`);
  console.log();

  const hubUrl = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';
  const token = tokenOverride || loadTunnelStore().find((t) => t.tunnelId === tunnelId)?.managementToken;
  if (!token) {
    console.error(`  ${fail} Tunnel ${tunnelId} not in local store. Use the management token from when you created it:`);
    console.error(`  ${c.dim}  connect tunnel close ${tunnelId} --token <managementToken>${c.reset}`);
    console.log();
    return;
  }

  try {
    await new Promise<void>((resolve, reject) => {
      const url = new URL(`${hubUrl}/v1/tunnels/temporary/${tunnelId}`);
      const protocol = url.protocol === 'https:' ? https : http;
      const req = protocol.request(
        url.href,
        {
          method: 'DELETE',
          headers: { 'X-Tunnel-Management-Token': token },
        },
        (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            if (res.statusCode === 200) {
              resolve();
            } else if (res.statusCode === 403) {
              reject(new Error('Invalid management token'));
            } else if (res.statusCode === 404) {
              reject(new Error('Tunnel not found or already expired'));
            } else {
              reject(new Error(`Server error: ${res.statusCode}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.setTimeout(10000, () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      req.end();
    });
    removeTunnelFromStore(tunnelId);
    console.log(`  ${ok} Tunnel ${c.cyan}${tunnelId}${c.reset} closed`);
  } catch (err: any) {
    console.error(`  ${fail} ${err.message}`);
  }
  console.log();
}

/**
 * Close all tunnels in local store
 */
async function closeAllTunnels(): Promise<void> {
  console.log();
  console.log(`  ${c.cyan}${c.bold}Private Connect${c.reset} ${c.dim}Close All Tunnels${c.reset}`);
  console.log();

  const hubUrl = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';
  const store = loadTunnelStore();
  if (store.length === 0) {
    console.log(`  ${c.dim}No tunnels in local store to close${c.reset}`);
    console.log();
    return;
  }
  let closed = 0;
  for (const t of store) {
    try {
      await new Promise<void>((resolve, reject) => {
        const url = new URL(`${hubUrl}/v1/tunnels/temporary/${t.tunnelId}`);
        const protocol = url.protocol === 'https:' ? https : http;
        const req = protocol.request(
          url.href,
          { method: 'DELETE', headers: { 'X-Tunnel-Management-Token': t.managementToken } },
          (res) => {
            res.on('data', () => {});
            res.on('end', () => {
              if (res.statusCode === 200) {
                resolve();
              } else {
                reject(new Error(`Failed: ${res.statusCode}`));
              }
            });
          },
        );
        req.on('error', reject);
        req.end();
      });
      removeTunnelFromStore(t.tunnelId);
      closed++;
      console.log(`  ${ok} Closed ${c.cyan}${t.tunnelId}${c.reset}`);
    } catch (err: any) {
      console.log(`  ${fail} Failed to close ${t.tunnelId}: ${err.message}`);
    }
  }
  console.log();
  console.log(`  ${c.green}Closed ${closed}/${store.length} tunnels${c.reset}`);
  console.log();
}

/**
 * One-command OpenClaw (formerly Moltbot) setup
 */
async function setupMoltbot(): Promise<void> {
  console.log();
  console.log(`  ${c.cyan}${c.bold}Private Connect${c.reset} ${c.dim}OpenClaw Setup${c.reset}`);
  console.log();
  console.log(`  This command sets up Private Connect for remote OpenClaw (formerly Moltbot) access.`);
  console.log();
  
  // Check if OpenClaw gateway is running
  console.log(`  ${c.dim}Checking for OpenClaw gateway...${c.reset}`);
  
  const gatewayRunning = await testTcp('localhost', 18789, 2000);
  
  if (!gatewayRunning.ok) {
    console.log(`  ${warn} OpenClaw gateway not found on localhost:18789`);
    console.log();
    console.log(`  ${c.bold}To install OpenClaw:${c.reset}`);
    console.log(`    Visit ${c.cyan}https://openclaw.ai${c.reset}`);
    console.log();
    console.log(`  ${c.bold}After OpenClaw is running, run this command again.${c.reset}`);
    console.log();
    return;
  }
  
  console.log(`  ${ok} OpenClaw gateway detected on localhost:18789`);
  console.log();
  
  // Create a temporary tunnel for the gateway
  console.log(`  ${c.dim}Exposing OpenClaw gateway...${c.reset}`);
  console.log();
  
  await createTemporaryTunnel({ host: 'localhost', port: 18789, tcp: false });
  
  console.log();
  console.log(`  ${c.bold}Next steps:${c.reset}`);
  console.log();
  console.log(`  1. Install the full CLI for persistent tunnels:`);
  console.log(`     ${c.cyan}curl -fsSL https://privateconnect.co/install.sh | bash${c.reset}`);
  console.log();
  console.log(`  2. Authenticate and set up daemon:`);
  console.log(`     ${c.cyan}connect up${c.reset}`);
  console.log();
  console.log(`  3. Expose gateway permanently:`);
  console.log(`     ${c.cyan}connect expose localhost:18789 --name openclaw${c.reset}`);
  console.log();
}

/**
 * Generate QR code for mobile pairing
 */
async function showPairingQR(): Promise<void> {
  console.log();
  console.log(`  ${c.cyan}${c.bold}Private Connect${c.reset} ${c.dim}Mobile Pairing${c.reset}`);
  console.log();
  
  const hubUrl = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';
  
  try {
    // Create a pairing session
    const pairingCode = randomBytes(16).toString('hex').slice(0, 8).toUpperCase();
    const pairingUrl = `${hubUrl.replace('api.', '')}/pair/${pairingCode}`;
    
    console.log(`  Scan this QR code with your phone to pair:`);
    console.log();
    
    // Generate ASCII QR code (simple representation)
    // In production, you'd use a proper QR library
    const qrAscii = generateAsciiQR(pairingUrl);
    console.log(qrAscii);
    
    console.log();
    console.log(`  Or visit: ${c.cyan}${pairingUrl}${c.reset}`);
    console.log();
    console.log(`  Pairing code: ${c.bold}${pairingCode}${c.reset}`);
    console.log();
    console.log(`  ${c.dim}This code expires in 5 minutes.${c.reset}`);
    console.log();
    
    // In a real implementation, you'd poll for pairing completion
    console.log(`  ${c.dim}Waiting for device to pair...${c.reset}`);
    console.log(`  ${c.dim}Press Ctrl+C to cancel${c.reset}`);
    console.log();
    
  } catch (err: any) {
    console.error(`  ${fail} Failed to create pairing session: ${err.message}`);
  }
}

/**
 * Generate a simple ASCII QR code representation
 * In production, use a proper QR library like 'qrcode-terminal'
 */
function generateAsciiQR(data: string): string {
  // Simple box representation - in production use qrcode-terminal package
  const lines = [
    '  ┌──────────────────────────────────────┐',
    '  │  ▄▄▄▄▄▄▄  ▄    ▄ ▄▄▄▄▄  ▄▄▄▄▄▄▄     │',
    '  │  █     █  ██▄███ █   █  █     █     │',
    '  │  █ ███ █  ▄▄ █▄▄ █▀▀▀█  █ ███ █     │',
    '  │  █ ███ █  █▄██▄█ ▀▄▄▄▀  █ ███ █     │',
    '  │  █ ███ █  ▀▄  ▄▀ ███▀█  █ ███ █     │',
    '  │  █     █  ▀███▀▀ █  ▀█  █     █     │',
    '  │  ▀▀▀▀▀▀▀  ▀ ▀ ▀ ▀ ▀ ▀▀  ▀▀▀▀▀▀▀     │',
    '  │           Scan to pair              │',
    '  └──────────────────────────────────────┘',
  ];
  return lines.join('\n');
}

// Main
// ─────────────────────────────────────────────────────────────────────────────
// Scan — detect private services running locally
// ─────────────────────────────────────────────────────────────────────────────

interface ScannedService {
  port: number;
  host: string;
  type: 'http' | 'https' | 'redis' | 'postgres' | 'mysql' | 'mongodb' | 'ssh' | 'unknown';
  name: string;
  title?: string;
}

const SCAN_PORTS: { port: number; likely: ScannedService['type'] }[] = [
  { port: 80,    likely: 'http'     },
  { port: 443,   likely: 'https'    },
  { port: 3000,  likely: 'http'     },
  { port: 3001,  likely: 'http'     },
  { port: 4000,  likely: 'http'     },
  { port: 5000,  likely: 'http'     },
  { port: 5173,  likely: 'http'     },
  { port: 5174,  likely: 'http'     },
  { port: 8000,  likely: 'http'     },
  { port: 8080,  likely: 'http'     },
  { port: 8443,  likely: 'https'    },
  { port: 9000,  likely: 'http'     },
  { port: 5432,  likely: 'postgres' },
  { port: 3306,  likely: 'mysql'    },
  { port: 27017, likely: 'mongodb'  },
  { port: 6379,  likely: 'redis'    },
  { port: 22,    likely: 'ssh'      },
];

const SCAN_TIMEOUT = 800;

async function scanPortOpen(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const t = setTimeout(() => { socket.destroy(); resolve(false); }, SCAN_TIMEOUT);
    socket.on('connect', () => { clearTimeout(t); socket.destroy(); resolve(true); });
    socket.on('error',   () => { clearTimeout(t); socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function scanProbeRedis(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const t = setTimeout(() => { socket.destroy(); resolve(false); }, SCAN_TIMEOUT);
    socket.on('connect', () => { socket.write('PING\r\n'); });
    socket.on('data',    (d) => { clearTimeout(t); socket.destroy(); resolve(d.toString().includes('+PONG')); });
    socket.on('error',   () => { clearTimeout(t); socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function scanProbePostgres(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const t = setTimeout(() => { socket.destroy(); resolve(false); }, SCAN_TIMEOUT);
    socket.on('connect', () => {
      const buf = Buffer.alloc(8);
      buf.writeInt32BE(8, 0);
      buf.writeInt32BE(80877103, 4);
      socket.write(buf);
    });
    socket.on('data',  (d) => { clearTimeout(t); socket.destroy(); resolve(d[0] === 83 || d[0] === 78); });
    socket.on('error', () => { clearTimeout(t); socket.destroy(); resolve(false); });
    socket.connect(port, host);
  });
}

async function scanProbeHttp(host: string, port: number, useHttps: boolean): Promise<{ title?: string } | null> {
  return new Promise((resolve) => {
    const protocol = useHttps ? https : http;
    const t = setTimeout(() => resolve(null), SCAN_TIMEOUT);
    const req = protocol.request(
      { hostname: host, port, path: '/', method: 'GET', timeout: SCAN_TIMEOUT, rejectUnauthorized: false },
      (res) => {
        clearTimeout(t);
        let body = '';
        res.on('data', (chunk) => { body += chunk.toString().slice(0, 500); });
        res.on('end', () => {
          const m = body.match(/<title[^>]*>([^<]+)<\/title>/i);
          resolve({ title: m?.[1]?.trim() });
        });
      }
    );
    req.on('error',   () => { clearTimeout(t); resolve(null); });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.end();
  });
}

function scanServiceName(type: ScannedService['type'], port: number, title?: string): string {
  if (title) {
    return title.replace(/[^\w\s-]/g, '').trim().toLowerCase().replace(/\s+/g, '-').slice(0, 30);
  }
  const names: Record<string, string> = {
    http: 'web', https: 'web-secure', redis: 'redis', postgres: 'postgres',
    mysql: 'mysql', mongodb: 'mongodb', ssh: 'ssh', unknown: 'service',
  };
  return `${names[type] || 'service'}-${port}`;
}

function scanServiceIcon(type: ScannedService['type']): string {
  const icons: Record<string, string> = {
    http: '🌐', https: '🔒', redis: '📦', postgres: '🐘',
    mysql: '🐬', mongodb: '🍃', ssh: '🔑', unknown: '❓',
  };
  return icons[type] || '❓';
}

async function runScan(customPorts?: number[]): Promise<void> {
  const host = 'localhost';
  const portsToScan = customPorts
    ? customPorts.map((p) => ({ port: p, likely: 'unknown' as const }))
    : SCAN_PORTS;

  process.stdout.write(`\n${c.bold}Private Connect${c.reset} ${c.dim}— Private Service Detector${c.reset}\n\n`);
  process.stdout.write(`${c.dim}Scanning ${host} for private services...${c.reset}\n`);

  const found: ScannedService[] = [];

  // Scan in batches of 8 for speed
  const batchSize = 8;
  for (let i = 0; i < portsToScan.length; i += batchSize) {
    const batch = portsToScan.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map(async ({ port, likely }) => {
        const open = await scanPortOpen(host, port);
        if (!open) return null;

        let type: ScannedService['type'] = likely;
        let title: string | undefined;

        if (likely === 'redis' || port === 6379) {
          if (await scanProbeRedis(host, port)) type = 'redis';
        } else if (likely === 'postgres' || port === 5432) {
          if (await scanProbePostgres(host, port)) type = 'postgres';
        } else if (likely === 'https' || port === 443 || port === 8443) {
          const r = await scanProbeHttp(host, port, true);
          if (r) { type = 'https'; title = r.title; }
        } else if (likely === 'http' || [80, 3000, 3001, 4000, 5000, 5173, 5174, 8000, 8080, 9000].includes(port)) {
          const r = await scanProbeHttp(host, port, false) ?? await scanProbeHttp(host, port, true);
          if (r) { type = 'http'; title = r.title; }
        }

        return { port, host, type, name: scanServiceName(type, port, title), title } as ScannedService;
      })
    );
    found.push(...results.filter((r): r is ScannedService => r !== null));
  }

  if (found.length === 0) {
    console.log(`\n  ${c.dim}No services detected on common ports.${c.reset}`);
    console.log(`  ${c.dim}Try: npx private-connect scan --ports 8080,9090,4000${c.reset}\n`);
    return;
  }

  console.log(`\n${c.bold}Detected private services:${c.reset}\n`);
  for (const svc of found) {
    const icon = scanServiceIcon(svc.type);
    const label = svc.title ? ` ${c.dim}(${svc.title})${c.reset}` : '';
    console.log(`  ${icon} ${c.cyan}${svc.name}${c.reset}${label}`);
    console.log(`     ${c.dim}${svc.host}:${svc.port} · ${svc.type}${c.reset}`);
  }

  console.log(`\n${c.bold}Share them instantly with:${c.reset}\n`);
  for (const svc of found) {
    console.log(`  ${c.green}connect expose ${svc.host}:${svc.port}${c.reset}  ${c.dim}# ${svc.name}${c.reset}`);
  }

  console.log(`\n${c.dim}Or install Private Connect for permanent access:${c.reset}`);
  console.log(`  ${c.cyan}curl -fsSL https://privateconnect.co/install.sh | bash${c.reset}\n`);
}

// ─────────────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

// Track usage (non-blocking)
trackUsage(args[0] || 'help');

if (args[0] === 'scan') {
  const portsFlag = args.find(a => a.startsWith('--ports=') || a.startsWith('--ports'));
  let customPorts: number[] | undefined;
  if (portsFlag) {
    const val = portsFlag.includes('=') ? portsFlag.split('=')[1] : args[args.indexOf(portsFlag) + 1];
    customPorts = val?.split(',').map(Number).filter(n => n > 0 && n < 65536);
  }
  runScan(customPorts).catch(console.error);
} else if (args[0] === 'up') {
  const ports = args.slice(1).filter(a => /^\d+$/.test(a)).map(Number);
  if (ports.length === 0) {
    console.error(`${c.red}Error: At least one port required${c.reset}`);
    console.error(`Usage: npx private-connect up 3000 5432 6379`);
    process.exit(1);
  }
  runUpCommand(ports).catch(console.error);
} else if (args[0] === 'join') {
  if (!args[1]) {
    console.error(`${c.red}Error: Join code required${c.reset}`);
    console.error(`Usage: npx private-connect join <code>`);
    process.exit(1);
  }
  runJoinCommand(args[1]).catch(console.error);
} else if (args[0] === 'test' || args[0] === 'check') {
  if (!args[1]) {
    console.error(`${c.red}Error: Target required${c.reset}`);
    console.error(`Usage: npx private-connect ${args[0]} <host:port>`);
    process.exit(1);
  }
  runTest(args[1]).catch(console.error);
} else if (args[0] === 'tunnel') {
  if (!args[1]) {
    console.error(`${c.red}Error: Port required${c.reset}`);
    console.error(`Usage: npx private-connect tunnel <port>`);
    console.error(`       npx private-connect tunnel localhost:3000`);
    console.error(`       npx private-connect tunnel 4096 --tcp`);
    console.error(`       npx private-connect tunnel 27015 --udp`);
    console.error(`       npx private-connect tunnel 3000 --slug myapp --ttl 1440`);
    process.exit(1);
  }
  const { host, port } = parseTunnelTarget(args[1]);
  const tcp = args.includes('--tcp') || args.includes('-t');
  const udp = args.includes('--udp') || args.includes('-u');
  const slugIdx = args.indexOf('--slug');
  const slug = slugIdx >= 0 && args[slugIdx + 1] ? args[slugIdx + 1] : undefined;
  const ttlIdx = args.indexOf('--ttl');
  const ttlArg = ttlIdx >= 0 && args[ttlIdx + 1] ? args[ttlIdx + 1] : undefined;
  const ttl = ttlArg ? parseInt(ttlArg, 10) : 120;
  if (ttlArg && (isNaN(ttl) || ttl < 1)) {
    console.error(`${c.red}Error: --ttl must be a positive number (minutes)${c.reset}`);
    process.exit(1);
  }
  if (tcp && udp) {
    console.error(`${c.red}Error: Cannot use both --tcp and --udp${c.reset}`);
    process.exit(1);
  }
  createTemporaryTunnel({ host, port, tcp, udp, slug, ttl }).catch(console.error);
} else if (args[0] === 'list' || args[0] === 'ls') {
  listTunnels().catch(console.error);
} else if (args[0] === 'close' || args[0] === 'kill') {
  if (!args[1]) {
    console.error(`${c.red}Error: Tunnel ID required${c.reset}`);
    console.error(`Usage: npx private-connect close <tunnelId>`);
    console.error(`       npx private-connect close <tunnelId> --token <managementToken>`);
    console.error(`       npx private-connect close --all`);
    process.exit(1);
  }
  if (args[1] === '--all' || args[1] === '-a') {
    closeAllTunnels().catch(console.error);
  } else {
    const tokenIdx = args.indexOf('--token');
    const token = tokenIdx >= 0 && args[tokenIdx + 1] ? args[tokenIdx + 1] : undefined;
    closeTunnel(args[1], token).catch(console.error);
  }
} else if (args[0] === 'setup-openclaw' || args[0] === 'openclaw-setup' || args[0] === 'setup-moltbot' || args[0] === 'moltbot-setup') {
  setupMoltbot().catch(console.error);
} else if (args[0] === 'pair' || args[0] === 'qr') {
  showPairingQR().catch(console.error);
} else if (!RESERVED_COMMANDS.includes(args[0]) && args[1] && /^\d+$/.test(args[1].split(':').pop() || '')) {
  // <product-name> <port|host:port> — webhook tunnel for a specific provider
  const providerName = args[0];
  const { host, port } = parseTunnelTarget(args[1]);
  createTemporaryTunnel({ host, port, provider: providerName }).catch(console.error);
} else {
  // Default to test if just a target is provided
  runTest(args[0]).catch(console.error);
}

