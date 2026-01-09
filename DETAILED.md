# Private Connect — Detailed Documentation

Complete reference for all features and commands.

---

## Table of Contents

- [Installation](#installation)
- [Authentication](#authentication)
- [Core Commands](#core-commands)
- [Share & Collaborate](#share--collaborate)
- [CLI Reference](#cli-reference)
- [Advanced Features](#advanced-features)
- [Agent Orchestration](#agent-orchestration)
- [Development](#development)
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

---

## Share & Collaborate

### Instant Share Link

```bash
connect localhost:5432 --share --ttl=1h
```

Output:
```
Secure link created:
https://link.privateconnect.co/share/abc123

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
# → https://link.privateconnect.co/share_abc123
```

With restrictions:

```bash
connect link api --paths /api/v1,/health --rate-limit 60
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
connect proxy                 # Subdomain proxy (my-api.localhost:3000)
connect daemon <action>       # Background daemon (install|status|logs)
connect dev                   # Project dev mode (pconnect.yml)
connect dns <action>          # Local DNS (*.connect domains)
connect mcp <action>          # AI assistant integration
connect broker <action>       # Agent Permission Broker
connect doctor                # Diagnose issues
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

# connect daemon
-r, --replace          Replace existing

# connect doctor
--fix                  Auto-fix issues
```

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

### Subdomain Proxy

```bash
connect proxy --port 3000
# Access: http://prod-db.localhost:3000
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

