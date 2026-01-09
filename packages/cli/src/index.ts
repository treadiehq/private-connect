#!/usr/bin/env node
/**
 * Private Connect CLI
 * 
 * Zero-friction connectivity testing. No signup required.
 * 
 * Usage:
 *   npx private-connect test vault.internal:8200
 *   npx private-connect test https://api.example.com
 */

import * as net from 'net';
import * as tls from 'tls';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';

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
${c.bold}Private Connect${c.reset} - Test connectivity to any service

${c.bold}Usage:${c.reset}
  npx private-connect test <target>

${c.bold}Examples:${c.reset}
  npx private-connect test vault.internal:8200
  npx private-connect test https://api.example.com
  npx private-connect test postgres.prod:5432

${c.bold}What it checks:${c.reset}
  • TCP reachability
  • TLS validation  
  • HTTP response (if applicable)
  • Latency

No signup. No account. Just diagnostics.

${c.dim}For full features: https://privateconnect.co${c.reset}
`);
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
} else {
  // Default to test if just a target is provided
  runTest(args[0]).catch(console.error);
}

