import chalk from 'chalk';
import { discoverServices, formatDiscoveredServices, DiscoveredService } from '../discovery.js';
import { loadConfig } from '../config.js';
import ora from 'ora';
import inquirer from 'inquirer';

interface DiscoverOptions {
  host?: string;
  ports?: string;
  json?: boolean;
  configPath?: string;
}

export async function discoverCommand(options: DiscoverOptions) {
  const host = options.host || 'localhost';
  const customPorts = options.ports
    ? options.ports.split(',').map((p) => parseInt(p.trim(), 10))
    : undefined;

  const spinner = ora(`Scanning ${host} for services...`).start();

  try {
    const services = await discoverServices(host, customPorts);
    spinner.stop();

    if (options.json) {
      console.log(JSON.stringify(services, null, 2));
      return;
    }

    console.log(formatDiscoveredServices(services));

    if (services.length === 0) {
      console.log(chalk.gray('  Try running some services or specify --ports to scan specific ports.'));
      return;
    }

    // Interactive mode: ask if user wants to expose any services
    const config = await loadConfig(options.configPath);
    if (!config) {
      console.log(chalk.yellow('\n⚠ Agent not configured. Run `connect up` first to expose services.'));
      return;
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          { name: 'Expose selected services', value: 'expose' },
          { name: 'Just show the list (done)', value: 'done' },
        ],
      },
    ]);

    if (action === 'done') {
      return;
    }

    // Let user select services to expose
    const { selectedServices } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'selectedServices',
        message: 'Select services to expose:',
        choices: services.map((s) => ({
          name: `${s.name} (${s.host}:${s.port} • ${s.type})`,
          value: s,
          checked: false,
        })),
      },
    ]);

    if (selectedServices.length === 0) {
      console.log(chalk.gray('No services selected.'));
      return;
    }

    // Expose selected services
    console.log(chalk.cyan('\n📡 Exposing selected services...\n'));

    for (const service of selectedServices as DiscoveredService[]) {
      console.log(chalk.gray(`  Exposing ${service.name} (${service.host}:${service.port})...`));

      try {
        const response = await fetch(`${config.hubUrl}/v1/services/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': config.apiKey,
          },
          body: JSON.stringify({
            agentId: config.agentId,
            name: service.name,
            targetHost: service.host,
            targetPort: service.port,
            protocol: service.type === 'https' ? 'https' : service.type === 'http' ? 'http' : 'auto',
          }),
        });

        if (response.ok) {
          const data = (await response.json()) as { tunnelPort?: number };
          console.log(
            chalk.green(`  ✓ ${service.name}`) +
              chalk.gray(` → tunnel port ${data.tunnelPort}`)
          );
        } else {
          const error = await response.text();
          console.log(chalk.red(`  ✗ ${service.name}: ${error}`));
        }
      } catch (err) {
        console.log(chalk.red(`  ✗ ${service.name}: ${(err as Error).message}`));
      }
    }

    console.log(chalk.green('\n✓ Done! Services are now accessible through the hub.'));
  } catch (error) {
    spinner.stop();
    console.error(chalk.red('Discovery failed:'), (error as Error).message);
    process.exit(1);
  }
}

