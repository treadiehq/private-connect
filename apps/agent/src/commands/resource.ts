import chalk from 'chalk';
import { loadConfig, AgentConfig } from '../config';
import {
  findResourceConfig,
  loadResources,
  ConfigValidationError,
} from '../resources/parser';
import { ResolvedResource, ResourceSession, ResourceErrorCode } from '../resources/types';
import { formatEndpoint } from '../resources/endpoint';
import { createSession, parseTtl, formatDuration, buildSuccessJson, buildErrorJson } from '../resources/session';
import { createDirectForwarder, ForwarderHandle } from '../resources/forwarder';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface ResourceCommandOptions {
  hub: string;
  json?: boolean;
  local?: boolean;
  name?: string;
  ttl?: string;
  port?: string;
  config?: string;
  file?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main command
// ─────────────────────────────────────────────────────────────────────────────

export async function resourceCommand(resourceName: string, options: ResourceCommandOptions) {
  const isJson = options.json || false;

  // Load resource config
  const configPath = options.file || findResourceConfig();
  if (!configPath) {
    return exitWithError(isJson, 'CONFIG_NOT_FOUND',
      'No pconnect.yml found. Create one with a "resources:" section.',
    );
  }

  let result: ReturnType<typeof loadResources>;
  try {
    result = loadResources(configPath);
  } catch (err) {
    if (err instanceof ConfigValidationError) {
      return exitWithError(isJson, 'CONFIG_INVALID', err.message);
    }
    throw err;
  }

  if (!result || result.resources.size === 0) {
    return exitWithError(isJson, 'CONFIG_NOT_FOUND',
      'No resources defined in config. Add a "resources:" section to your pconnect.yml.',
    );
  }

  // Look up the resource
  const resource = result.resources.get(resourceName);
  if (!resource) {
    const available = Array.from(result.resources.keys()).join(', ');
    return exitWithError(isJson, 'RESOURCE_NOT_FOUND',
      `Resource "${resourceName}" not found in config. Available: ${available}`,
    );
  }

  // --local flag: force direct transport regardless of config
  const effectiveVia = options.local ? 'direct' as const : resource.via;

  // Hub-mediated transport requires agent auth
  if (effectiveVia === 'hub') {
    const agentConfig = loadConfig();
    if (!agentConfig) {
      return exitWithError(isJson, 'HUB_NOT_CONFIGURED',
        'Hub transport requires authentication. Run "connect up" first, or use --local for direct access.',
      );
    }
  }

  // Parse TTL
  const ttlSeconds = parseTtl(options.ttl);

  // Resolve local port preference
  const preferredPort = options.port ? parseInt(options.port, 10) : resource.targetPort;

  // Connect based on transport mode
  if (effectiveVia === 'direct') {
    await connectDirect(resource, preferredPort, ttlSeconds, options, isJson);
  } else {
    await connectViaHub(resource, preferredPort, ttlSeconds, options, isJson);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Direct transport — local TCP forwarder
// ─────────────────────────────────────────────────────────────────────────────

async function connectDirect(
  resource: ResolvedResource,
  preferredPort: number,
  ttlSeconds: number,
  options: ResourceCommandOptions,
  isJson: boolean,
) {
  let forwarder: ForwarderHandle;
  try {
    forwarder = await createDirectForwarder(
      resource.targetHost,
      resource.targetPort,
      preferredPort,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    if (msg.includes('No available port')) {
      return exitWithError(isJson, 'PORT_UNAVAILABLE', msg);
    }
    return exitWithError(isJson, 'CONNECTION_FAILED', `Failed to create forwarder: ${msg}`);
  }

  const session = createSession(resource.name, resource.type, forwarder.localPort, ttlSeconds);
  const displayName = options.name || resource.name;

  // Register session with hub (best-effort, non-blocking)
  const agentConfig = loadConfig();
  let hubSessionId: string | null = null;
  if (agentConfig) {
    hubSessionId = await registerSessionWithHub(agentConfig, session, resource, options.hub);
  }

  if (isJson) {
    console.log(JSON.stringify(buildSuccessJson(session)));
  } else {
    printHumanOutput(session, displayName, resource);
  }

  // TTL timer — exits cleanly on expiry
  const expiryTimer = setTimeout(async () => {
    if (!isJson) {
      console.log();
      console.log(chalk.yellow(`  Session expired after ${formatDuration(ttlSeconds)}.`));
      console.log();
    }
    if (agentConfig && hubSessionId) {
      await closeSessionOnHub(agentConfig, hubSessionId, 'expired', options.hub);
    }
    cleanup(forwarder);
    process.exit(0);
  }, ttlSeconds * 1000);

  // Graceful shutdown on Ctrl+C
  const onSignal = async () => {
    clearTimeout(expiryTimer);
    if (!isJson) {
      console.log(chalk.yellow('\n  Disconnected.'));
      console.log();
    }
    if (agentConfig && hubSessionId) {
      await closeSessionOnHub(agentConfig, hubSessionId, 'closed', options.hub);
    }
    cleanup(forwarder);
    process.exit(0);
  };

  process.on('SIGINT', onSignal);
  process.on('SIGTERM', onSignal);

  // Keep process alive
  await new Promise(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub-mediated transport — wraps the existing reach flow
// ─────────────────────────────────────────────────────────────────────────────

async function connectViaHub(
  resource: ResolvedResource,
  preferredPort: number,
  _ttlSeconds: number,
  options: ResourceCommandOptions,
  isJson: boolean,
) {
  const agentConfig = loadConfig();
  if (!agentConfig) {
    return exitWithError(isJson, 'HUB_NOT_CONFIGURED',
      'Hub transport requires authentication. Run "connect up" first.',
    );
  }

  const { reachCommand } = await import('./reach');

  // Hub mode delegates to reach — JSON output follows reach's schema, not resource's
  await reachCommand(resource.name, {
    hub: options.hub || agentConfig.hubUrl,
    timeout: 10000,
    port: options.port || String(preferredPort),
    check: false,
    json: isJson,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Output helpers
// ─────────────────────────────────────────────────────────────────────────────

function printHumanOutput(
  session: ResourceSession,
  displayName: string,
  resource: ResolvedResource,
) {
  const ttlSeconds = Math.max(
    0,
    Math.floor((new Date(session.expiresAt).getTime() - Date.now()) / 1000),
  );

  console.log();
  console.log(chalk.green(`  ✔ Connected to ${displayName}`));
  console.log(chalk.gray(`    Type:       ${resource.type}`));
  console.log(chalk.cyan(`    Endpoint:   ${session.endpoint}`));
  console.log(chalk.gray(`    Expires in: ${formatDuration(ttlSeconds)}`));

  printUsageHints(resource, session.localPort!);

  console.log();
  console.log(chalk.gray('  Press Ctrl+C to disconnect'));
  console.log();
}

function printUsageHints(resource: ResolvedResource, localPort: number) {
  const type = resource.type;
  if (type === 'postgres') {
    console.log(chalk.gray(`    psql:       psql -h 127.0.0.1 -p ${localPort}`));
  } else if (type === 'mysql') {
    console.log(chalk.gray(`    mysql:      mysql -h 127.0.0.1 -P ${localPort}`));
  } else if (type === 'redis') {
    console.log(chalk.gray(`    redis-cli:  redis-cli -p ${localPort}`));
  } else if (type === 'http') {
    console.log(chalk.gray(`    curl:       curl ${formatEndpoint(type, '127.0.0.1', localPort)}`));
  }
}

function cleanup(forwarder: ForwarderHandle) {
  forwarder.close().catch(() => {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Hub session registration — best-effort, never blocks or fails the command
// ─────────────────────────────────────────────────────────────────────────────

async function registerSessionWithHub(
  config: AgentConfig,
  session: ResourceSession,
  resource: ResolvedResource,
  hubUrl?: string,
): Promise<string | null> {
  try {
    const url = `${hubUrl || config.hubUrl}/v1/resource-sessions`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({
        agentId: config.agentId,
        resourceName: session.resourceName,
        resourceType: session.resourceType,
        endpoint: session.endpoint,
        protocol: session.protocol,
        localPort: session.localPort,
        targetHost: resource.targetHost,
        targetPort: resource.targetPort,
        expiresAt: session.expiresAt,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json() as { ok: boolean; session?: { id: string } };
      return data.session?.id ?? null;
    }
    return null;
  } catch {
    return null;
  }
}

async function closeSessionOnHub(
  config: AgentConfig,
  sessionId: string,
  status: 'closed' | 'expired',
  hubUrl?: string,
): Promise<void> {
  try {
    const url = `${hubUrl || config.hubUrl}/v1/resource-sessions/${sessionId}/close`;
    await fetch(url, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey,
      },
      body: JSON.stringify({ status }),
      signal: AbortSignal.timeout(5000),
    });
  } catch {
    // Best-effort — don't block CLI exit
  }
}

function exitWithError(isJson: boolean, code: ResourceErrorCode, message: string): never {
  if (isJson) {
    console.log(JSON.stringify(buildErrorJson(code, message)));
  } else {
    console.error(chalk.red(`\n  [x] ${message}\n`));
  }
  process.exit(1);
}
