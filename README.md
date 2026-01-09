# Private Connect

The fastest way to securely expose and access private services.

## Quick Start

```bash
# Test connectivity (no signup)
npx private-connect test db.internal:5432

# Install
curl -fsSL https://privateconnect.co/install.sh | bash

# Authenticate once
connect up

# Use
connect localhost:5432           # Expose a service
connect prod-db                  # Access a service
connect localhost:5432 --share   # Get a shareable link
```

## What It Does

| You want to... | Command |
|----------------|---------|
| Expose a service | `connect localhost:5432` |
| Access a service | `connect prod-db` |
| Share with a teammate | `connect localhost:5432 --share` |
| Clone a teammate's setup | `connect clone alice` |

Everything is automatic: auto-naming, background daemon, local DNS.

## How It Works

```
┌─────────────────┐         ┌───────┐         ┌─────────────────┐
│   Your Server   │────────▶│  Hub  │◀────────│   Your Laptop   │
│                 │         └───────┘         │                 │
│ connect :5432   │                           │ connect prod-db │
└─────────────────┘                           └─────────────────┘
```

Run an agent on each machine. Expose services from one, access from another.

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

## Links

- **Live**: [privateconnect.co](https://privateconnect.co)
- **Docs**: [DETAILED.md](DETAILED.md) — full CLI reference, all features
- **Use Cases**: [USE_CASES.md](USE_CASES.md) — real scenarios
- **Security**: [docs/security.md](docs/security.md) — architecture details
- **SDK**: [packages/sdk](packages/sdk) — TypeScript SDK for programmatic access

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

## License

[FSL-1.1-MIT](LICENSE)
