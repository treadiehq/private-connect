# Agent Grants Demo

Give an AI agent scoped, logged access to a private database or API. The agent gets a token and an endpoint. You see every request it makes and can revoke access at any time.

## Prerequisites

- Private Connect running (`pnpm run dev`)
- A service exposed (e.g., a Postgres database via `connect expose localhost:5432 --name postgres`)
- An API key (`connect up`)

## 1. Create a grant (CLI)

### Time-limited (expires in 5 minutes)

```bash
connect grant claude --db postgres --ttl 5m
```

### Persistent (never expires, revoke manually)

```bash
connect grant claude --db postgres --persistent
```

Output:

```
  Grant created.

  Agent:     claude
  Resource:  postgres (db)
  Scope:     read-only
  Expires:   persistent (revoke manually)

  Endpoint:  postgres.agent.privateconnect.co
  Token:     gnt_aBcDeFgHiJkLmNoPqRsTuVwXyZ012345

  Give the endpoint and token to the AI agent.
  This grant never expires. Revoke with: connect grant --revoke <id>
```

## 2. Query the database

Use the token to run a read-only SQL query:

```bash
curl -X POST http://localhost:3001/grant/postgres/query \
  -H "Authorization: Bearer gnt_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT id, email FROM users ORDER BY created_at DESC LIMIT 5"}'
```

Expected response:

```json
{
  "rows": [
    { "id": "abc-123", "email": "alice@example.com" },
    { "id": "def-456", "email": "bob@example.com" }
  ],
  "fields": ["id", "email"],
  "rowCount": 2
}
```

## 3. Try a mutation (denied)

```bash
curl -X POST http://localhost:3001/grant/postgres/query \
  -H "Authorization: Bearer gnt_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"sql": "DELETE FROM users WHERE id = '\''abc-123'\''"}' 
```

Expected response:

```json
{
  "error": "Read-only grant",
  "message": "This grant only allows SELECT, SHOW, DESCRIBE, and EXPLAIN queries."
}
```

Both the allowed query and the denied mutation appear in the access logs.

## 4. Proxy an API (HTTP)

For API-type grants, requests are proxied through the hub:

```bash
# Create an API grant
connect grant claude --api staging-api --ttl 1h

# Use it (read-only scope only allows GET/HEAD/OPTIONS)
curl http://localhost:3001/grant/staging-api/v1/users \
  -H "Authorization: Bearer gnt_YOUR_TOKEN_HERE"
```

A POST/PUT/DELETE with a read-only grant is rejected:

```bash
curl -X POST http://localhost:3001/grant/staging-api/v1/users \
  -H "Authorization: Bearer gnt_YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
```

```json
{
  "error": "Read-only grant",
  "message": "This grant is read-only. POST is not allowed."
}
```

## 5. View activity in the UI

1. Open the service detail page in the web app
2. The **Agent Grants** panel shows all active grants
3. Click the clipboard icon on any grant to expand its access logs
4. Each log entry shows: request summary, status, allowed/denied, latency, timestamp

## 6. Manage grants

### List active grants

```bash
connect grant --list
```

```
  Active grants:

  claude → postgres (db)  read-only  persistent  3 requests  gnt_aBcDeFgH...  a1b2c3d4
  cursor → staging-api (api)  read-only  expires in 58m  gnt_xYzAbCdE...  e5f6g7h8
```

### Revoke a grant

```bash
connect grant --revoke a1b2c3d4
```

After revocation, any request with that token returns:

```json
{
  "error": "Access denied",
  "message": "Grant invalid, expired, or revoked."
}
```

## 7. Create a grant from the web UI

1. Open a service detail page
2. In the **Agent Grants** panel, click **New Grant**
3. Fill in the agent label, resource type, scope, and expiration
4. Click **Create Grant**
5. Copy the token (shown once) and the auto-generated curl example
6. Click **Done**

## How it works

```
AI Agent                    Hub                         Your Machine
   │                         │                              │
   │  POST /grant/pg/query   │                              │
   │  Bearer gnt_xxx         │                              │
   │ ──────────────────────> │                              │
   │                         │  validate token              │
   │                         │  check scope (read-only)     │
   │                         │  check SQL (SELECT only)     │
   │                         │                              │
   │                         │  forward via WebSocket       │
   │                         │ ───────────────────────────> │
   │                         │                              │  execute query
   │                         │           rows               │  locally
   │                         │ <─────────────────────────── │
   │                         │                              │
   │                         │  log access                  │
   │         { rows }        │                              │
   │ <────────────────────── │                              │
```

The hub never has direct access to your database. Queries are forwarded through the agent's encrypted WebSocket tunnel and executed on the machine where the database is reachable.
