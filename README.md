# Private Connect

Securely access private services from anywhere. No VPN or SSH tunnels.

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

**[See Use Cases & Examples](USE_CASES.md)** — real scenarios where Private Connect saves hours

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

### Always-On Daemon

Run the agent in the background, starts automatically on boot:

```bash
connect daemon install   # Install and start
connect daemon status    # Check status
connect daemon logs      # View logs
connect daemon uninstall # Remove
```

### Project Dev Mode

Define services per-project and connect with one command:

```bash
connect dev --init  # Creates pconnect.yml
connect dev         # Connects all services
```

```yaml
# pconnect.yml
services:
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
```

### Share with Teammates

Share your exact environment with a teammate:

```bash
# You
connect share           # Creates a share code
# → Share code: x7k9m2

# Teammate  
connect join x7k9m2     # Joins your environment
# → Same services, same ports
```

### Public Links (for Contributors)

Create a public URL for a service—no CLI or account needed to access:

```bash
connect link api --expires 7d --methods GET
# → https://link.privateconnect.co/share_abc123...
```

Perfect for open-source contributors who need to hit your prod API:

```bash
connect link api --paths /api/v1,/health    # Restrict paths
connect link api --rate-limit 60            # 60 requests/min
```

## CLI Reference

```bash
connect up                    # Start agent, authenticate
connect expose <host:port>    # Expose a service (run on the server)
connect reach <service>       # Connect to a service (run on your laptop)
connect proxy                 # Access services via subdomains (my-api.localhost:3000)
connect link <service>        # Create public URL (no account needed to access)
connect daemon <action>       # Manage background daemon (install|start|stop|status|logs)
connect dev                   # Connect services from pconnect.yml
connect share                 # Share your environment with teammates
connect join <code>           # Join a teammate's shared environment
connect map <service> [port]  # Map a service to a local port
connect discover              # Scan for local services
connect whoami                # Show agent info
connect update                # Update CLI to latest version
connect logout                # Clear local credentials
connect doctor                # Check system health, fix issues
connect cleanup               # Clean up orphaned processes
connect status                # Quick status overview
connect clone <teammate>      # Clone a teammate's environment
connect shell-init            # Shell integration (prompt & auto-connect)
connect dns <action>          # Local DNS for *.connect domains
connect mcp <action>          # AI assistant integration
connect broker <action>       # Agent Permission Broker (init|status|hooks|audit)
connect broker run <command>  # Run command through permission broker
connect audit                 # View agent action audit log
```

### Options

```bash
# Global (all commands)
-h, --hub <url>        Hub URL (default: $CONNECT_HUB_URL or api.privateconnect.co)
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
-r, --replace          Kill existing proxy and take over

# connect link
-e, --expires <time>   Expiration: 1h, 24h, 7d, 30d, never (default: 24h)
-m, --methods <list>   Allowed methods: GET,POST,PUT,DELETE
-p, --paths <list>     Allowed paths: /api,/health
-r, --rate-limit <n>   Rate limit per minute

# connect daemon
-r, --replace          Kill existing daemon and restart

# connect doctor
--fix                  Auto-fix detected issues
--json                 JSON output

# connect cleanup
-f, --force            Actually perform cleanup (dry-run by default)

# connect update
-f, --force            Force update even if on latest
```

### Clone a Teammate's Environment

The fastest way to onboard — clone a teammate's entire setup in seconds:

```bash
# List teammates with clonable environments
connect clone --list
# → ● alice (MacBook-Pro)
# →     Services: 5 (4 online)
# →       ● staging-db
# →       ● redis
# →       ● user-api
# →       ... and 2 more

# Clone their environment
connect clone alice
# → ✓ Cloned 4 service(s) from alice
# → Generated: .env.pconnect
```

**What happens:**
1. Finds all services exposed by that teammate
2. Creates local tunnels to each one
3. Generates `.env.pconnect` with connection strings
4. You're ready to code in 30 seconds

```bash
# Generated .env.pconnect:
STAGING_DB_HOST=localhost
STAGING_DB_PORT=5432
REDIS_HOST=localhost
REDIS_PORT=6379
# ... etc
```

### Shell Integration

Enable prompt status and auto-connect when entering project directories:

```bash
# Add to ~/.zshrc or ~/.bashrc
eval "$(connect shell-init)"

# Or for fish shell (~/.config/fish/config.fish)
connect shell-init fish | source
```

**Features:**
- Prompt shows connected services count: `~/myapp (3 services) $`
- Auto-connects when you `cd` into a directory with `pconnect.yml`
- Quick status alias: `pcs`

```bash
# Interactive setup help
connect shell-setup
```

### Local DNS

Access services via memorable names like `prod-db.connect` instead of `localhost:5432`:

```bash
# Install DNS resolver (requires sudo)
connect dns install

# Now access services by name
psql -h prod-db.connect
curl http://api.connect/health
redis-cli -h redis.connect
```

```bash
connect dns status      # Check DNS server status
connect dns test api    # Test resolution for api.connect
connect dns uninstall   # Remove DNS configuration
```

### AI Integration

Private Connect works with AI assistants like Cursor and Claude Desktop via MCP:

```bash
# Setup instructions for your AI tool
connect mcp setup
```

**What AI can do once configured:**
- List and connect to services
- Run health checks
- Share environments
- Help debug connectivity issues

Example prompts:
- "List all my connected services"
- "Connect to the staging database"  
- "Check if the user-service is healthy"

### Agent Permission Broker (Experimental)

Control what AI coding assistants can do in your workspace.

```bash
connect broker init     # Initialize policy - (creates .connect/policy.yml)
connect broker run -- opencode  # Run agent through broker
connect audit           # View agent actions
```

See [docs/broker.md](docs/broker.md) for full documentation.

### Self-Healing & Diagnostics

Private Connect automatically handles common issues so you can focus on your work:

```bash
# Port in use? Auto-selects the next available
connect reach prod-db
# → ⚠ Port 5432 in use, using 5433 instead
# → ✓ Connected to prod-db on localhost:5433

# Check system health and fix issues
connect doctor          # Diagnose problems
connect doctor --fix    # Auto-repair

# Clean up orphaned processes
connect cleanup --force

# Take over existing proxy/daemon
connect proxy --replace
connect daemon start --replace
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

## License

[FSL-1.1-MIT](LICENSE)
