import chalk from 'chalk';

/**
 * Security utilities for Private Connect Agent
 * Handles URL validation, HTTPS enforcement, and security warnings
 */

/**
 * Error thrown when security validation fails
 */
export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}

/**
 * Parse boolean environment variable robustly
 * Handles: true, TRUE, True, 1, yes, YES, on, ON (and their false counterparts)
 */
export function parseBooleanEnv(value: string | undefined, defaultValue = false): boolean {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  const normalized = value.toLowerCase().trim();
  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return defaultValue;
}

/**
 * Check if running in a CI/CD environment
 * Properly handles string "false" values
 */
export function isCI(): boolean {
  // CI env var needs special handling - explicit "false" should return false
  if (process.env.CI !== undefined) {
    return parseBooleanEnv(process.env.CI, true); // default true if CI is set but not boolean-like
  }
  
  // Other CI indicators just need to exist
  return !!(
    process.env.GITHUB_ACTIONS ||
    process.env.GITLAB_CI ||
    process.env.CIRCLECI ||
    process.env.JENKINS_URL ||
    process.env.BUILDKITE ||
    process.env.TRAVIS
  );
}

/**
 * Check if HTTPS enforcement should be bypassed (dev/testing only)
 */
export function isHttpsEnforcementDisabled(): boolean {
  return parseBooleanEnv(process.env.CONNECT_ALLOW_INSECURE, false);
}

/**
 * Check if a hostname is a localhost address
 * Supports IPv4, IPv6, and .local TLD (mDNS)
 */
function isLocalhostHostname(hostname: string): boolean {
  // Exact localhost matches
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return true;
  }
  
  // IPv6 loopback (with or without brackets)
  if (hostname === '::1' || hostname === '[::1]') {
    return true;
  }
  
  // .local TLD (mDNS) - must be exactly "something.local", not "something.local.attacker.com"
  // Valid: myhost.local, my-host.local
  // Invalid: evil.local.attacker.com, notlocal
  if (hostname.endsWith('.local')) {
    // Ensure there's no subdomain after .local (i.e., .local is the TLD)
    const parts = hostname.split('.');
    return parts.length === 2 && parts[1] === 'local' && parts[0].length > 0;
  }
  
  return false;
}

/**
 * Validate hub URL security
 * Enforces HTTPS for production use
 */
export function validateHubUrl(url: string, options: { allowInsecure?: boolean } = {}): {
  valid: boolean;
  warnings: string[];
  error?: string;
} {
  const warnings: string[] = [];
  
  try {
    const parsed = new URL(url);
    
    // Check protocol
    const isHttps = parsed.protocol === 'https:';
    const isLocalhost = isLocalhostHostname(parsed.hostname);
    
    // Allow HTTP for localhost in development
    if (!isHttps && isLocalhost) {
      warnings.push('Using HTTP for localhost. This is acceptable for local development only.');
      return { valid: true, warnings };
    }
    
    // Enforce HTTPS for non-localhost URLs
    if (!isHttps && !isLocalhost) {
      // Check if enforcement is disabled via env var or options
      if (isHttpsEnforcementDisabled() || options.allowInsecure) {
        warnings.push(
          'WARNING: Using insecure HTTP connection to hub.',
          'Your credentials and data may be intercepted (MITM attack).',
          'Set CONNECT_ALLOW_INSECURE=false or use HTTPS in production.'
        );
        return { valid: true, warnings };
      }
      
      // Build the HTTPS suggestion - use URL API for safe transformation
      let httpsUrl: string;
      try {
        const suggested = new URL(url);
        suggested.protocol = 'https:';
        httpsUrl = suggested.toString();
      } catch {
        httpsUrl = url.replace(/^http:/, 'https:');
      }
      
      return {
        valid: false,
        warnings: [],
        error: `Insecure connection rejected. Hub URL must use HTTPS for non-localhost connections.\n` +
               `  Current URL: ${url}\n` +
               `  To use HTTPS: ${httpsUrl}\n` +
               `  To bypass (NOT RECOMMENDED): Set CONNECT_ALLOW_INSECURE=true`,
      };
    }
    
    // Valid HTTPS connection
    return { valid: true, warnings };
    
  } catch (e) {
    const originalError = e instanceof Error ? e.message : String(e);
    return {
      valid: false,
      warnings: [],
      error: `Invalid hub URL: ${url}\n  Parse error: ${originalError}`,
    };
  }
}

/**
 * Print security warnings to console
 */
export function printSecurityWarnings(warnings: string[]): void {
  if (warnings.length === 0) return;
  
  console.log(chalk.yellow('\n[!] Security Warnings:'));
  for (const warning of warnings) {
    console.log(chalk.yellow(`  • ${warning}`));
  }
  console.log();
}

/**
 * Validate and enforce security requirements for hub connection
 * Call this before connecting to the hub
 * @throws {SecurityError} if validation fails
 */
export function enforceSecureConnection(
  hubUrl: string,
  options: { silent?: boolean; allowInsecure?: boolean } = {}
): void {
  const result = validateHubUrl(hubUrl, { allowInsecure: options.allowInsecure });
  
  if (!result.valid) {
    if (!options.silent) {
      console.error(chalk.red(`\n[x] ${result.error}\n`));
    }
    throw new SecurityError(result.error || 'Security validation failed');
  }
  
  if (!options.silent && result.warnings.length > 0) {
    printSecurityWarnings(result.warnings);
  }
}

/**
 * Token security information
 */
export interface TokenSecurityInfo {
  expiresAt?: string;
  expiringSoon?: boolean;
  daysUntilExpiry?: number;
}

/**
 * Parse and display token expiry warnings
 */
export function handleTokenExpiry(info: TokenSecurityInfo): void {
  if (!info.expiresAt) return;
  
  const expiryDate = new Date(info.expiresAt);
  
  // Validate the parsed date
  if (isNaN(expiryDate.getTime())) {
    console.log(chalk.yellow('\n[!] Warning: Unable to parse token expiry date.'));
    console.log(chalk.gray(`  Raw value: ${info.expiresAt}`));
    console.log(chalk.gray('  Token expiry checks will be skipped.\n'));
    return;
  }
  
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft <= 0) {
    console.log(chalk.red('\n[!] Your agent token has EXPIRED.'));
    console.log(chalk.red('  Please rotate your token to continue using the service.'));
    console.log(chalk.gray('  Run: connect up --rotate-token\n'));
  } else if (daysLeft <= 7) {
    console.log(chalk.yellow(`\n[!] Your agent token expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`));
    console.log(chalk.gray('  Consider rotating your token soon.'));
    console.log(chalk.gray('  Run: connect up --rotate-token\n'));
  }
}

/**
 * Handle security events from the hub
 */
export function handleSecurityEvent(event: { type: string; message: string }): void {
  switch (event.type) {
    case 'IP_CHANGED':
      console.log(chalk.yellow(`\n[!] Security Notice: ${event.message}`));
      console.log(chalk.gray('  This is informational. If this was unexpected, check your network.\n'));
      break;
    case 'TOKEN_EXPIRED':
      console.log(chalk.red(`\n[x] ${event.message}`));
      console.log(chalk.gray('  Run: connect up --rotate-token\n'));
      break;
    default:
      console.log(chalk.yellow(`\n[!] ${event.message}\n`));
  }
}
