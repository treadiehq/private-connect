import { Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * Security utilities for Private Connect
 * Handles log scrubbing, token management, input sanitization, and audit logging
 */

/**
 * Escape HTML entities to prevent XSS attacks
 */
export function escapeHtml(input: string): string {
  if (!input) return input;
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

/**
 * Escape a string for safe inclusion in JavaScript string literals
 * Prevents XSS when interpolating values into <script> blocks
 */
export function escapeJsString(input: string): string {
  if (!input) return input;
  return input
    .replace(/\\/g, '\\\\')     // Backslash first
    .replace(/'/g, "\\'")       // Single quotes
    .replace(/"/g, '\\"')       // Double quotes
    .replace(/\n/g, '\\n')      // Newlines
    .replace(/\r/g, '\\r')      // Carriage returns
    .replace(/</g, '\\x3c')     // < to prevent </script> injection
    .replace(/>/g, '\\x3e');    // > for consistency
}

/**
 * Sanitize CSS color value to prevent CSS injection
 * Returns a safe default if the color is invalid
 */
export function sanitizeCssColor(color: string, defaultColor: string = '#06b6d4'): string {
  if (!color) return defaultColor;
  
  const trimmed = color.trim();
  
  // Allow hex colors (3, 4, 6, or 8 digits)
  if (/^#([A-Fa-f0-9]{3,4}|[A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$/.test(trimmed)) {
    return trimmed;
  }
  
  // Allow rgb/rgba with numeric values only
  if (/^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  
  // Allow hsl/hsla with numeric values only
  if (/^hsla?\(\s*\d{1,3}\s*,\s*\d{1,3}%\s*,\s*\d{1,3}%\s*(,\s*(0|1|0?\.\d+))?\s*\)$/.test(trimmed)) {
    return trimmed;
  }
  
  // Allow safe named colors (lowercase only, no special characters)
  const safeNamedColors = new Set([
    'red', 'blue', 'green', 'yellow', 'purple', 'orange', 'pink', 'brown',
    'black', 'white', 'gray', 'grey', 'cyan', 'magenta', 'lime', 'navy',
    'teal', 'aqua', 'maroon', 'olive', 'silver', 'fuchsia', 'indigo', 'violet',
    'coral', 'salmon', 'gold', 'khaki', 'plum', 'orchid', 'crimson', 'tomato',
  ]);
  
  if (safeNamedColors.has(trimmed.toLowerCase())) {
    return trimmed.toLowerCase();
  }
  
  // Invalid color - return default
  return defaultColor;
}

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
 * Scrub sensitive fields from an object for safe logging.
 * Recursively traverses nested objects and arrays, applying both
 * key-based redaction and pattern-based scrubbing on all string values.
 */
export function scrubObject<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  if (!obj || typeof obj !== 'object') return obj;

  // Preserve non-plain objects that would be destroyed by Object.entries()
  if (obj instanceof Date || obj instanceof RegExp) return obj;
  if (obj instanceof Error) {
    const cleaned = new Error(scrubSensitiveData(obj.message));
    cleaned.stack = obj.stack ? scrubSensitiveData(obj.stack) : obj.stack;
    cleaned.name = obj.name;
    return cleaned as unknown as Record<string, unknown>;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => {
      if (typeof item === 'string') return scrubSensitiveData(item);
      if (typeof item === 'object' && item !== null) {
        return scrubObject(item as Record<string, unknown>);
      }
      return item;
    }) as unknown as Record<string, unknown>;
  }

  const scrubbed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.includes(key) && value) {
      scrubbed[key] = '[REDACTED]';
    } else if (typeof value === 'string') {
      scrubbed[key] = scrubSensitiveData(value);
    } else if (typeof value === 'object' && value !== null) {
      scrubbed[key] = scrubObject(value as Record<string, unknown>);
    } else {
      scrubbed[key] = value;
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
 * Extract client IP from various headers (respecting proxy chains).
 *
 * Uses the rightmost X-Forwarded-For entry because every trusted reverse
 * proxy appends (rather than prepends) the connecting IP.  The leftmost
 * value is trivially spoofable by the client.
 */
export function extractClientIp(headers: Record<string, string | string[] | undefined>): string | undefined {
  // Prefer Cloudflare's true client IP header (not affected by proxy rotation)
  const cfIp = headers['cf-connecting-ip'];
  if (cfIp) {
    return Array.isArray(cfIp) ? cfIp[0] : cfIp;
  }

  const forwardedFor = headers['x-forwarded-for'];
  if (forwardedFor) {
    const raw = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const ips = raw.split(',').map(ip => ip.trim()).filter(Boolean);
    // Leftmost IP is the original client; rightmost is the nearest proxy
    return ips[0];
  }

  const realIp = headers['x-real-ip'];
  if (realIp) {
    return Array.isArray(realIp) ? realIp[0] : realIp;
  }

  return undefined;
}

// ---------------------------------------------------------------------------
// Field-level encryption (AES-256-GCM)
// ---------------------------------------------------------------------------
// Set FIELD_ENCRYPTION_KEY to a 64-character hex string (32 bytes).
// Generate one with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// ---------------------------------------------------------------------------

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string for storage.
 * Returns a base64-encoded string containing the IV, auth tag, and ciphertext.
 * Returns null if value is null/undefined.
 */
export function encryptField(plaintext: string): string;
export function encryptField(plaintext: null | undefined): null;
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext == null) return null;
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Format: iv (12 bytes) + authTag (16 bytes) + ciphertext — all base64-encoded together
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

/**
 * Decrypt a value produced by encryptField.
 * Returns null if value is null/undefined.
 * Throws if decryption fails (tampered or wrong key).
 */
export function decryptField(ciphertext: string): string;
export function decryptField(ciphertext: null | undefined): null;
export function decryptField(ciphertext: string | null | undefined): string | null {
  if (ciphertext == null) return null;
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ENCRYPTION_ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

/**
 * Token expiry configuration
 */
export const TOKEN_CONFIG = {
  DEFAULT_EXPIRY_DAYS: 30,
  WARNING_THRESHOLD_DAYS: 7,
  GRACE_PERIOD_HOURS: 24,
};

/**
 * Provisioned agent token configuration
 */
export const PROVISION_CONFIG = {
  DEFAULT_TTL_SECONDS: 7200,   // 2 hours
  MAX_TTL_SECONDS: 86400,      // 24 hours
  MIN_TTL_SECONDS: 300,        // 5 minutes
};

/**
 * Calculate token expiry date.
 * When called with no arguments, uses the default 30-day expiry for regular agent tokens.
 * When called with `seconds`, produces a short-lived expiry for provisioned tokens.
 */
export function calculateTokenExpiry(seconds?: number): Date {
  const expiry = new Date();
  if (seconds !== undefined) {
    expiry.setSeconds(expiry.getSeconds() + seconds);
  } else {
    expiry.setDate(expiry.getDate() + TOKEN_CONFIG.DEFAULT_EXPIRY_DAYS);
  }
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

