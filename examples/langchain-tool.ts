/**
 * LangChain tool for querying databases through Private Connect grants.
 *
 * Usage:
 *   npm install @privateconnect/sdk langchain @langchain/openai
 *
 * Example:
 *   import { PrivateConnectQueryTool } from './langchain-tool';
 *   import { ChatOpenAI } from '@langchain/openai';
 *   import { AgentExecutor, createOpenAIFunctionsAgent } from 'langchain/agents';
 *
 *   const tool = new PrivateConnectQueryTool({
 *     apiKey: process.env.PRIVATECONNECT_API_KEY!,
 *     resourceName: 'staging-db',
 *     grantToken: process.env.GRANT_TOKEN!,
 *   });
 *
 *   const agent = await createOpenAIFunctionsAgent({ llm, tools: [tool], prompt });
 *   const result = await agent.invoke({ input: "How many users signed up this week?" });
 */

import { Tool } from 'langchain/tools';
import PrivateConnect from '@privateconnect/sdk';

interface PrivateConnectQueryToolConfig {
  apiKey: string;
  resourceName: string;
  grantToken: string;
  hubUrl?: string;
}

export class PrivateConnectQueryTool extends Tool {
  name = 'query_database';
  description =
    'Run a read-only SQL query against a private database via Private Connect. ' +
    'Input must be a valid SQL SELECT statement. Returns rows as JSON.';

  private client: PrivateConnect;
  private resourceName: string;
  private grantToken: string;

  constructor(config: PrivateConnectQueryToolConfig) {
    super();
    this.client = new PrivateConnect({
      apiKey: config.apiKey,
      hubUrl: config.hubUrl,
    });
    this.resourceName = config.resourceName;
    this.grantToken = config.grantToken;
  }

  async _call(sql: string): Promise<string> {
    const endpoint = `${this.client.hubUrl}/grant/${encodeURIComponent(this.resourceName)}/query`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.grantToken}`,
      },
      body: JSON.stringify({ sql }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      return `Error: ${(error as any).message || (error as any).error || response.statusText}`;
    }

    const result = await response.json() as { rows: unknown[]; rowCount: number };
    return JSON.stringify({
      rowCount: result.rowCount,
      rows: result.rows,
    });
  }
}

/**
 * Create a grant and tool in one step.
 * The grant is created via the SDK, then a LangChain tool is returned.
 */
export async function createDatabaseTool(config: {
  apiKey: string;
  resourceName: string;
  agentLabel?: string;
  ttl?: string;
  hubUrl?: string;
}): Promise<PrivateConnectQueryTool> {
  const client = new PrivateConnect({
    apiKey: config.apiKey,
    hubUrl: config.hubUrl,
  });

  const grant = await client.grants.create({
    agentLabel: config.agentLabel || 'langchain',
    resourceType: 'db',
    resourceName: config.resourceName,
    ttl: config.ttl || '1h',
    scope: 'read-only',
  });

  return new PrivateConnectQueryTool({
    apiKey: config.apiKey,
    resourceName: config.resourceName,
    grantToken: grant.token!,
    hubUrl: config.hubUrl,
  });
}
