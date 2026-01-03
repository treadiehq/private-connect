import chalk from 'chalk';
import { loadConfig } from '../config';

interface LinkOptions {
  hub: string;
  expires?: string;
  methods?: string;
  paths?: string;
  rateLimit?: string;
  name?: string;
  config?: string;
}

interface LinkResponse {
  success: boolean;
  share?: {
    id: string;
    token: string;
    name: string;
    expiresAt: string;
    shareUrl: string;
  };
  error?: string;
}

export async function linkCommand(service: string, options: LinkOptions) {
  const config = loadConfig();
  
  if (!config) {
    console.error(chalk.red('\n[x] Agent not configured'));
    console.log(chalk.gray(`  Run ${chalk.cyan('connect up')} first to authenticate.\n`));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  console.log(chalk.cyan(`\n🔗 Creating public link for "${service}"...\n`));

  try {
    // First, find the service
    const servicesResponse = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'x-api-key': config.apiKey,
      },
    });

    if (!servicesResponse.ok) {
      console.error(chalk.red(`[x] Failed to fetch services: ${servicesResponse.statusText}`));
      process.exit(1);
    }

    const services = await servicesResponse.json() as Array<{
      id: string;
      name: string;
    }>;

    const targetService = services.find(s => s.name.toLowerCase() === service.toLowerCase());

    if (!targetService) {
      console.error(chalk.red(`[x] Service "${service}" not found`));
      console.log(chalk.gray('\n  Available services:'));
      services.forEach(s => {
        console.log(chalk.gray(`    • ${s.name}`));
      });
      console.log();
      process.exit(1);
    }

    // Parse options
    const allowedMethods = options.methods?.split(',').map(m => m.trim().toUpperCase());
    const allowedPaths = options.paths?.split(',').map(p => p.trim());
    const rateLimitPerMin = options.rateLimit ? parseInt(options.rateLimit, 10) : undefined;

    // Create the share
    const response = await fetch(`${hubUrl}/v1/services/${targetService.id}/shares`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        name: options.name || `${service}-link`,
        expiresIn: options.expires || '24h',
        allowedMethods,
        allowedPaths,
        rateLimitPerMin,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText })) as { message?: string };
      console.error(chalk.red(`[x] Failed to create link: ${error.message || response.statusText}`));
      process.exit(1);
    }

    const data = await response.json() as LinkResponse;

    if (!data.success || !data.share) {
      console.error(chalk.red(`[x] Failed to create link: ${data.error || 'Unknown error'}`));
      process.exit(1);
    }

    const share = data.share;
    const expiresAt = new Date(share.expiresAt);
    // Use absolute URL from API if provided, otherwise prepend hubUrl
    const shareUrl = share.shareUrl.startsWith('http') 
      ? share.shareUrl 
      : `${hubUrl}${share.shareUrl}`;

    // Success output
    console.log(chalk.green('[ok] Public link created\n'));
    
    console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────────┐'));
    console.log(chalk.gray('  │') + chalk.white('  Share URL                                                   ') + chalk.gray('│'));
    console.log(chalk.gray('  │') + chalk.cyan(`  ${shareUrl}`) + chalk.gray('        │'));
    console.log(chalk.gray('  └─────────────────────────────────────────────────────────────┘\n'));

    console.log(chalk.gray('  Settings:'));
    console.log(chalk.gray(`    Expires:     ${expiresAt.toLocaleString()}`));
    if (allowedMethods) {
      console.log(chalk.gray(`    Methods:     ${allowedMethods.join(', ')}`));
    }
    if (allowedPaths) {
      console.log(chalk.gray(`    Paths:       ${allowedPaths.join(', ')}`));
    }
    if (rateLimitPerMin) {
      console.log(chalk.gray(`    Rate limit:  ${rateLimitPerMin}/min`));
    }
    console.log();

    console.log(chalk.gray('  Usage:'));
    console.log(chalk.gray('    Anyone with this URL can access the service.'));
    console.log(chalk.gray('    No account or CLI installation required.\n'));

    console.log(chalk.gray('  Example:'));
    console.log(chalk.cyan(`    curl ${shareUrl}/health\n`));

  } catch (error) {
    const err = error as Error;
    if (err.message?.includes('ECONNREFUSED')) {
      console.error(chalk.red(`\n[x] Cannot connect to hub at ${hubUrl}`));
      console.log(chalk.gray('  Make sure the hub is running and accessible.\n'));
    } else {
      console.error(chalk.red(`\n[x] Error: ${err.message}\n`));
    }
    process.exit(1);
  }
}
