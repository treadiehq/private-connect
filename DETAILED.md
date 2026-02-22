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
connect share                 # Share environment with teammates
connect join <code>           # Join shared environment
connect clone <teammate>      # Clone teammate's environment
connect link <service>        # Create public URL
connect delete <service>      # Delete a service
connect proxy                 # Subdomain proxy (my-api.localhost:3000)
connect daemon <action>       # Background daemon (install|status|logs)
connect dev                   # Project dev mode (pconnect.yml)
connect serve                 # Expose all services from pconnect.yml
connect dns <action>          # Local DNS (*.connect domains)
connect mcp <action>          # AI assistant integration
connect broker <action>       # Agent Permission Broker
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

# connect link
-e, --expires <time>   1h, 24h, 7d, 30d, never
-m, --methods <list>   GET,POST,PUT,DELETE
-p, --paths <list>     /api,/health
-r, --rate-limit <n>   Requests per minute

# connect delete
-f, --force            Skip confirmation prompt

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

### Config-driven Expose (`connect serve`)

Add an `expose` block to your `pconnect.yml` to expose multiple local services with one command:

```yaml
# pconnect.yml
services:
  - name: staging-db
    port: 5432

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
connect serve       # Expose all entries under expose:
```

Each entry becomes a named service in the hub. Set `public: true` to get a public URL (for webhooks and demos). Teammates can `connect reach web` or `connect reach api` to access your services.

See [docs/config-driven-expose-webhooks-demos.md](docs/config-driven-expose-webhooks-demos.md) for the full guide.

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

### Agent Permission Broker

Control what AI can do in your workspace:

```bash
connect broker init          # Create policy.yml
connect broker run -- opencode
connect audit                # View action log
```

See [docs/broker.md](docs/broker.md).

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
| Public (auth, shares) | 100 requests/minute |
| Authenticated | 1000 requests/minute |

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
- Credentials never transit hub—only metadata
- Workspace isolation for multi-tenant
- Audit logging for token usage
- Log scrubbing prevents data leakage

See [docs/security.md](docs/security.md) for full architecture.

---

## License

[FSL-1.1-MIT](LICENSE)

