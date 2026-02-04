import chalk from 'chalk';
import { getConfig } from '../config';
import inquirer from 'inquirer';

const HUB_URL = process.env.CONNECT_HUB_URL || 'https://api.privateconnect.co';

interface DeleteOptions {
  hub?: string;
  force?: boolean;
}

export async function deleteCommand(serviceName: string, options: DeleteOptions) {
  const hubUrl = options.hub || HUB_URL;
  const config = getConfig();

  if (!config.apiKey) {
    console.log(chalk.red('\n  Not authenticated. Run: connect up\n'));
    process.exit(1);
  }

  console.log();
  console.log(chalk.gray('────────────────────────────────────────'));
  console.log();

  // First, find the service by name
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!response.ok) {
      console.log(chalk.red(`  [x] Failed to list services: ${response.status}`));
      process.exit(1);
    }

    const data = await response.json() as { services: Array<{ id: string; name: string }> };
    const service = data.services.find(s => s.name === serviceName);

    if (!service) {
      console.log(chalk.red(`  [x] Service "${serviceName}" not found`));
      console.log();
      console.log(chalk.gray('  Available services:'));
      for (const s of data.services) {
        console.log(`    ${chalk.cyan('●')} ${s.name}`);
      }
      console.log();
      process.exit(1);
    }

    // Confirm deletion unless --force
    if (!options.force) {
      const { confirm } = await inquirer.prompt([
        {
          type: 'confirm',
          name: 'confirm',
          message: `Delete service "${serviceName}"? This cannot be undone.`,
          default: false,
        },
      ]);

      if (!confirm) {
        console.log(chalk.gray('  Cancelled'));
        console.log();
        return;
      }
    }

    // Delete the service
    const deleteResponse = await fetch(`${hubUrl}/v1/services/${service.id}`, {
      method: 'DELETE',
      headers: {
        'X-API-Key': config.apiKey,
      },
    });

    if (!deleteResponse.ok) {
      const error = await deleteResponse.json().catch(() => ({})) as { message?: string };
      console.log(chalk.red(`  [x] Failed to delete: ${error.message || deleteResponse.status}`));
      process.exit(1);
    }

    console.log(chalk.green(`  ✓ Service "${serviceName}" deleted`));
    console.log();

  } catch (err: any) {
    console.log(chalk.red(`  [x] Error: ${err.message}`));
    process.exit(1);
  }
}
