import chalk from 'chalk';
import * as net from 'net';
import { spawn } from 'child_process';
import * as os from 'os';
import { loadConfig } from '../config';
import { enforceSecureConnection, SecurityError } from '../security';

interface Service {
  id: string;
  name: string;
  targetHost: string;
  targetPort: number;
  tunnelPort: number | null;
  status: string;
  agentId: string | null;
  protocol: string;
}

interface SshCommandOptions {
  hub: string;
  user?: string;
  config?: string;
}

export async function sshCommand(target: string, options: SshCommandOptions) {
  let user: string;
  let serviceName: string;

  if (target.includes('@')) {
    const [u, ...rest] = target.split('@');
    user = u;
    serviceName = rest.join('@');
  } else {
    user = options.user || os.userInfo().username;
    serviceName = target;
  }

  const config = loadConfig();
  if (!config) {
    process.stderr.write(chalk.red('  Agent not configured. Run `connect up` first.\n'));
    process.exit(1);
  }

  const hubUrl = config.hubUrl || options.hub;

  try {
    enforceSecureConnection(hubUrl);
  } catch (err) {
    if (err instanceof SecurityError) process.exit(1);
    throw err;
  }

  process.stderr.write(chalk.cyan(`\n  Connecting to ${chalk.bold(serviceName)}...\n`));

  let service: Service | undefined;
  try {
    const response = await fetch(`${hubUrl}/v1/services`, {
      headers: { 'x-api-key': config.apiKey },
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const services = (await response.json()) as Service[];
    service = services.find((s) => s.name === serviceName);
  } catch (err: unknown) {
    const e = err as Error;
    process.stderr.write(chalk.red(`  Failed to reach hub: ${e.message}\n`));
    process.exit(1);
  }

  if (!service) {
    process.stderr.write(chalk.red(`  Service "${serviceName}" not found\n`));
    process.exit(1);
  }

  if (!service.tunnelPort) {
    process.stderr.write(chalk.red(`  Service "${serviceName}" has no active tunnel\n`));
    process.exit(1);
  }

  const hubHost = new URL(hubUrl).hostname;

  const server = net.createServer((clientSocket) => {
    const proxySocket = net.createConnection({
      host: hubHost,
      port: service!.tunnelPort!,
    });
    proxySocket.on('connect', () => {
      clientSocket.pipe(proxySocket);
      proxySocket.pipe(clientSocket);
    });
    proxySocket.on('error', () => clientSocket.destroy());
    clientSocket.on('error', () => proxySocket.destroy());
  });

  await new Promise<void>((resolve, reject) => {
    server.on('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  const localPort = (server.address() as net.AddressInfo).port;
  process.stderr.write(chalk.green(`  Connected. Launching SSH as ${chalk.bold(user)}...\n\n`));

  const ssh = spawn(
    'ssh',
    [
      '-o', 'StrictHostKeyChecking=no',
      '-o', 'UserKnownHostsFile=/dev/null',
      '-o', 'LogLevel=ERROR',
      '-p', String(localPort),
      `${user}@127.0.0.1`,
    ],
    { stdio: 'inherit' },
  );

  ssh.on('close', (code) => {
    server.close();
    process.exit(code || 0);
  });

  ssh.on('error', (err: Error) => {
    process.stderr.write(chalk.red(`  Failed to launch ssh: ${err.message}\n`));
    server.close();
    process.exit(1);
  });
}
