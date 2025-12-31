import chalk from 'chalk';

/**
 * Security utilities for Private Connect Agent
 * Handles URL validation, HTTPS enforcement, and security warnings
 */

/**
 * Check if running in a CI/CD environment
 */
export function isCI(): boolean {
  return !!(
    process.env.CI ||
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
  return process.env.CONNECT_ALLOW_INSECURE === 'true';
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
    const isLocalhost = parsed.hostname === 'localhost' || 
                        parsed.hostname === '127.0.0.1' ||
                        parsed.hostname.endsWith('.local');
    
    // Allow HTTP for localhost in development
    if (!isHttps && isLocalhost) {
      warnings.push('Using HTTP for localhost. This is acceptable for local development only.');
      return { valid: true, warnings };
    }
    
    // Enforce HTTPS for non-localhost URLs
    if (!isHttps && !isLocalhost) {
      // Check if enforcement is disabled via env var
      if (isHttpsEnforcementDisabled() || options.allowInsecure) {
        warnings.push(
          'WARNING: Using insecure HTTP connection to hub.',
          'Your credentials and data may be intercepted (MITM attack).',
          'Set CONNECT_ALLOW_INSECURE=false or use HTTPS in production.'
        );
        return { valid: true, warnings };
      }
      
      return {
        valid: false,
        warnings: [],
        error: `Insecure connection rejected. Hub URL must use HTTPS for non-localhost connections.\n` +
               `  Current URL: ${url}\n` +
               `  To use HTTPS: ${url.replace('http://', 'https://')}\n` +
               `  To bypass (NOT RECOMMENDED): Set CONNECT_ALLOW_INSECURE=true`,
      };
    }
    
    // Valid HTTPS connection
    return { valid: true, warnings };
    
  } catch (e) {
    return {
      valid: false,
      warnings: [],
      error: `Invalid hub URL: ${url}`,
    };
  }
}

/**
 * Print security warnings to console
 */
export function printSecurityWarnings(warnings: string[]): void {
  if (warnings.length === 0) return;
  
  console.log(chalk.yellow('\n⚠ Security Warnings:'));
  for (const warning of warnings) {
    console.log(chalk.yellow(`  • ${warning}`));
  }
  console.log();
}

/**
 * Validate and enforce security requirements for hub connection
 * Call this before connecting to the hub
 */
export function enforceSecureConnection(hubUrl: string, options: { silent?: boolean } = {}): void {
  const result = validateHubUrl(hubUrl);
  
  if (!result.valid) {
    console.error(chalk.red(`\n✗ ${result.error}\n`));
    process.exit(1);
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
  const now = new Date();
  const daysLeft = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysLeft <= 0) {
    console.log(chalk.red('\n⚠ Your agent token has EXPIRED.'));
    console.log(chalk.red('  Please rotate your token to continue using the service.'));
    console.log(chalk.gray('  Run: connect up --rotate-token\n'));
  } else if (daysLeft <= 7) {
    console.log(chalk.yellow(`\n⚠ Your agent token expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`));
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
      console.log(chalk.yellow(`\n⚠ Security Notice: ${event.message}`));
      console.log(chalk.gray('  This is informational. If this was unexpected, check your network.\n'));
      break;
    case 'TOKEN_EXPIRED':
      console.log(chalk.red(`\n✗ ${event.message}`));
      console.log(chalk.gray('  Run: connect up --rotate-token\n'));
      break;
    default:
      console.log(chalk.yellow(`\n⚠ ${event.message}\n`));
  }
}

