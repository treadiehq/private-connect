/**
 * OpenAI function-calling integration with Private Connect grants.
 *
 * Gives an AI assistant the ability to query a private database
 * through a time-limited, scoped grant.
 *
 * Usage:
 *   npm install openai @privateconnect/sdk
 *   OPENAI_API_KEY=... PRIVATECONNECT_API_KEY=... npx tsx openai-tool-calling.ts
 */

import OpenAI from 'openai';
import PrivateConnect from '@privateconnect/sdk';

const openai = new OpenAI();

const pc = new PrivateConnect({
  apiKey: process.env.PRIVATECONNECT_API_KEY!,
});

// ─── Tool definition for OpenAI ──────────────────────────────────────────────

const queryDatabaseTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'query_database',
    description:
      'Run a read-only SQL query against the staging database. ' +
      'Only SELECT statements are allowed. Results are returned as JSON rows.',
    parameters: {
      type: 'object',
      properties: {
        sql: {
          type: 'string',
          description: 'A valid SQL SELECT statement',
        },
      },
      required: ['sql'],
    },
  },
};

// ─── Tool execution ──────────────────────────────────────────────────────────

async function executeQuery(sql: string, grantToken: string): Promise<string> {
  const response = await fetch(
    `${pc.hubUrl}/grant/staging-db/query`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${grantToken}`,
      },
      body: JSON.stringify({ sql }),
    },
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return JSON.stringify({ error: (error as any).message || response.statusText });
  }

  return JSON.stringify(await response.json());
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // 1. Create a time-limited grant for the AI
  console.log('Creating grant for staging-db...');
  const grant = await pc.grants.create({
    agentLabel: 'openai-assistant',
    resourceType: 'db',
    resourceName: 'staging-db',
    ttl: '5m',
    scope: 'read-only',
  });
  console.log(`Grant created (expires in 5 minutes)\n`);

  // 2. Run a conversation with tool calling
  const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: 'You are a helpful data analyst. Use the query_database tool to answer questions about the data.',
    },
    {
      role: 'user',
      content: 'How many users signed up in the last 7 days? Break it down by day.',
    },
  ];

  console.log('Asking the AI...\n');

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages,
    tools: [queryDatabaseTool],
  });

  const choice = response.choices[0];

  if (choice.message.tool_calls) {
    for (const call of choice.message.tool_calls) {
      if (call.function.name === 'query_database') {
        const args = JSON.parse(call.function.arguments);
        console.log(`SQL: ${args.sql}\n`);

        const result = await executeQuery(args.sql, grant.token!);
        console.log(`Result: ${result}\n`);

        // Feed result back to the model
        messages.push(choice.message);
        messages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: result,
        });
      }
    }

    // Get final response
    const finalResponse = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
    });

    console.log('Answer:', finalResponse.choices[0].message.content);
  } else {
    console.log('Response:', choice.message.content);
  }

  // 3. Clean up (optional — grant expires automatically)
  await pc.grants.revoke(grant.id);
  console.log('\nGrant revoked.');
}

main().catch(console.error);
