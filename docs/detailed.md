# Private Connect — Detailed Documentation

Complete reference for all features and commands.

---

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Core Commands](#core-commands)
- [Share & Collaborate](#share--collaborate)
- [CLI Reference](#cli-reference)
- [Live Debugging](#live-debugging)
- [Advanced Features](#advanced-features)
- [Agent Orchestration](#agent-orchestration)
- [Development](#development)
- [Monitoring](#monitoring)
- [Control API](#control-api)
- [Security](#security)

---

## Installation

### Quick Install

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

### From Source

```bash
git clone https://github.com/treadiehq/private-connect.git && cd private-connect
pnpm install
./scripts/start.sh dev
```

### Build Binary

```bash
cd apps/agent
pnpm run build:binary
./scripts/install.sh
```

---

## Authentication

### First Time Setup

```bash
connect up
```

Opens browser for login. On headless servers, shows a code to enter from any device.

### With API Key (CI/CD)

```bash
connect up --api-key pc_xxx --label prod-server
```

Or via environment:

```bash
PRIVATECONNECT_TOKEN=pc_xxx connect up --label prod-server
```

---

## Core Commands

### Expose a Service

Run on the machine with the service:

```bash
connect localhost:5432              # Auto-named "postgres"
connect localhost:6379              # Auto-named "redis"
connect db.internal:5432            # Auto-named from port
```

With explicit naming:

```bash
connect expose localhost:5432 --name prod-db
connect expose 192.168.1.50:8080 --name internal-api
```

### Access a Service

Run on your laptop:

```bash
connect prod-db                     # Creates tunnel to localhost:5432
connect postgres                    # Works with auto-named services too
connect reach prod-db --port 5433   # Use different local port
```

Output:
```
🔍 Reaching "prod-db"...

  ✓ REACHABLE

  ┌─────────────────────────────────────────┐
  │  DNS     ✓  OK                          │
  │  TCP     ✓  OK                          │
  │  TLS     ✓  OK                          │
  │  HTTP    ✓  200 OK                      │
  │  Latency    45ms                        │
  └─────────────────────────────────────────┘

  ✓ Connected to prod-db on localhost:5432
```

### Quick Test (No Auth)

```bash
npx private-connect test vault.internal:8200
```

Checks TCP, TLS, HTTP, latency. No signup required.

### Quick SSH (No Auth)

```bash
# Host shares SSH
npx private-connect up 22

# Anyone SSHs in — one command
npx private-connect ssh <code>
npx private-connect ssh root@<code>

# Run a remote command and pipe output
npx private-connect ssh <code> -- whoami
npx private-connect ssh <code> -- cat /etc/hostname | claude
```

No signup, no config. The share code is the auth.

### Quick Tunnel (No Auth)

```bash
npx private-connect tunnel 3000
```

Creates a temporary public tunnel (2hr expiry). Works whether you're logged in or not. The public URL shows your actual website - perfect for demos and testing.

**Note:** Temporary tunnels are separate from authenticated tunnels. Use `npx private-connect tunnel` for quick, unauthenticated tunnels, or `connect expose --public` for persistent, authenticated public URLs.

---

## Share & Collaborate

### Instant Share Link

```bash
connect localhost:5432 --share --ttl=1h
```

Output:
```
Secure link created:
https://abc123xyz.privateconnect.co

Expires in 1 hour
```

### Share Environment

```bash
# You
connect share
# → Share code: x7k9m2

# Teammate
connect join x7k9m2
# → Same services, same ports
```

### Clone Teammate's Setup

```bash
connect clone --list          # See available teammates
connect clone alice           # Clone their environment
# → ✓ Cloned 4 service(s) from alice
# → Generated: .env.pconnect
```

### Public Links (External Access)

```bash
connect link api --expires 7d --methods GET
# → https://abc123xyz.privateconnect.co
```

With restrictions:

```bash
connect link api --paths /api/v1,/health --rate-limit 60
```

### Delete Services

```bash
# Delete with confirmation
connect delete my-old-service

# Delete without confirmation
connect delete my-old-service --force
```

---

## CLI Reference

### All Commands

```bash
connect <target>              # Expose if local, reach if service name
connect up                    # Authenticate
connect expose <host:port>    # Expose a service
connect reach <service>       # Access a service
connect ssh <service>         # SSH into a machine exposing a service
connect share                 # Share environment with teammates
connect join <code>           # Join shared environment
connect clone <teammate>      # Clone teammate's environment
connect link <service>        # Create public URL
connect delete <service>      # Delete a service
connect run <name> <cmd...>   # Run a command and expose via proxy
connect proxy                 # Subdomain proxy (my-api.localhost:3000)
connect hosts <action>        # Manage /etc/hosts for Safari compat (sync|clean)
connect daemon <action>       # Background daemon (install|status|logs)
connect dev                   # Provision resources + expose services (pconnect.yml)
connect dns <action>          # Local DNS (*.connect domains)
connect mcp <action>          # AI assistant integration
connect status                # Quick status check (hub, agent, daemon)
connect doctor                # Full diagnostics
connect cleanup               # Clean orphaned processes
connect whoami                # Show agent info
connect update                # Update CLI
connect logout                # Clear credentials
```

### Options

```bash
# Global
-h, --hub <url>        Hub URL
-c, --config <path>    Config file

# connect up
-k, --api-key <key>    API key (skips browser)
-l, --label <label>    Environment label
-n, --name <name>      Agent name

# connect expose / connect <target>
-n, --name <name>      Service name
-p, --protocol <type>  auto|tcp|http|https
--public               Get public URL
-s, --share            Create share link
--ttl <duration>       Share TTL: 30m, 1h, 24h, 7d

# connect reach
-p, --port <port>      Local port
-t, --timeout <ms>     Timeout
--check                Only diagnostics
--json                 JSON output

# connect ssh
-u, --user <user>      SSH username (default: current OS user)

# connect link
-e, --expires <time>   1h, 24h, 7d, 30d, never
-m, --methods <list>   GET,POST,PUT,DELETE
-p, --paths <list>     /api,/health
-r, --rate-limit <n>   Requests per minute

# connect delete
-f, --force            Skip confirmation prompt

# connect run
--port <port>          Use a specific port (default: auto-assign 4000+)
--https                Ensure proxy uses HTTPS

# connect proxy start
--lan                  Bind to LAN, advertise via mDNS (connect.local)
--wildcard             Fall back to parent route for unregistered subdomains

# connect daemon
-r, --replace          Replace existing

# connect status
--json                 JSON output

# connect doctor
--fix                  Auto-fix issues
```

---

## Live Debugging

Real-time traffic inspection and AI-powered debugging for your services.

### Quick Start

```bash
# Expose a service with debug mode enabled
connect expose localhost:3000 --debug

# Output:
# ✓ Service exposed: my-api
# ✓ Debug session active
# 
# Debug viewer: https://app.privateconnect.co/debug/abc123
# Share this link with teammates for live pair-debugging
```

### Debug Viewer

The debug viewer shows real-time traffic flowing through your service:

- **Live Traffic Stream** - See requests/responses as they happen
- **Protocol Detection** - Automatically identifies HTTP, GraphQL, gRPC, PostgreSQL, Redis, MySQL
- **Status Codes** - Color-coded status (green for 2xx, yellow for 4xx, red for 5xx)
- **Timing** - Response times for each request
- **Payload Inspection** - Expand any request to see full headers and body
- **Request Replay** - Re-send captured requests for testing

### Filtering

Filter traffic by protocol, direction, or search:

```
Protocol: All | HTTP | GraphQL | gRPC | PostgreSQL | Redis | MySQL
Direction: All | Inbound | Outbound
Search: [search term]
```

### AI Copilot

Get AI-powered analysis of your traffic:

```bash
# Enable AI analysis in debug sessions
connect expose localhost:3000 --debug --ai
```

Features:
- **Ask questions** - "Why is this request failing?" or "Explain this error"
- **Auto-analyze errors** - Automatically surfaces issues when 4xx/5xx responses occur
- **Pattern detection** - Identifies slow queries, N+1 problems, auth issues

Configure AI in the web UI under Settings → AI Copilot. Supports:
- **Ollama** (local, privacy-first)
- **OpenAI** (GPT-5.2, GPT-4.5, GPT-4o)
- **Anthropic** (Claude Opus 4.5, Sonnet 4)

### Session Sharing

Debug sessions are shareable - perfect for pair-debugging:

```bash
# The debug URL is shareable by default
# https://app.privateconnect.co/debug/abc123

# Viewers see:
# - Live traffic stream
# - Who else is viewing (presence indicators)
# - Full inspection capabilities
```

### Export

Export debug sessions for later analysis or sharing:

- **JSON** - Full packet data for programmatic analysis
- **Markdown** - Human-readable recap with summary statistics

### CLI Flags

```bash
connect expose <target> [options]

# Debug options
--debug              Enable debug session with live traffic viewer
--ai                 Enable AI copilot for the debug session
```

See [docs/debugging.md](docs/debugging.md) for complete documentation.

---

## Agent-Native Resource Access

Private Connect can expose private resources as named, ephemeral endpoints for humans and AI agents.

### Config Schema

Add a `resources:` section to your `pconnect.yml`:

```yaml
resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp

  payments-api:
    type: http
    url: http://payments.service.internal:3000
    access:
      mode: http

  redis-cache:
    type: redis
    host: redis.internal
    port: 6379
    access:
      mode: tcp

  prod-db:
    type: postgres
    host: prod-db.vpc
    port: 5432
    access:
      mode: tcp
      via: hub    # Route through Private Connect hub
```

**Supported resource types:** `postgres`, `mysql`, `redis`, `http`, `generic-tcp`

**Fields:**
| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | Resource type |
| `host` / `targetHost` | Yes (tcp) | Target hostname |
| `port` / `targetPort` | No | Target port (defaults to standard port for type) |
| `url` | Yes (http) | Full URL for HTTP resources |
| `access.mode` | Yes | `tcp` or `http` |
| `access.via` | No | `direct` (default) or `hub` |

### List Resources

```bash
connect resources
```

Output:
```
  staging-db     postgres    internal-db:5432
  payments-api   http        payments.service.internal:3000
  redis-cache    redis       redis.internal:6379
  prod-db        postgres    prod-db.vpc:5432 [hub]
```

```bash
connect resources --json
```

```json
{
  "ok": true,
  "resources": [
    { "name": "staging-db", "type": "postgres", "target": "internal-db:5432", "via": "direct" }
  ]
}
```

### Connect to a Resource

```bash
connect resource staging-db
```

Output:
```
  ✔ Connected to staging-db
    Type:       postgres
    Endpoint:   postgres://127.0.0.1:5432
    Expires in: 15m
    Name:       staging-db.pc
    psql:       psql -h 127.0.0.1 -p 5432

  Press Ctrl+C to disconnect
```

### JSON Mode for Agents

```bash
connect resource staging-db --json
```

Returns only JSON, no logs:
```json
{
  "ok": true,
  "session": {
    "id": "sess_a1b2c3d4e5f6g7h8",
    "resource": "staging-db",
    "type": "postgres",
    "protocol": "tcp",
    "endpoint": "postgres://127.0.0.1:5432",
    "expiresAt": "2026-03-25T12:15:00.000Z",
    "expiresInSeconds": 900,
    "suggestedName": "staging-db.pc"
  }
}
```

On error:
```json
{
  "ok": false,
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Resource 'foo' not found in config. Available: staging-db, payments-api"
  }
}
```

**Error codes:** `RESOURCE_NOT_FOUND`, `CONFIG_NOT_FOUND`, `CONFIG_INVALID`, `PORT_UNAVAILABLE`, `CONNECTION_FAILED`, `TARGET_UNREACHABLE`, `HUB_NOT_CONFIGURED`

### Options

```bash
connect resource <name> [options]

--json              Machine-friendly JSON output (no extra logs)
--local             Force direct connection (skip hub even if config says via: hub)
--ttl <duration>    Session TTL: 15m, 1h, 300s (default: 15m)
--port <port>       Local port to bind (default: same as resource target port)
--name <alias>      Override display name
-f, --file <path>   Path to pconnect.yml
```

### TTL Behavior

The session stays in foreground (like `connect reach`). The TTL is a real timer — when it expires, the process exits cleanly. Most developers will Ctrl+C before the timer fires.

Supported formats: `15m`, `1h`, `300s`

### Transport Modes

- **`direct`** (default): the CLI machine connects directly to the resource target. No hub needed.
- **`hub`**: the connection routes through the Private Connect hub, wrapping the existing `reach` flow. Useful when the CLI machine cannot reach the target directly, but a connected agent can.

Use `--local` to force direct mode regardless of config.

### Current Limitations

- `.pc` names are informational only — no DNS resolution yet
- No background daemon or multi-session management
- No remote share links for resource sessions
- Auth for resource connections is not yet implemented

---

## Advanced Features

### Background Daemon

```bash
connect daemon install   # Install and start
connect daemon status    # Check status
connect daemon logs      # View logs
connect daemon uninstall # Remove
```

### Project Dev Mode

Create `pconnect.yml`:

```yaml
services:
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
```

Then:

```bash
connect dev --init  # Create config
connect dev         # Connect all services
```

### Config-driven Expose

Add an `expose` block to your `pconnect.yml` to expose multiple local services:

```yaml
# pconnect.yml
expose:
  web:
    target: localhost:3000
    public: true
  api:
    target: localhost:8000
  webhooks:
    target: localhost:3000
    public: true
```

Then:

```bash
connect dev         # Provisions resources AND exposes services from pconnect.yml
```

Each entry becomes a named service in the hub. Set `public: true` to get a public URL (for webhooks and demos). Teammates can `connect reach web` or `connect reach api` to access your services.

### Local Proxy & Subdomains

Access reached services via `.localhost` subdomains instead of remembering port numbers:

```bash
# Start the local proxy (runs as background daemon)
connect proxy start

# Reach a service (auto-starts the proxy if needed)
connect reach my-api
# → TCP:   localhost:8080
# → HTTP:  http://my-api.localhost:3000
#           (proxy auto-started on port 3000)

# Access in browser or curl
curl http://my-api.localhost:3000/health

# Check proxy status
connect proxy status

# Stop it when done
connect proxy stop
```

With HTTPS (auto-generates and trusts local CA certificates):

```bash
connect proxy start --https
# → https://my-api.localhost:3000

# Trust the CA separately
connect proxy trust

# Use your own certs
connect proxy start --https --cert ./cert.pem --key ./key.pem

# Run in foreground (for debugging)
connect proxy start --foreground
```

Certificates auto-renew when expiring within 30 days.

### `connect run` — One-Command Dev Server

Run any dev command and make it available through the proxy in one step. No auth required.

```bash
connect run api next dev
# → Assigns port 4000+, sets PORT env var, spawns "next dev"
# → Registers with proxy automatically
# → https://api.localhost:3000

connect run frontend vite
# → https://frontend.localhost:3000

# Override the assigned port
connect run --port 4000 api next dev

# Ensure HTTPS is enabled
connect run --https api node server.js
```

`connect run` sets the `PORT` environment variable so most frameworks (Next.js, Express, Nuxt, Fastify) pick up the port automatically. The route is cleaned up when the process exits.

Multiple services can run simultaneously — each gets its own port and subdomain.

### HTTP/2

When HTTPS is enabled, the proxy uses HTTP/2 with automatic HTTP/1.1 fallback. Browsers limit HTTP/1.1 to 6 concurrent connections per host, which bottlenecks unbundled dev servers (Vite, Nuxt) that serve many modules. HTTP/2 multiplexes all requests over a single connection.

No configuration needed — HTTP/2 activates automatically when TLS is active.

### LAN Mode

Test on real devices (phones, tablets, TVs) on the same Wi-Fi network:

```bash
connect proxy start --lan
# → Auto-detects your LAN IP
# → Generates HTTPS certs covering *.connect.local and the LAN IP
# → Advertises connect.local via mDNS
# → Binds on 0.0.0.0 (reachable from the network)
```

Services become available at `https://<name>.connect.local:<port>`:

```
From this machine:
  https://api.localhost:3000

From other devices on your network:
  https://api.connect.local:3000
```

LAN mode implies `--https`. The mDNS responder handles both `connect.local` and any subdomain of it (e.g. `api.connect.local`), so existing subdomain routing works on LAN devices too.

### Wildcard Subdomains

For multi-tenant apps where subdomains map to tenants:

```bash
connect proxy start --https --wildcard
```

When `--wildcard` is enabled, `tenant1.myapp.localhost` falls back to the `myapp` route if `tenant1` isn't a registered service. This lets you test multi-tenant routing locally without registering every subdomain.

### `/etc/hosts` Sync (Safari Fix)

Safari and some older DNS resolvers don't resolve `.localhost` subdomains. Private Connect can sync routes to `/etc/hosts`:

```bash
# Manual sync (prompts for sudo)
connect hosts sync

# Remove entries
connect hosts clean
```

The proxy also attempts a non-interactive sync on startup (via `sudo -n`). If credentials aren't cached, it skips silently. Entries are wrapped in `# BEGIN private-connect` / `# END private-connect` markers and cleaned up on proxy shutdown.

### Loop Detection

If your dev server proxies API requests back through the Private Connect proxy (e.g. Vite's `server.proxy`), the proxy detects the loop and returns `508 Loop Detected` with a fix:

> Set `changeOrigin: true` in your dev server proxy config.

```js
// vite.config.ts
server: {
  proxy: {
    "/api": {
      target: "https://api.localhost:3000",
      changeOrigin: true,  // required to avoid loops
    },
  },
}
```

Set `CONNECT=0` or `CONNECT=skip` to bypass Private Connect entirely (useful for CI):

```bash
CONNECT=0 pnpm dev  # runs directly, no tunneling
```

### Local DNS

```bash
connect dns install     # Requires sudo
psql -h prod-db.connect
curl http://api.connect/health
```

### Shell Integration

```bash
# Add to ~/.zshrc
eval "$(connect shell-init)"
```

Features:
- Prompt shows connected services: `~/myapp (3 services) $`
- Auto-connects in directories with `pconnect.yml`

### Multiple Agents (Same Machine)

```bash
# Terminal 1
connect up --label agent-1 --config ~/.connect/agent1.json
connect expose localhost:8080 --name api --config ~/.connect/agent1.json

# Terminal 2
connect up --label agent-2 --config ~/.connect/agent2.json
connect reach api --config ~/.connect/agent2.json
```

### AI Integration (MCP)

```bash
connect mcp setup
```

Works with Cursor, Claude Desktop. AI can:
- List and connect to services
- Run health checks
- Help debug connectivity

---

## Agent Orchestration

For distributed AI coding agents.

### TypeScript SDK

```bash
npm install @privateconnect/sdk
```

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({ apiKey: process.env.PRIVATECONNECT_API_KEY });

// Connect to a service
const db = await pc.connect('postgres-prod');
console.log(db.connectionString); // postgres://localhost:5432/...

// Find agents by capability
const gpuAgents = await pc.agents.findByCapability('gpu');

// Send message to agent
await pc.agents.sendMessage(gpuAgents[0].id, { action: 'train' });

// Get messages
const messages = await pc.agents.getMessages({ unreadOnly: true });
```

### MCP Tools

When connected via MCP, agents can use:

- `list_agents` — See all agents
- `find_agents_by_capability` — Discovery
- `send_agent_message` — Coordination
- `get_connection_string` — DATABASE_URL, REDIS_URL, etc.
- `register_capabilities` — Advertise capabilities

See [packages/sdk](packages/sdk) for full SDK docs.

---

## Development

### Local Setup

```bash
./scripts/start.sh dev      # Start API + Web + Demo
./scripts/stop.sh           # Stop all
./scripts/status.sh         # Show status
```

### Database

PostgreSQL required. Docker handles this:

```bash
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm db:push
```

### Web UI

Open http://localhost:3000:
- View services and status
- Diagnostic history
- Manage API keys

---

## Monitoring

### Health Check

```bash
curl https://api.privateconnect.co/health
```

Returns `{ "status": "ok", "database": "connected" }`.

### Hub Status

```bash
curl https://api.privateconnect.co/v1/status
```

Returns connected agents, active services, and runtime metrics:

```json
{
  "status": "ok",
  "uptime": 3600,
  "database": "connected",
  "hub": {
    "connectedAgents": 5,
    "activeServices": 12,
    "activeBridges": 3
  }
}
```

### CLI Status

```bash
connect status        # Quick overview
connect status --json # Machine-readable
```

---

## Control API

Private Connect exposes a full REST API for programmatic control of tunnels, agents, and workspace resources.

### API Documentation

Interactive API documentation is available at:
- **Swagger UI**: `https://api.privateconnect.co/docs`
- **OpenAPI Spec**: `https://api.privateconnect.co/openapi.json`

### Authentication

All API endpoints require authentication via API key:

```bash
curl -H "x-api-key: pc_your_api_key" https://api.privateconnect.co/v1/tunnels
```

Or via Bearer token (for session-based auth):

```bash
curl -H "Authorization: Bearer <session_token>" https://api.privateconnect.co/v1/tunnels
```

### Rate Limiting

| Endpoint Type | Limit |
|---------------|-------|
| Short burst | 10 requests/second |
| Sustained | 100 requests/minute |
| Hourly | 1000 requests/hour |

### Tunnels API

Manage tunnels as first-class resources.

```bash
# List all tunnels
GET /v1/tunnels

# Get tunnel details
GET /v1/tunnels/:id

# Create tunnel
POST /v1/tunnels
{
  "name": "prod-db",
  "targetHost": "localhost",
  "targetPort": 5432,
  "protocol": "tcp",
  "agentId": "agent-uuid"
}

# Update tunnel
PATCH /v1/tunnels/:id
{
  "name": "prod-db-renamed"
}

# Delete tunnel
DELETE /v1/tunnels/:id

# Create share for tunnel
POST /v1/tunnels/:id/share
{
  "ttl": "24h",
  "allowedMethods": ["GET", "POST"]
}
```

### Bundles API (Environment Sharing)

Share multiple local services at once with a short join code.

```bash
# Create a bundle (no auth required)
POST /v1/tunnels/temporary/bundle
{
  "ports": [3000, 5432, 6379],
  "ttlMinutes": 120
}

# Response:
{
  "code": "k7m2p9",
  "tcpHost": "api.privateconnect.co",
  "wsUrl": "wss://api.privateconnect.co/temp-tunnel",
  "ttlMinutes": 120,
  "expiresAt": "2026-02-24T23:00:00.000Z",
  "tunnels": [
    { "tunnelId": "abc123", "localPort": 3000, "tcpPort": 40001 },
    { "tunnelId": "def456", "localPort": 5432, "tcpPort": 40002 },
    { "tunnelId": "ghi789", "localPort": 6379, "tcpPort": 40003 }
  ]
}

# Get bundle info by join code (no auth required)
GET /v1/tunnels/temporary/bundle/:code

# Response:
{
  "code": "k7m2p9",
  "tcpHost": "api.privateconnect.co",
  "expiresAt": "2026-02-24T23:00:00.000Z",
  "tunnels": [
    { "localPort": 3000, "tcpPort": 40001, "connected": true },
    { "localPort": 5432, "tcpPort": 40002, "connected": true },
    { "localPort": 6379, "tcpPort": 40003, "connected": true }
  ]
}
```

**Limits:**
- Maximum 10 ports per bundle
- Auto-expires in 2 hours (max)
- No authentication required

### Audit API

Query audit logs and activity statistics.

```bash
# Get audit events
GET /v1/audit?limit=100&type=agent&since=2024-01-01

# Get audit statistics (30-day summary)
GET /v1/audit/stats

# Get events for specific agent
GET /v1/audit/agents/:id

# Get events for specific tunnel/service
GET /v1/audit/tunnels/:id
```

Response includes events from:
- Agent activity (connections, heartbeats, token usage)
- Share access (who accessed shared links)
- Sessions (reach connections between agents)
- Diagnostics (health checks)

### Webhooks

Subscribe to events for automation and integrations.

```bash
# List webhooks
GET /v1/webhooks

# Create webhook
POST /v1/webhooks
{
  "url": "https://your-server.com/webhook",
  "events": ["tunnel.created", "tunnel.deleted", "agent.connected"],
  "description": "Slack notifications"
}

# Update webhook
PATCH /v1/webhooks/:id
{
  "events": ["tunnel.created"]
}

# Delete webhook
DELETE /v1/webhooks/:id

# Rotate webhook secret
POST /v1/webhooks/:id/rotate-secret

# Test webhook
POST /v1/webhooks/:id/test

# List available events
GET /v1/webhooks/events
```

**Available Events:**
- `tunnel.created`, `tunnel.updated`, `tunnel.deleted`
- `share.created`, `share.accessed`, `share.revoked`
- `agent.connected`, `agent.disconnected`

**Webhook Payload:**
```json
{
  "event": "tunnel.created",
  "timestamp": "2024-01-15T10:30:00Z",
  "workspaceId": "ws_xxx",
  "data": {
    "tunnelId": "tun_xxx",
    "name": "prod-db"
  }
}
```

**Signature Verification:**

Webhooks include an HMAC signature in the `x-webhook-signature` header:

```javascript
const crypto = require('crypto');
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');

if (signature === req.headers['x-webhook-signature']) {
  // Valid webhook
}
```

### Widgets

Embed access buttons and status badges in your documentation or internal tools.

```bash
# Get embeddable JavaScript widget
GET /v1/widgets/:shareToken/embed.js

# Get HTML button
GET /v1/widgets/:shareToken/button

# Get widget configuration
GET /v1/widgets/:shareToken/config

# Get status badge (SVG)
GET /v1/widgets/:shareToken/badge
```

**Embed Example:**

```html
<script src="https://api.privateconnect.co/v1/widgets/abc123/embed.js"></script>
```

### Agent Provisioning

Programmatically create short-lived agent tokens for AI tool runtimes (Cursor, Claude Code, GitHub Actions, etc.) without the device authorization flow.

```bash
POST /v1/agents/provision
x-api-key: pc_your_api_key

{
  "clientType": "cursor",
  "label": "staging",
  "name": "cursor-agent-1",
  "ttlSeconds": 7200
}
```

**Response:**

```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "a1b2c3d4...",
  "expiresAt": "2026-02-24T18:00:00.000Z",
  "workspaceId": "ws-uuid",
  "workspaceName": "my-workspace"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `clientType` | string, required | Tool identity: `cursor`, `claude-code`, `codex`, `devin`, `github-actions`, `cli`, `sdk`, `other` |
| `label` | string, optional | Environment label (default: `"default"`) |
| `name` | string, optional | Friendly agent name |
| `ttlSeconds` | number, optional | Token lifetime in seconds (default: 7200, min: 300, max: 86400) |

The returned token can be used immediately to connect via WebSocket. It auto-expires after the requested TTL.

### Agent Commands

Send commands to agents for remote control.

```bash
POST /v1/agents/:id/command
{
  "action": "restart",
  "params": {}
}
```

### Other Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /v1/status` | Hub status and metrics |
| `GET /v1/agents` | List agents |
| `GET /v1/services` | List services |
| `POST /v1/auth/login` | Session login |
| `GET /v1/workspace` | Workspace info and usage |
| `GET /v1/api-keys` | Manage API keys |

---

## Security

- All traffic encrypted (TLS required in production)
- Agent tokens expire after 30 days, support rotation
- Provisioned tokens: short-lived (default 2h, max 24h) for AI agent runtimes
- Agent identity tracking: `clientType` logged in audit trail for every token event
- Credentials never transit hub—only metadata
- Workspace isolation for multi-tenant
- Audit logging for token usage with client type, IP, and user-agent
- Log scrubbing prevents data leakage

See [docs/security.md](docs/security.md) for full architecture.

---

## License

[FSL-1.1-MIT](LICENSE)

