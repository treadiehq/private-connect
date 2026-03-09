# Private Connect

**Reach your database and private services from anywhere. No VPN, no open ports, no changing localhost to 0.0.0.0.**

Your database binds to localhost. You need it from your laptop, a cloud IDE, or another machine. One command on each side connects them.

```bash
# On the machine with the DB
connect expose localhost:5432 --name my-db

# From anywhere else
connect reach my-db
# → localhost:5432 now points at my-db. Same connection string, works everywhere.
```

No port forwarding, no firewall rules. Works with Tailscale.

## Install

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

Or try without signup:

```bash
npx private-connect tunnel 3000
```

Share your entire local environment with a teammate, no signup:

```bash
npx private-connect up 3000 5432 6379
# → npx private-connect join k7m2p9    (send this to your teammate)
```

## How It Works

```
┌─────────────────┐         ┌───────┐         ┌─────────────────┐
│   Your Server   │────────▶│  Hub  │◀────────│   Your Laptop   │
│                 │         └───────┘         │                 │
│ connect :5432   │                           │ connect prod-db │
└─────────────────┘                           └─────────────────┘
```

An agent runs on each machine. Expose services from one, reach them from another. All traffic is encrypted. Services are private to your workspace.

- **Access by name** — `connect prod-db` instead of remembering IPs or ports
- **Stable ports** — same service always gets the same local port across restarts
- **Encrypted** — end-to-end encrypted tunnels with audit logging
- **Works everywhere** — on top of Tailscale, VPN, or plain internet

## Share with teammates

```bash
# Share your environment
connect share
# → Share code: x7k9m2

# Teammate joins with one command
connect join x7k9m2
# → Same services, same ports. Done.
```

## Build from source

```bash
git clone https://github.com/treadiehq/private-connect.git
cd private-connect && pnpm install
cd apps/agent && pnpm run build:binary
```

## Docs

- [Full CLI reference](DETAILED.md)
- [API reference](DETAILED.md#control-api)
- [Free tier (no signup)](docs/free-tier.md)
- [Security](docs/security.md)
- [SDK](packages/sdk)
- [Use cases](USE_CASES.md)

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

## License

[FSL-1.1-MIT](LICENSE)
