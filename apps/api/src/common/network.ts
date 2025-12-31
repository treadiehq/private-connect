import * as http from 'http';
import * as https from 'https';
import * as net from 'net';
import * as tls from 'tls';
import { SecureLogger } from './security';

const logger = new SecureLogger('Network');

/**
 * Network resilience configuration
 */
export const NETWORK_CONFIG = {
  // Connection timeouts
  CONNECT_TIMEOUT_MS: 10000,      // Initial connection timeout
  DIAL_TIMEOUT_MS: 30000,         // Time to wait for agent dial (increased for slow networks)
  PROXY_REQUEST_TIMEOUT_MS: 30000, // HTTP proxy request timeout
  TLS_HANDSHAKE_TIMEOUT_MS: 10000, // TLS handshake timeout
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
  RETRY_BACKOFF_MULTIPLIER: 2,
  
  // Buffer limits
  MAX_BUFFER_SIZE: 1024 * 1024, // 1MB max buffer for pending data
  
  // Keep-alive
  SOCKET_KEEP_ALIVE_MS: 30000,
};

/**
 * Error classification for retry decisions
 */
export enum NetworkErrorType {
  TRANSIENT = 'TRANSIENT',     // Retry-able errors (timeout, connection reset)
  PERMANENT = 'PERMANENT',     // Non-retry-able errors (auth failed, not found)
  BLOCKED = 'BLOCKED',         // Proxy/firewall blocked
  TLS_ERROR = 'TLS_ERROR',     // Certificate/handshake issues
}

/**
 * Classify a network error for retry decision
 */
export function classifyNetworkError(error: Error & { code?: string }): NetworkErrorType {
  const code = error.code || '';
  const message = error.message || '';
  
  // Transient errors - worth retrying
  const transientCodes = [
    'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ENOTFOUND',
    'ENETUNREACH', 'EHOSTUNREACH', 'EAI_AGAIN', 'EPIPE',
  ];
  
  if (transientCodes.includes(code)) {
    return NetworkErrorType.TRANSIENT;
  }
  
  // Proxy/firewall blocked
  if (code === 'ECONNREFUSED' || message.includes('proxy') || message.includes('blocked')) {
    return NetworkErrorType.BLOCKED;
  }
  
  // TLS errors
  const tlsErrors = [
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'SELF_SIGNED_CERT_IN_CHAIN',
    'DEPTH_ZERO_SELF_SIGNED_CERT', 'CERT_HAS_EXPIRED',
    'ERR_TLS_CERT_ALTNAME_INVALID', 'HOSTNAME_MISMATCH',
  ];
  
  if (tlsErrors.includes(code) || message.includes('TLS') || message.includes('certificate')) {
    return NetworkErrorType.TLS_ERROR;
  }
  
  // Default to transient for unknown errors (be optimistic)
  return NetworkErrorType.TRANSIENT;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    delayMs?: number;
    backoffMultiplier?: number;
    onRetry?: (attempt: number, error: Error) => void;
    shouldRetry?: (error: Error) => boolean;
  } = {}
): Promise<T> {
  const {
    maxRetries = NETWORK_CONFIG.MAX_RETRIES,
    delayMs = NETWORK_CONFIG.RETRY_DELAY_MS,
    backoffMultiplier = NETWORK_CONFIG.RETRY_BACKOFF_MULTIPLIER,
    onRetry,
    shouldRetry = (err) => classifyNetworkError(err as Error & { code?: string }) === NetworkErrorType.TRANSIENT,
  } = options;
  
  let lastError: Error | undefined;
  let currentDelay = delayMs;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxRetries || !shouldRetry(lastError)) {
        throw lastError;
      }
      
      if (onRetry) {
        onRetry(attempt + 1, lastError);
      }
      
      await sleep(currentDelay);
      currentDelay *= backoffMultiplier;
    }
  }
  
  throw lastError;
}

/**
 * Create a TCP connection with proper timeout handling
 */
