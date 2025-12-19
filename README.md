# Private Connect

Private connectivity for distributed teams.

Securely expose and test internal services across environments. Connect, expose, share access securely, and test services across any environment, no VPNs, no firewall rules.

## Install

```bash
# Quick install (when releases are published)
curl -fsSL https://get.privateconnect.io | bash

# Or from source
git clone <repo> && cd private-connect
pnpm install
./scripts/start.sh dev
```

### Build from source

```bash
# Build single binary (requires Bun)
cd apps/agent
pnpm run build:binary

# Install locally
./scripts/install.sh
```

## How It Works

Run agents in different environments. Each agent connects to the hub and can expose or reach services.

```
┌─────────────────┐                           ┌─────────────────┐
│   AWS Prod      │                           │   Your Laptop   │
│                 │         ┌───────┐         │                 │
│  connect up     │────────▶│  Hub  │◀────────│  connect up     │
│  --label prod   │         └───────┘         │  --label local  │
│                 │                           │                 │
│  connect expose │                           │  connect reach  │
│  localhost:5432 │                           │  prod-db        │
│  --name prod-db │                           │                 │
└─────────────────┘                           └─────────────────┘
```

## Usage

### 1. Connect or start an agent

```bash
connect up
```

First run opens browser for login. On servers, shows a code to enter from any device.

### 2. Expose a service

```bash
connect expose localhost:5432 --name prod-db
```

### 3. From another environment, test connectivity

```bash
# On your laptop or staging server
connect up --label local
connect reach prod-db
```

Output:
```
🔍 Reaching "prod-db"...

  ✓ REACHABLE

  ┌─────────────────────────────────────────┐
  │  DNS     ✓  OK                          │
  │  TCP     ✓  OK                          │
  │  Latency    45ms                        │
  └─────────────────────────────────────────┘
```

### Quick test (no agent needed)

```bash
connect reach https://vault.example.com:8200
```

## CLI Reference

```bash
connect up                    # Start agent, authenticate
connect expose <host:port>    # Expose a local service
connect reach <target>        # Test connectivity
connect whoami                # Show agent info
```

### Options

```bash
# Global (all commands)
-h, --hub <url>        Hub URL (default: http://localhost:3001)
-c, --config <path>    Config file (for multiple agents on same machine)

# connect up
-k, --api-key <key>    Workspace API key (skips browser auth)
-l, --label <label>    Environment label (default: hostname)
-n, --name <name>      Agent name
-t, --token <token>    Pre-auth token for CI/CD

# connect expose
-n, --name <name>      Service name
-p, --protocol <type>  auto|tcp|http|https

# connect reach
-t, --timeout <ms>     Timeout (default: 5000)
--json                 JSON output
```

### Multiple Agents (Same Machine)

```bash
# Terminal 1 - First agent
connect up --label agent-1 --config ~/.private-connect/agent1.json
connect expose localhost:8080 --name api --config ~/.private-connect/agent1.json

# Terminal 2 - Second agent
connect up --label agent-2 --config ~/.private-connect/agent2.json
connect reach api --config ~/.private-connect/agent2.json
```

### CI/CD / Automation

```bash
# Using API key directly
connect up --api-key pc_xxx --label prod-server --hub https://hub.example.com

# Or via environment variable
PRIVATECONNECT_TOKEN=pc_xxx connect up --label prod-server
```

## Web UI

Open http://localhost:3000 to:
- View services and their status
- See diagnostic history
- Run checks from different agents
- Manage API keys

## Development

```bash
./scripts/start.sh dev      # Start API + Web + Demo
./scripts/stop.sh           # Stop all
./scripts/status.sh         # Show running services
```

### Database Setup

The API uses PostgreSQL. For local development:

```bash
# Start PostgreSQL with Docker
docker compose up -d postgres

# Set DATABASE_URL
export DATABASE_URL="postgresql://securelog:securelog@localhost:5432/securelog"

# Run migrations
cd apps/api
pnpm db:push
pnpm db:seed
```

Or run everything with Docker Compose:

```bash
docker compose up
```

## License

[FSL-1.1-MIT](LICENSE)
