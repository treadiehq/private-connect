import chalk from 'chalk';
import { loadConfig, getConfigPath } from '../config';

interface WhoamiOptions {
  json: boolean;
  config?: string;
}

interface WorkspaceInfo {
  workspace?: {
    name: string;
    plan: string;
  };
  usage?: {
    services: number;
    agents: number;
  };
  limits?: {
    maxServices: number;
  };
}

export async function whoamiCommand(options: WhoamiOptions) {
  const config = loadConfig();

  if (!config) {
    if (options.json) {
      console.log(JSON.stringify({ error: 'Not configured', configured: false }));
    } else {
      console.log(chalk.yellow('\n⚠ Agent not configured'));
      console.log(chalk.gray(`  Run ${chalk.cyan('connect up --api-key <key>')} to configure.\n`));
    }
    process.exit(1);
  }

  // Fetch agent info from hub
  let agentInfo = null;
  let workspaceInfo: WorkspaceInfo | null = null;

  try {
    const response = await fetch(`${config.hubUrl}/v1/agents/${config.agentId}`);
    if (response.ok) {
      agentInfo = await response.json();
    }
  } catch {
    // Ignore fetch errors
  }

  try {
    const response = await fetch(`${config.hubUrl}/v1/workspace`, {
      headers: { 'x-api-key': config.apiKey },
    });
    if (response.ok) {
      workspaceInfo = await response.json() as WorkspaceInfo;
    }
  } catch {
    // Ignore fetch errors
  }

  if (options.json) {
    console.log(JSON.stringify({
      configured: true,
      agent: {
        id: config.agentId,
        label: config.label,
        name: config.name,
      },
      workspace: workspaceInfo?.workspace || null,
      hubUrl: config.hubUrl,
      configPath: getConfigPath(),
    }, null, 2));
    return;
  }

  console.log(chalk.cyan('\n🔍 Agent Identity\n'));

  console.log(chalk.white('  Agent'));
  console.log(chalk.gray(`    ID:    ${config.agentId}`));
  console.log(chalk.gray(`    Label: ${chalk.white(config.label)}`));
  if (config.name) {
    console.log(chalk.gray(`    Name:  ${config.name}`));
  }

  if (workspaceInfo?.workspace) {
    console.log();
    console.log(chalk.white('  Workspace'));
    console.log(chalk.gray(`    Name:  ${workspaceInfo.workspace.name}`));
    console.log(chalk.gray(`    Plan:  ${workspaceInfo.workspace.plan === 'PRO' ? chalk.green('PRO') : chalk.gray('FREE')}`));
  }

  if (workspaceInfo?.usage && workspaceInfo?.limits) {
    console.log();
    console.log(chalk.white('  Usage'));
    console.log(chalk.gray(`    Services: ${workspaceInfo.usage.services}/${workspaceInfo.limits.maxServices}`));
    console.log(chalk.gray(`    Agents:   ${workspaceInfo.usage.agents}`));
  }

  console.log();
  console.log(chalk.white('  Connection'));
  console.log(chalk.gray(`    Hub:    ${config.hubUrl}`));
  console.log(chalk.gray(`    Config: ${getConfigPath()}`));

  console.log();
}