export function createConnection(options: {
  host: string;
  port: number;
  timeoutMs?: number;
}): Promise<net.Socket> {
  return new Promise((resolve, reject) => {
    const { host, port, timeoutMs = NETWORK_CONFIG.CONNECT_TIMEOUT_MS } = options;
    
    const socket = net.createConnection({ host, port });
    
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`Connection timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    socket.on('connect', () => {
      clearTimeout(timeout);
      socket.setKeepAlive(true, NETWORK_CONFIG.SOCKET_KEEP_ALIVE_MS);
      resolve(socket);
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Create a TLS connection with proper timeout and error handling
 */
export function createTlsConnection(options: {
  host: string;
  port: number;
  servername?: string;
  timeoutMs?: number;
  rejectUnauthorized?: boolean;
}): Promise<tls.TLSSocket> {
  return new Promise((resolve, reject) => {
    const { 
      host, 
      port, 
      servername = host,
      timeoutMs = NETWORK_CONFIG.TLS_HANDSHAKE_TIMEOUT_MS,
      rejectUnauthorized = true,
    } = options;
    
    const socket = tls.connect({
      host,
      port,
      servername,
      rejectUnauthorized,
    });
    
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error(`TLS handshake timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    socket.on('secureConnect', () => {
      clearTimeout(timeout);
      resolve(socket);
    });
    
    socket.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * HTTP request options with resilience features
 */
export interface ResilientRequestOptions {
  hostname: string;
  port: number;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Buffer;
  timeoutMs?: number;
  useHttps?: boolean;
  rejectUnauthorized?: boolean;
  maxRetries?: number;
}

/**
 * HTTP response from resilient request
 */
export interface ResilientResponse {
  statusCode: number;
  statusMessage: string;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
  latencyMs: number;
}

/**
 * Make an HTTP(S) request with retry logic and proper timeout handling
 */
export async function resilientRequest(
  options: ResilientRequestOptions
): Promise<ResilientResponse> {
  const {
    hostname,
    port,
    path = '/',
    method = 'GET',
    headers = {},
    body,
    timeoutMs = NETWORK_CONFIG.PROXY_REQUEST_TIMEOUT_MS,
    useHttps = false,
    rejectUnauthorized = true,
    maxRetries = NETWORK_CONFIG.MAX_RETRIES,
  } = options;
  
  return withRetry(
    () => makeRequest({ hostname, port, path, method, headers, body, timeoutMs, useHttps, rejectUnauthorized }),
    {
      maxRetries,
      onRetry: (attempt, err) => {
        logger.warn(`Request retry ${attempt}/${maxRetries} for ${hostname}:${port}${path}: ${err.message}`);
      },
    }
  );
}

/**
 * Internal function to make a single HTTP request
 */
function makeRequest(options: {
  hostname: string;
  port: number;
  path: string;
  method: string;
  headers: Record<string, string>;
  body?: string | Buffer;
  timeoutMs: number;
  useHttps: boolean;
  rejectUnauthorized: boolean;
}): Promise<ResilientResponse> {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const protocol = options.useHttps ? https : http;
    
    const req = protocol.request(
      {
        hostname: options.hostname,
        port: options.port,
        path: options.path,
        method: options.method,
        headers: options.headers,
        timeout: options.timeoutMs,
        rejectUnauthorized: options.rejectUnauthorized,
      },
      (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk) => chunks.push(chunk));
        
        res.on('end', () => {
          resolve({
            statusCode: res.statusCode || 0,
            statusMessage: res.statusMessage || '',
            headers: res.headers,
            body: Buffer.concat(chunks),
            latencyMs: Date.now() - startTime,
          });
        });
        
        res.on('error', reject);
      }
    );
    
    req.on('error', reject);
    
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Request timeout after ${options.timeoutMs}ms`));
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

/**
 * Diagnostic information for connection issues
 */
export interface ConnectionDiagnostic {
  stage: 'dns' | 'tcp' | 'tls' | 'http';
  success: boolean;
  error?: string;
  errorType?: NetworkErrorType;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

/**
 * Run connection diagnostics with detailed error information
 * Useful for debugging "why can't I connect?" issues
 */
export async function diagnoseConnection(options: {
  host: string;
  port: number;
  useHttps?: boolean;
}): Promise<ConnectionDiagnostic[]> {
  const results: ConnectionDiagnostic[] = [];
  const { host, port, useHttps = false } = options;
  
  // DNS resolution
  const dns = await import('dns');
  const dnsStart = Date.now();
  try {
    await new Promise<void>((resolve, reject) => {
      dns.lookup(host, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    results.push({
      stage: 'dns',
      success: true,
      latencyMs: Date.now() - dnsStart,
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    results.push({
      stage: 'dns',
      success: false,
      error: error.message,
      errorType: classifyNetworkError(error),
      latencyMs: Date.now() - dnsStart,
    });
    return results; // Can't continue without DNS
  }
  
  // TCP connection
  const tcpStart = Date.now();
  try {
    const socket = await createConnection({ host, port, timeoutMs: 5000 });
    socket.end();
    results.push({
      stage: 'tcp',
      success: true,
      latencyMs: Date.now() - tcpStart,
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    results.push({
      stage: 'tcp',
      success: false,
      error: error.message,
      errorType: classifyNetworkError(error),
      latencyMs: Date.now() - tcpStart,
    });
    return results; // Can't continue without TCP
  }
  
  // TLS handshake (if HTTPS)
  if (useHttps) {
    const tlsStart = Date.now();
    try {
      const socket = await createTlsConnection({ host, port, timeoutMs: 5000 });
      const cert = socket.getPeerCertificate();
      results.push({
        stage: 'tls',
        success: true,
        latencyMs: Date.now() - tlsStart,
        details: {
          issuer: cert.issuer?.O,
          subject: cert.subject?.CN,
          validTo: cert.valid_to,
        },
      });
      socket.end();
    } catch (err) {
      const error = err as Error & { code?: string };
      results.push({
        stage: 'tls',
        success: false,
        error: error.message,
        errorType: classifyNetworkError(error),
        latencyMs: Date.now() - tlsStart,
      });
      // TLS failure doesn't necessarily block HTTP (might work with rejectUnauthorized: false)
    }
  }
  
  // HTTP request
  const httpStart = Date.now();
  try {
    const response = await resilientRequest({
      hostname: host,
      port,
      path: '/',
      useHttps,
      rejectUnauthorized: false, // Be lenient for diagnostics
      maxRetries: 0, // Single attempt for diagnostics
      timeoutMs: 5000,
    });
    results.push({
      stage: 'http',
      success: response.statusCode < 500,
      latencyMs: Date.now() - httpStart,
      details: {
        statusCode: response.statusCode,
        statusMessage: response.statusMessage,
      },
    });
  } catch (err) {
    const error = err as Error & { code?: string };
    results.push({
      stage: 'http',
      success: false,
      error: error.message,
      errorType: classifyNetworkError(error),
      latencyMs: Date.now() - httpStart,
    });
  }
  
  return results;
}

/**
 * Format connection diagnostics for user-friendly display
 */
export function formatDiagnostics(diagnostics: ConnectionDiagnostic[]): string {
  const lines: string[] = [];
  
  for (const diag of diagnostics) {
    const status = diag.success ? '✓' : '✗';
    const latency = diag.latencyMs ? ` (${diag.latencyMs}ms)` : '';
    let line = `  ${status} ${diag.stage.toUpperCase()}${latency}`;
    
    if (!diag.success && diag.error) {
      line += `: ${diag.error}`;
      
      // Add helpful hints based on error type
      if (diag.errorType === NetworkErrorType.BLOCKED) {
        line += '\n    → Check if a firewall or proxy is blocking the connection';
      } else if (diag.errorType === NetworkErrorType.TLS_ERROR) {
        line += '\n    → Certificate may be self-signed, expired, or hostname mismatch';
      }
    }
    
    lines.push(line);
  }
  
  return lines.join('\n');
}

