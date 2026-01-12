#!/usr/bin/env node
/**
 * Private Connect CLI
 * 
 * Zero-friction connectivity testing and temporary tunnels. No signup required.
 * 
 * Usage:
 *   npx private-connect test vault.internal:8200
 *   npx private-connect tunnel 3000
 */

import * as net from 'net';
import * as tls from 'tls';
import * as https from 'https';
import * as http from 'http';
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
  gray: '\x1b[90m',
};

const ok = `${c.green}✓${c.reset}`;
const fail = `${c.red}✗${c.reset}`;
const warn = `${c.yellow}⚠${c.reset}`;

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
  test <target>      Test connectivity to any service
  tunnel <port>      Create a temporary public tunnel

${c.bold}Examples:${c.reset}
  npx private-connect test vault.internal:8200
  npx private-connect test https://api.example.com
  npx private-connect tunnel 3000
  npx private-connect tunnel localhost:8080

${c.bold}Tunnel:${c.reset}
  • No signup required
  • Auto-expires in 2 hours
  • Get a public URL instantly

${c.bold}Test:${c.reset}
  • TCP reachability
  • TLS validation  
  • HTTP response
  • Latency

${c.dim}For permanent tunnels: https://privateconnect.co${c.reset}
`);
}

// ─────────────────────────────────────────────────────────────────────────────
// Temporary Tunnel
// ─────────────────────────────────────────────────────────────────────────────

const HUB_URL = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';
const TUNNEL_DOMAIN = process.env.CONNECT_TUNNEL_DOMAIN || 'tunnel.privateconnect.co';

interface TunnelOptions {
  host: string;
  port: number;
  ttl?: number; // minutes, default 120
}

async function createTemporaryTunnel(options: TunnelOptions): Promise<void> {
  const { host, port, ttl = 120 } = options;
  
  console.log();
  console.log(`${c.bold}Private Connect${c.reset} - Temporary Tunnel`);
  console.log(`${c.gray}────────────────────────────────────${c.reset}`);
  console.log();
  
  // Check if local service is running
  process.stdout.write(`  Checking ${c.cyan}${host}:${port}${c.reset}... `);
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
  
  // Generate a temporary tunnel ID
  const tunnelId = randomBytes(6).toString('hex');
  const publicUrl = `https://${tunnelId}.${TUNNEL_DOMAIN}`;
  
  // Request tunnel from hub
  process.stdout.write(`  Requesting tunnel... `);
  
  try {
    const response = await httpRequest(`${HUB_URL}/v1/tunnels/temporary`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tunnelId,
        localHost: host,
        localPort: port,
        ttlMinutes: ttl,
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
      tunnel: { tunnelId: string; publicUrl: string; wsUrl: string; expiresAt: string; ttlMinutes: number } 
    };
    
    // For local dev, adjust the WS URL
    let wsUrl = data.tunnel.wsUrl;
    if (HUB_URL.includes('localhost')) {
      wsUrl = HUB_URL.replace('http', 'ws') + '/temp-tunnel';
    }
    
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.bold}Local:${c.reset}   ${c.cyan}${host}:${port}${c.reset}`);
    console.log(`  ${c.bold}Public:${c.reset}  ${c.green}${data.tunnel.publicUrl}${c.reset}`);
    console.log(`  ${c.bold}Expires:${c.reset} ${data.tunnel.ttlMinutes} minutes`);
    console.log();
    console.log(`${c.gray}────────────────────────────────────${c.reset}`);
    console.log();
    console.log(`  ${c.dim}Press Ctrl+C to stop${c.reset}`);
    console.log();
    
    // Keep connection alive and handle incoming requests
    await runTunnelProxy(data.tunnel.tunnelId, wsUrl, host, port);
    
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
      const timestamp = new Date().toLocaleTimeString();
      console.log(`  ${c.gray}[${timestamp}]${c.reset} ${c.cyan}${data.method}${c.reset} ${data.path}`);

      try {
        // Forward request to local service
        const response = await forwardToLocal(localHost, localPort, data);
        
        // Send response back to hub
        socket.emit('http_response', {
          requestId: data.requestId,
          status: response.status,
          headers: response.headers,
          body: response.body,
        });
      } catch (err: any) {
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
      console.log(`  ${c.gray}Handled ${requestCount} requests${c.reset}`);
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

// Main
const args = process.argv.slice(2);

if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
  printHelp();
  process.exit(0);
}

if (args[0] === 'test') {
  if (!args[1]) {
    console.error(`${c.red}Error: Target required${c.reset}`);
    console.error(`Usage: npx private-connect test <host:port>`);
    process.exit(1);
  }
  runTest(args[1]).catch(console.error);
} else if (args[0] === 'tunnel') {
  if (!args[1]) {
    console.error(`${c.red}Error: Port required${c.reset}`);
    console.error(`Usage: npx private-connect tunnel <port>`);
    console.error(`       npx private-connect tunnel localhost:3000`);
    process.exit(1);
  }
  const { host, port } = parseTunnelTarget(args[1]);
  createTemporaryTunnel({ host, port }).catch(console.error);
} else {
  // Default to test if just a target is provided
  runTest(args[0]).catch(console.error);
}

