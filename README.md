# Private Connect

**Access private services by name from anywhere. No VPN setup, no firewall rules, no port forwarding.**

Private Connect is **Tailscale for services, not networks**. Access your databases, APIs, and internal services with a simple command like `connect prod-db`, no VPN configuration or SSH tunnels required.

**Example:** Have a local database but need to access it from another machine? On your local machine: `connect expose localhost:5432 --name my-db`. From anywhere: `connect reach my-db`. **Yes, this solves that problem**—no port forwarding, no firewall rules, no changing localhost to 0.0.0.0. Works with Tailscale.

- **Access by name:** `connect prod-db` instead of remembering IPs or ports
- **Onboard teammates in 30 seconds:** `connect clone alice` gives them your exact setup
- **Share instantly:** `connect share` → teammate runs `connect join`, same environment
- **Works with any infrastructure:** AWS, exe.dev, DigitalOcean, your local machine, or anywhere—works regardless of where services run
- **Solves a daily problem:** Access private services is something you need constantly, not just when setting up infrastructure
- **No port conflicts:** Services stay connected via background daemon
- **Bidirectional:** Access remote services, not just expose local ones (unlike ngrok)
- **Private by default:** Workspace isolation, not public URLs

## Quick Start

```bash
# Test connectivity (no signup)
npx private-connect test db.internal:5432

# Quick tunnel (no signup, 2hr expiry)
npx private-connect tunnel 3000

# Install for permanent tunnels
curl -fsSL https://privateconnect.co/install.sh | bash

# Authenticate once
connect up

# Use
connect 5432                     # Expose a service
connect prod-db                  # Access a service
connect 5432 --share             # Get a shareable link

```

## What It Does

| You want to... | Command |
|----------------|---------|
| Quick tunnel (no signup) | `npx private-connect tunnel 3000` |
| Expose a service | `connect 5432` |
| Access a service | `connect prod-db` |
| Share with a teammate | `connect 5432 --share` |
| Clone a teammate's setup | `connect clone alice` |
| Check status | `connect status` |

Everything is automatic: auto-naming, background daemon, local DNS.

**Quick tunnels** show your actual website at the public URL - perfect for demos and testing.

## How It Works

```
┌─────────────────┐         ┌───────┐         ┌─────────────────┐
│   Your Server   │────────▶│  Hub  │◀────────│   Your Laptop   │
│                 │         └───────┘         │                 │
│ connect :5432   │                           │ connect prod-db │
└─────────────────┘                           └─────────────────┘
```

Run an agent on each machine. Expose services from one, access from another.

**Key Features:**
- **Zero Configuration** - No VPN setup, no firewall rules, no port forwarding
- **Secure** - End-to-end encrypted tunnels with audit logging
- **Live Debugging** - Real-time traffic inspection with AI-powered analysis
- **Team Collaboration** - Share services instantly with `connect share` or clone teammate setups
- **Works Everywhere** - Works on top of Tailscale, VPN, or plain internet
- **Open Source** - Self-hostable hub, inspect and modify the code
- **Service-Level** - Access services by name, not IP addresses or random URLs

## Install

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

Or from source:
```bash
git clone https://github.com/treadiehq/private-connect.git
cd private-connect && pnpm install
cd apps/agent && pnpm run build:binary
```

## Control API

Full REST API for programmatic control. Interactive docs available at `/docs` when running the API.

```bash
# List tunnels
curl -H "x-api-key: pc_xxx" https://api.privateconnect.co/v1/tunnels

# Get audit logs
curl -H "x-api-key: pc_xxx" https://api.privateconnect.co/v1/audit

# Create webhook
curl -X POST -H "x-api-key: pc_xxx" \
  -d '{"url":"https://example.com/hook","events":["tunnel.created"]}' \
  https://api.privateconnect.co/v1/webhooks
```

See [DETAILED.md#control-api](DETAILED.md#control-api) for full API reference.

## Links

- **Live**: [privateconnect.co](https://privateconnect.co)
- **Docs**: [DETAILED.md](DETAILED.md) — full CLI reference, all features
- **API Reference**: [DETAILED.md#control-api](DETAILED.md#control-api) — REST API documentation
- **Debugging**: [docs/debugging.md](docs/debugging.md) — live traffic inspection, AI copilot
- **AI & MCP**: [docs/AI.md](docs/AI.md) — AI integration, orchestration, SDK
- **Use Cases**: [USE_CASES.md](USE_CASES.md) — real scenarios
- **Security**: [docs/security.md](docs/security.md) — architecture details
- **SDK**: [packages/sdk](packages/sdk) — TypeScript SDK for programmatic access

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

## License

[FSL-1.1-MIT](LICENSE)
