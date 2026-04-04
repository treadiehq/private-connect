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

## SSH in one command

```bash
# Authenticated (named services)
connect ssh shell
connect ssh root@shell

# Unauthenticated (share codes, no install)
npx private-connect ssh <code>

# Run a command and pipe to AI
connect ssh shell -- cat /etc/hostname | claude
```

## Browser terminal

Give someone shell access with just a share code, no CLI install needed on their side.

```bash
# On your machine
connect shell && connect share
# → Share code: x7k9m2
```

They open `privateconnect.co/terminal`, enter the code, and get a live terminal.

## Agent-Native Resource Access

Private Connect can expose private resources as named, ephemeral endpoints for humans and AI agents.

Define resources in `pconnect.yml`, connect instantly, get a usable endpoint:

```yaml
# pconnect.yml
resources:
  staging-db:
    type: postgres
    host: internal-db
    port: 5432
    access:
      mode: tcp
```

```bash
connect resources                    # List all resources
connect resource staging-db          # Get postgres://127.0.0.1:5432
connect resource staging-db --json   # Stable JSON for AI agents
```

JSON output for agent workflows (Cursor, Claude Code, Codex):

```json
{
  "ok": true,
  "session": {
    "id": "sess_a1b2c3d4",
    "resource": "staging-db",
    "type": "postgres",
    "endpoint": "postgres://127.0.0.1:5432",
    "expiresAt": "2026-03-25T12:00:00.000Z",
    "expiresInSeconds": 900
  }
}
```

See [examples/pconnect-resources.yml](examples/pconnect-resources.yml) and [docs/detailed.md](docs/detailed.md#agent-native-resource-access).

## AI agent access

Grant an AI agent temporary, scoped access to a private resource. No credentials in prompts, no exposing services publicly.

```bash
connect grant claude --db postgres --ttl 5m
# → Token: gnt_...
# → Endpoint: https://api.privateconnect.co/grant/postgres
```

The AI can query the database over HTTP:

```bash
curl -X POST https://api.privateconnect.co/grant/postgres/query \
  -H "Authorization: Bearer gnt_..." \
  -d '{"sql": "SELECT count(*) FROM users"}'
# → {"rows": [{"count": 42}], "rowCount": 1}
```

Read-only grants block mutations. Access expires automatically.

```bash
connect grant --list          # Active grants
connect grant --revoke <id>   # Revoke early
```

Or manage grants programmatically with the SDK:

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({ apiKey: process.env.PRIVATECONNECT_API_KEY });
const grant = await pc.grants.create({
  agentLabel: 'claude',
  resourceType: 'db',
  resourceName: 'postgres',
  ttl: '5m',
});
// grant.token → give this to the AI agent
```

See [examples/](examples/) for LangChain and OpenAI integrations.

## Built for agents

Every CLI command supports `--json` for machine-readable output, `--help` with copy-pasteable examples, and flags for everything (no interactive prompts required).

```bash
connect expose localhost:3000 --name api --json
# → {"serviceId":"...","name":"api","target":"localhost:3000","tunnelPort":...}

connect grant claude --db postgres --ttl 5m --json
# → {"id":"...","token":"gnt_...","endpoint":"..."}

connect delete my-service --dry-run
# → Would delete service "my-service" (ID: ...). No changes made.
```

## CI / preview environments

Expose a local service from GitHub Actions and post a preview URL on the PR:

```yaml
- uses: treadiehq/private-connect/.github/actions/tunnel@main
  with:
    api-key: ${{ secrets.PRIVATE_CONNECT_KEY }}
    port: 3000
    ttl: 2h
    comment-on-pr: 'true'
```

See [the example workflow](.github/workflows/preview.yml.example) for a full setup.

## Build from source

```bash
git clone https://github.com/treadiehq/private-connect.git
cd private-connect && pnpm install
cd apps/agent && pnpm run build:binary
```

## Docs

- [Full CLI reference](docs/detailed.md)
- [API reference](docs/detailed.md#control-api)
- [Security](docs/security.md)
- [Terminal from anywhere](docs/terminal.md)
- [SDK](packages/sdk)
- [AI agent examples](examples/)
- [Use cases](docs/use_cases.md)

## Community

[![Discord](https://img.shields.io/badge/Discord-Join-7289DA?style=flat&logo=discord&logoColor=white)](https://discord.gg/KqdBcqRk5E)

## License

[FSL-1.1-MIT](LICENSE)
