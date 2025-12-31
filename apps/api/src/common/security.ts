import { Logger } from '@nestjs/common';

/**
 * Security utilities for Private Connect
 * Handles log scrubbing, token management, and audit logging
 */

// Patterns to scrub from logs
const SENSITIVE_PATTERNS = [
  // API keys
  /pc_[a-zA-Z0-9]{32,}/g,
  // Agent tokens (64 hex chars)
  /[a-f0-9]{64}/gi,
  // Bearer tokens
  /Bearer\s+[a-zA-Z0-9._-]+/gi,
  // Authorization headers
  /authorization:\s*[^\s]+/gi,
  // Cookie values
  /session=[a-zA-Z0-9._-]+/gi,
];

// Fields to redact in structured logs
const SENSITIVE_FIELDS = ['token', 'tokenHash', 'apiKey', 'password', 'secret', 'authorization'];

/**
 * Scrub sensitive data from a string for safe logging
 */
export function scrubSensitiveData(input: string): string {
  if (!input) return input;
  
  let scrubbed = input;
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '[REDACTED]');
  }
  return scrubbed;
}

/**
 * Scrub sensitive fields from an object for safe logging
 */
export function scrubObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;
  
  const scrubbed: Record<string, unknown> = { ...obj };
  for (const field of SENSITIVE_FIELDS) {
    if (field in scrubbed && scrubbed[field]) {
      scrubbed[field] = '[REDACTED]';
    }
  }
  return scrubbed;
}

/**
 * Mask an IP address for logging (show only first two octets)
 * e.g., 192.168.1.100 -> 192.168.x.x
 */
export function maskIpAddress(ip: string | undefined): string {
  if (!ip) return 'unknown';
  
  // Handle IPv6
  if (ip.includes(':')) {
    const parts = ip.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}:****`;
    }
    return 'ipv6:****';
  }
  
  // Handle IPv4
  const parts = ip.split('.');
  if (parts.length === 4) {
    return `${parts[0]}.${parts[1]}.x.x`;
  }
  return 'unknown';
}

/**
 * Extract client IP from various headers (respecting proxy chains)
 */
export function extractClientIp(headers: Record<string, string | string[] | undefined>): string | undefined {
  // Check common proxy headers
  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor).split(',');
    return ips[0]?.trim();
  }
  
  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }
  
  return undefined;
}

/**
 * Token expiry configuration
 */
export const TOKEN_CONFIG = {
  // Default token lifetime: 30 days
  DEFAULT_EXPIRY_DAYS: 30,
  // Warning threshold: 7 days before expiry
  WARNING_THRESHOLD_DAYS: 7,
  // Grace period after expiry: 24 hours (allows rotation)
  GRACE_PERIOD_HOURS: 24,
};

/**
 * Calculate token expiry date
 */
export function calculateTokenExpiry(days: number = TOKEN_CONFIG.DEFAULT_EXPIRY_DAYS): Date {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + days);
  return expiry;
}

/**
 * Check if a token is expired (with optional grace period)
 */
export function isTokenExpired(expiresAt: Date | null, includeGracePeriod: boolean = false): boolean {
  if (!expiresAt) return false; // Legacy tokens without expiry
  
  const now = new Date();
  
  if (includeGracePeriod) {
    const graceEnd = new Date(expiresAt);
    graceEnd.setHours(graceEnd.getHours() + TOKEN_CONFIG.GRACE_PERIOD_HOURS);
    return now > graceEnd;
  }
  
  return now > expiresAt;
}

/**
 * Check if token is expiring soon (within warning threshold)
 */
export function isTokenExpiringSoon(expiresAt: Date | null): boolean {
  if (!expiresAt) return false;
  
  const warningDate = new Date();
  warningDate.setDate(warningDate.getDate() + TOKEN_CONFIG.WARNING_THRESHOLD_DAYS);
  
  return expiresAt <= warningDate && expiresAt > new Date();
}

/**
 * Production-safe logger wrapper that scrubs sensitive data
 */
export class SecureLogger {
  private readonly logger: Logger;
  private readonly isProduction: boolean;

  constructor(context: string) {
    this.logger = new Logger(context);
    this.isProduction = process.env.NODE_ENV === 'production';
  }

  log(message: string, ...args: unknown[]) {
    this.logger.log(this.sanitize(message), ...args.map(a => this.sanitizeArg(a)));
  }

  warn(message: string, ...args: unknown[]) {
    this.logger.warn(this.sanitize(message), ...args.map(a => this.sanitizeArg(a)));
  }

  error(message: string, ...args: unknown[]) {
    this.logger.error(this.sanitize(message), ...args.map(a => this.sanitizeArg(a)));
  }

  debug(message: string, ...args: unknown[]) {
    this.logger.debug(this.sanitize(message), ...args.map(a => this.sanitizeArg(a)));
  }

  private sanitize(message: string): string {
    if (!this.isProduction) return message;
    return scrubSensitiveData(message);
  }

  private sanitizeArg(arg: unknown): unknown {
    if (!this.isProduction) return arg;
    if (typeof arg === 'string') return scrubSensitiveData(arg);
    if (typeof arg === 'object' && arg !== null) {
      return scrubObject(arg as Record<string, unknown>);
    }
    return arg;
  }
}

