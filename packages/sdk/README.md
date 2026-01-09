# Private Connect SDK

TypeScript SDK for Private Connect - programmatic access to services and agent orchestration.

## Installation

```bash
npm install @privateconnect/sdk
# or
pnpm add @privateconnect/sdk
```

## Quick Start

```typescript
import { PrivateConnect, connect } from '@privateconnect/sdk';

// Quick connect to a service
const db = await connect('postgres-prod');
console.log(db.connectionString); // postgres://localhost:5432/...

// Or use the full client
const pc = new PrivateConnect({ 
  apiKey: process.env.PRIVATECONNECT_API_KEY 
});

// List available services
const services = await pc.services.list();

// Connect to a specific service
const redis = await pc.connect('redis-cache');
console.log(redis.connectionString); // redis://localhost:6379
```

## Agent Orchestration

The SDK enables multi-agent orchestration - coordinating work across agents running on different machines.

### List Agents

```typescript
// Get all agents in your workspace
const agents = await pc.agents.list();

// Get only online agents
const online = await pc.agents.list({ onlineOnly: true });

// Find agents with specific capabilities
const gpuAgents = await pc.agents.findByCapability('gpu');
```

### Register Capabilities

Tell other agents what you can do:

```typescript
await pc.agents.registerCapabilities([
  { name: 'database', metadata: { type: 'postgres', version: '15' } },
  { name: 'gpu', metadata: { model: 'A100', memory: '80GB' } },
]);
```

### Agent Messaging

Coordinate with other agents:

```typescript
// Send a message to a specific agent
await pc.agents.sendMessage(targetAgentId, {
  action: 'run-migration',
  database: 'users',
});

// Broadcast to all agents
await pc.agents.broadcast({
  type: 'deployment-starting',
  service: 'api',
});

// Get your messages
const messages = await pc.agents.getMessages({ unreadOnly: true });
for (const msg of messages) {
  console.log(`From ${msg.from.name}: ${JSON.stringify(msg.payload)}`);
}
```

### Orchestration Sessions

Create ephemeral sessions for coordinated workflows:

```typescript
// Create a session
const session = await pc.sessions.create('deploy-v2.1', {
  ttlMinutes: 30,
  metadata: { version: '2.1.0' },
});

// ... coordinate agents ...

// End the session
await pc.sessions.end(session.id);
```

## Connection Strings

Get properly formatted connection strings for common services:

```typescript
const db = await pc.connect('postgres-prod');
// db.connectionString = 'postgres://localhost:5432/postgres'
// db.envVar = 'DATABASE_URL'

const cache = await pc.connect('redis-cache');
// cache.connectionString = 'redis://localhost:6379'
// cache.envVar = 'REDIS_URL'

const api = await pc.connect('internal-api');
// api.connectionString = 'http://localhost:8080'
// api.envVar = 'API_URL'
```

## Environment Variables

The SDK can read configuration from environment variables:

```bash
export PRIVATECONNECT_API_KEY=your-api-key
```

```typescript
// API key automatically read from env
const connection = await connect('my-service');
```

## API Reference

### `PrivateConnect`

Main client class.

```typescript
const pc = new PrivateConnect({
  apiKey: string,        // Required: Your API key
  hubUrl?: string,       // Optional: Hub URL (default: https://api.privateconnect.co)
  agentId?: string,      // Optional: Agent ID (auto-detected)
});
```

### `pc.services`

- `list()` - List all services
- `get(name)` - Get a service by name
- `getConnection(name)` - Get connection details for a service

### `pc.agents`

- `list(options?)` - List all agents
- `findByCapability(capability)` - Find agents by capability
- `registerCapabilities(capabilities)` - Register this agent's capabilities
- `sendMessage(toAgentId, payload, options?)` - Send a message
- `broadcast(payload, options?)` - Broadcast to all agents
- `getMessages(options?)` - Get received messages
- `markRead(messageIds)` - Mark messages as read

### `pc.sessions`

- `create(name, options?)` - Create an orchestration session
- `end(sessionId)` - End a session
- `getActive()` - Get active sessions

## License

[FSL-1.1-MIT](LICENSE)

