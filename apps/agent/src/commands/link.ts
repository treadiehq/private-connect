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

interface ServiceInfo {
  id: string;
  name: string;
  targetPort: number;
  protocol?: string;
}

// Well-known database ports
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

const isDatabase = (port: number): boolean => port in DB_PORTS;
const getDatabaseType = (port: number): string => DB_PORTS[port] || 'Database';

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

    const services = await servicesResponse.json() as ServiceInfo[];

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
        'x-api-key': config.apiKey,
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
    const isDbService = targetService.targetPort && isDatabase(targetService.targetPort);
    
    // Build share URLs
    // For HTTP services: use link.privateconnect.co for direct proxy access
    // For databases: use privateconnect.co/share/ for web UI
    const token = share.token;
    const linkDomain = 'https://link.privateconnect.co';
    const webDomain = 'https://privateconnect.co';
    
    // Direct proxy URL (ngrok-style, with branding injected)
    const proxyUrl = `${linkDomain}/${token}`;
    // Web UI URL (for databases with SQL client)
    const webUrl = `${webDomain}/share/${token}`;

    // Success output
    console.log(chalk.green('[ok] Public link created\n'));
    
    if (isDbService) {
      // Database-specific output with web UI link
      const dbType = getDatabaseType(targetService.targetPort);
      console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────────┐'));
      console.log(chalk.gray('  │') + chalk.white(`  ${dbType} Web Console                                       `) + chalk.gray('│'));
      console.log(chalk.gray('  │') + chalk.cyan(`  ${webUrl}`) + chalk.gray('│'));
      console.log(chalk.gray('  └─────────────────────────────────────────────────────────────┘\n'));

      console.log(chalk.gray('  Settings:'));
      console.log(chalk.gray(`    Expires:     ${expiresAt.toLocaleString()}`));
      console.log();

      console.log(chalk.gray('  Usage:'));
      console.log(chalk.gray('    Open the link in a browser to access the database.'));
      console.log(chalk.gray('    No installation required - includes a web-based SQL client!\n'));

      console.log(chalk.gray('  Features:'));
      console.log(chalk.gray('    • Run SQL queries directly in the browser'));
      console.log(chalk.gray('    • Export results as CSV or JSON'));
      console.log(chalk.gray('    • Query history preserved in session\n'));
    } else {
      // HTTP service output - use direct proxy URL (ngrok-style)
      console.log(chalk.gray('  ┌─────────────────────────────────────────────────────────────┐'));
      console.log(chalk.gray('  │') + chalk.white('  Public URL                                                  ') + chalk.gray('│'));
      console.log(chalk.gray('  │') + chalk.cyan(`  ${proxyUrl}`) + chalk.gray('                             │'));
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
      console.log(chalk.gray('    Share the URL - visitors see your app directly.\n'));

      console.log(chalk.gray('  curl example:'));
      console.log(chalk.cyan(`    curl ${proxyUrl}/api/health\n`));
    }

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
