# Private Connect

**Reach your database and private services from anywhere. Cursor, exe.dev, on the road with one command. No VPN, no open ports.**

Private Connect lets you and your AI agent reach databases, APIs, and internal services from another machine, a cloud IDE, or a second device without changing bind addresses or opening firewall ports. **Tailscale for services, not networks.**

**Who is this for?** Private Connect is for **developers**, **DevOps/platform**, and **QA/test**, anyone who needs to reach or expose private services without VPNs or port forwarding. From remote dev (exe.dev, Codespaces), from Cursor/agents, or on the road; Developers use it day to day; DevOps automates it in CI and infra; QA uses it to hit staging by name.

> **Example:** Have a local database but need to access it from another machine? On your local machine: `connect expose localhost:5432 --name my-db`. From anywhere: `connect reach my-db`. **Yes, this solves that problem**—no port forwarding, no firewall rules, no changing localhost to 0.0.0.0. Works with Tailscale.

- **Access by name:** `connect prod-db` instead of remembering IPs or ports
- **Onboard teammates in 30 seconds:** `connect clone alice` gives them your exact setup
- **Share instantly:** `connect share` → teammate runs `connect join`, same environment
- **Works with any infrastructure:** AWS, exe.dev, DigitalOcean, your local machine, or anywhere—works regardless of where services run
- **Solves a daily problem:** Access private services is something you need constantly, not just when setting up infrastructure
- **No port conflicts:** Services stay connected via background daemon
- **Bidirectional:** Access remote services, not just expose local ones (unlike ngrok)
- **Private by default:** Workspace isolation, not public URLs

## Quick Start

**Reach your DB from anywhere (recommended path):**

```bash
# Install once
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# On the machine with the DB: expose it by name
connect expose localhost:5432 --name my-db

# From anywhere (other laptop, exe.dev, Cursor): reach it
connect reach my-db
# → localhost:5432 now points at my-db. Same connection string, works everywhere.
```

```bash
# Quick tunnel (no signup, 2hr expiry)
npx private-connect tunnel 3000

# Test connectivity (no signup)
npx private-connect test db.internal:5432
```

## What It Does

| You want to... | Command |
|----------------|---------|
| Quick tunnel (no signup) | `npx private-connect tunnel 3000` |
| Named tunnel (webhook/demo) | `npx private-connect stripe 3000` |
| Expose a service | `connect 5432` |
| Access a service | `connect prod-db` |
| Share with a teammate | `connect 5432 --share` |
| Clone a teammate's setup | `connect clone alice` |
| Delete a service | `connect delete my-service` |
| Check status | `connect status` |

Everything is automatic: auto-naming, background daemon, local DNS.

**Quick tunnels** show your actual website at the public URL - perfect for demos and testing. Named tunnels get a readable subdomain (e.g. `stripe-a1b2.privateconnect.co`).

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

### Automated/Non-interactive

For scripts, CI/CD, VM provisioning (exe.dev, cloud-init, etc.):

```bash
curl -fsSL https://privateconnect.co/install.sh | bash -s -- \
  --non-interactive \
  --api-key=YOUR_KEY \
  --daemon \
  --expose-openclaw
```

See [scripts/exe-dev-openclaw.md](scripts/exe-dev-openclaw.md) for exe.dev one-click setup (OpenClaw gateway), or [scripts/cloud-init-openclaw.yaml](scripts/cloud-init-openclaw.yaml) for VPS provisioning.

### From source

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

## Ask (try any service)

Paste a URL or hostname and a question; we run read-only checks (e.g. `/health`, `/status`, `/version`) and return an answer. No signup. If unreachable, you're guided to enable Private Connect.

- **Web:** [http://localhost:3000/ask](http://localhost:3000/ask) · **API:** `POST /v1/ask` with `{ "service": "http://localhost:9000", "question": "Is it healthy?" }`
- **Run:** `pnpm dev` then open `/ask`. Optional: `pnpm demo:server` for a target on :9000.

- **LLM (optional):** In `apps/api/.env` set `ASK_LLM_PROVIDER`, `ASK_LLM_MODEL`, `ASK_LLM_API_KEY` (or `ASK_LLM_OLLAMA_URL` for Ollama). Falls back to stub if unset or on failure.

```bash
curl -s -X POST http://localhost:3001/v1/ask -H "Content-Type: application/json" \
  -d '{"service":"http://localhost:9000","question":"Is it healthy?"}'
```

## Links

- **Live**: [privateconnect.co](https://privateconnect.co)
- **DB + Cursor (2 min)**: [docs/database-and-cursor.md](docs/database-and-cursor.md) — expose local DB, reach from anywhere, use with Cursor
- **Docs**: [DETAILED.md](DETAILED.md) — full CLI reference, all features
- **API Reference**: [DETAILED.md#control-api](DETAILED.md#control-api) — REST API documentation
- **Debugging**: [docs/debugging.md](docs/debugging.md) — live traffic inspection, AI copilot
- **AI & MCP**: [docs/AI.md](docs/AI.md) — AI integration, orchestration, SDK
- **OpenClaw**: [docs/openclaw-remote-access.md](docs/openclaw-remote-access.md) — secure remote access to OpenClaw gateway
- **OpenCode**: [docs/opencode-remote-access.md](docs/opencode-remote-access.md) — secure remote access to OpenCode server
- **exe.dev / Mac Mini**: [docs/exe-dev-private-access.md](docs/exe-dev-private-access.md) — access private services from exe.dev VMs or Mac Mini
- **Virtual Kubernetes**: [docs/kubernetes-virtual-clusters-and-private-connect.md](docs/kubernetes-virtual-clusters-and-private-connect.md) — multicluster API server + distributed nodes over private tunnels
- **Use Cases**: [USE_CASES.md](USE_CASES.md) — real scenarios
- **Family abroad**: [docs/family-abroad.md](docs/family-abroad.md) — share your home with family (Tailscale + Private Connect)
- **Security**: [docs/security.md](docs/security.md) — architecture details
- **SDK**: [packages/sdk](packages/sdk) — TypeScript SDK for programmatic access

### Comparisons

- **vs Tailscale**: [docs/tailscale-and-private-connect.md](docs/tailscale-and-private-connect.md) — Tailscale is network access, Private Connect is service access
- **vs ngrok**: [docs/ngrok-and-private-connect.md](docs/ngrok-and-private-connect.md) — ngrok is public URLs, Private Connect is team collaboration

### Automation Scripts

- **exe.dev Template**: [scripts/exe-dev-openclaw.md](scripts/exe-dev-openclaw.md) — one-click OpenClaw + Private Connect VM
- **Cloud-Init**: [scripts/cloud-init-openclaw.yaml](scripts/cloud-init-openclaw.yaml) — VPS provisioning script for OpenClaw (AWS, DO, etc.)
- **Virtual Kubernetes**: [scripts/kubernetes-virtual-clusters-and-private-connect.md](scripts/kubernetes-virtual-clusters-and-private-connect.md) — recipe for multicluster API server + Private Connect

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

## License

[FSL-1.1-MIT](LICENSE)
