# Private Connect SDK

Define your connections in `pconnect.yml`. Access them from anywhere — your app, CI, an AI agent.

## Install

```bash
npm install @privateconnect/sdk
```

## Quick Start

**1. Create `pconnect.yml` in your project root:**

```yaml
resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp
  redis-cache:
    type: redis
    host: redis.internal
    port: 6379
    access:
      mode: tcp
```

**2. Use it in your code:**

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = PrivateConnect.fromManifest();

const db = pc.resource('staging-db');
console.log(db.connectionString); // postgres://internal-db:5432
console.log(db.envVar);           // DATABASE_URL

const cache = pc.resource('redis-cache');
console.log(cache.connectionString); // redis://redis.internal:6379
```

**3. Run `connect dev` to make it live:**

```bash
connect dev
# → Provisions tunnels for every resource in pconnect.yml
# → Your app's connection strings now resolve to live services
```

That's it. Your app declares what it connects to. `connect dev` makes it work. An AI agent (or a teammate) can modify `pconnect.yml` to change the topology — without touching application code.

## Why This Matters

The `pconnect.yml` file is a diffable, reviewable, mergeable description of your project's connectivity. When an AI modifies it — adding a read replica, changing a TTL, switching an access mode — that's a PR you can review and merge. The SDK reads the manifest; the agent provisions it.

## Manifest API

### `PrivateConnect.fromManifest(path?, config?)`

Load a manifest and return a configured client. Auto-discovers `pconnect.yml` in the current directory (or parents) if no path is given.

```typescript
// Auto-discover
const pc = PrivateConnect.fromManifest();

// Explicit path
const pc = PrivateConnect.fromManifest('./infra/pconnect.yml');

// With hub API access (for grants, orchestration, etc.)
const pc = PrivateConnect.fromManifest('./pconnect.yml', {
  apiKey: process.env.PRIVATECONNECT_API_KEY,
});
```

### `pc.resource(name)`

Get a resource by name. Returns its resolved type, host, port, connection string, and suggested environment variable.

```typescript
const db = pc.resource('staging-db');
// {
//   name: 'staging-db',
//   type: 'postgres',
//   host: 'internal-db',
//   port: 5432,
//   connectionString: 'postgres://internal-db:5432',
//   envVar: 'DATABASE_URL',
//   accessMode: 'tcp',
//   via: 'direct'
// }
```

### `pc.resources()`

List all resources declared in the manifest.

```typescript
const all = pc.resources();
all.forEach(r => console.log(`${r.name}: ${r.connectionString}`));
```

### `pc.envBlock()`

Generate a `.env`-compatible block for all resources.

```typescript
console.log(pc.envBlock());
// DATABASE_URL=postgres://internal-db:5432
// REDIS_URL=redis://redis.internal:6379
// API_URL=http://payments.service.internal:3000
```

## Hub API

When you pass an API key, you also get access to the hub APIs for grants, agents, and services.

### Grants

Grant an AI agent temporary, scoped access to a private resource.

```typescript
const pc = PrivateConnect.fromManifest('./pconnect.yml', {
  apiKey: process.env.PRIVATECONNECT_API_KEY,
});

const grant = await pc.grants.create({
  agentLabel: 'claude',
  resourceType: 'db',
  resourceName: 'postgres',
  ttl: '5m',
});
console.log(grant.token); // gnt_...
```

### Agent Orchestration

Coordinate agents across machines.

```typescript
const agents = await pc.agents.list({ onlineOnly: true });
const gpuAgents = await pc.agents.findByCapability('gpu');

await pc.agents.sendMessage(gpuAgents[0].id, {
  action: 'run-training',
  dataset: 'v2',
});
```

### Services

Query hub-registered services directly.

```typescript
const services = await pc.services.list();
const conn = await pc.connect('prod-db');
console.log(conn.connectionString);
```

## Manifest Format

The `pconnect.yml` file supports the following resource types:

| Type | Default Port | Connection String | Env Var |
|------|-------------|-------------------|---------|
| `postgres` | 5432 | `postgres://host:port` | `DATABASE_URL` |
| `mysql` | 3306 | `mysql://host:port` | `DATABASE_URL` |
| `redis` | 6379 | `redis://host:port` | `REDIS_URL` |
| `http` | 80 | `http://host:port` | `API_URL` |
| `generic-tcp` | — | `tcp://host:port` | `<NAME>_URL` |

Access modes:
- `tcp` — direct TCP tunnel (databases, Redis, generic)
- `http` — HTTP-level proxying

Transport:
- `direct` (default) — connect directly to the target
- `hub` — route through the Private Connect hub when the target isn't directly reachable

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `PRIVATECONNECT_API_KEY` | API key for hub access (grants, orchestration) |
| `CONNECT_HUB_URL` | Hub URL (default: `https://api.privateconnect.co`) |

## License

[FSL-1.1-MIT](LICENSE)
