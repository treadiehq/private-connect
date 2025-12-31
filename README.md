# Private Connect

Securely connect and test private services across any environment, no VPNs, no firewall rules.

## Install

```bash
# Quick install (when releases are published)
curl -fsSL https://privateconnect.co/install.sh | bash

# Or from source
git clone https://github.com/treadiehq/private-connect.git && cd private-connect
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

## Live

Try the product live at **https://privateconnect.co**

## Community & Support

Join our Discord community for discussions, support, and updates:

[![Discord](https://img.shields.io/badge/Discord-Join%20our%20community-7289DA?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

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
connect expose localhost:5432 --name prod-db # Local service
connect expose 192.168.1.50:8080 --name internal-api # LAN service  
connect expose db.internal:5432 --name prod-db       # Internal DNS name
```

The agent just needs network access to the target. So you could run an agent on a jump box and expose services on the internal network that only that box can reach.

### 3. From another environment, connect to the service and test connectivity

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
  │  TLS     ✓  OK                          │
  │  HTTP    ✓  200 OK                      │
  │  Latency    45ms                        │
  │  From       local                       │
  └─────────────────────────────────────────┘

  ✓ Connected to prod-db on localhost:5432
```

You can now connect to `localhost:5432` as if the database was running locally.

> **expose vs reach**: Use `expose` on the machine with the service. Use `reach` on the machine where you want to access it.

### Quick test (no agent needed)

```bash
connect reach https://vault.example.com:8200
```

### Public URLs (for webhooks)

Expose a local service with a public URL for testing webhooks from Stripe, GitHub, etc:

```bash
connect expose localhost:3000 --name my-webhook --public
```

### Subdomain Proxy

Access all your services via memorable subdomains instead of random ports:

```bash
connect proxy --port 3000
# Now access: http://prod-db.localhost:3000, http://my-api.localhost:3000
```

## CLI Reference

```bash
connect up                    # Start agent, authenticate
connect expose <host:port>    # Expose a service (run on the server)
connect reach <service>       # Connect to a service or Test connectivity (run on your laptop)
connect proxy                 # Access services via subdomains (my-api.localhost:3000)
connect whoami                # Show agent info
connect update                # Update CLI to latest version
connect logout                # Clear local credentials
```

### Options

```bash
# Global (all commands)
-h, --hub <url>        Hub URL (default: $CONNECT_HUB_URL or localhost:3001)
-c, --config <path>    Config file (for multiple agents on same machine)

# connect up
-k, --api-key <key>    Workspace API key (skips browser auth)
-l, --label <label>    Environment label (default: hostname)
-n, --name <name>      Agent name
-t, --token <token>    Pre-auth token for CI/CD

# connect expose
-n, --name <name>      Service name
-p, --protocol <type>  auto|tcp|http|https
--public               Get a public URL for webhooks

# connect reach
-p, --port <port>      Local port (default: same as service)
-t, --timeout <ms>     Timeout (default: 5000)
--check                Only run diagnostics, don't create tunnel
--json                 JSON output

# connect proxy
-p, --port <port>      Proxy port (default: 3000)

# connect update
-f, --force            Force update even if on latest
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

### Database

PostgreSQL is required. The start script handles this automatically via Docker.

```bash
# Manual setup (if needed)
docker compose up -d postgres
cp apps/api/.env.example apps/api/.env
cd apps/api && pnpm db:push
```

## Security

- All agent-to-hub traffic is encrypted (TLS required in production)
- Agent tokens expire after 30 days and support rotation
- Credentials never transit the hub—only connection metadata
- Audit logging for token usage and IP changes
- Log scrubbing prevents sensitive data leakage

See our [Security FAQ](https://privateconnect.co/#security) for more details.

## License

[FSL-1.1-MIT](LICENSE)
