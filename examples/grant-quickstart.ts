/**
 * Quickstart: Give an AI agent access to your staging database in 30 seconds.
 *
 * Prerequisites:
 *   1. A running Private Connect agent: connect up && connect expose localhost:5432 --name staging-db
 *   2. An API key from the dashboard
 *
 * Usage:
 *   PRIVATECONNECT_API_KEY=your-key npx tsx grant-quickstart.ts
 */

import PrivateConnect from '@privateconnect/sdk';

async function main() {
  const pc = new PrivateConnect({
    apiKey: process.env.PRIVATECONNECT_API_KEY!,
  });

  // Create a 5-minute read-only grant
  const grant = await pc.grants.create({
    agentLabel: 'demo',
    resourceType: 'db',
    resourceName: 'staging-db',
    ttl: '5m',
    scope: 'read-only',
  });

  console.log('Grant created!\n');
  console.log(`  Token:    ${grant.token}`);
  console.log(`  Expires:  ${grant.expiresAt}`);
  console.log(`  Endpoint: ${pc.hubUrl}/grant/staging-db/query\n`);

  // Query the database through the grant
  const response = await fetch(`${pc.hubUrl}/grant/staging-db/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${grant.token}`,
    },
    body: JSON.stringify({
      sql: 'SELECT table_name FROM information_schema.tables WHERE table_schema = $1 LIMIT 10',
      params: ['public'],
    }),
  });

  const result = await response.json();
  console.log('Tables in the database:');
  console.log(JSON.stringify(result, null, 2));

  // Clean up
  await pc.grants.revoke(grant.id);
  console.log('\nGrant revoked.');
}

main().catch(console.error);
