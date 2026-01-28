# Access Private Services from exe.dev VMs (or Mac Mini)

Give your exe.dev agents, Mac Mini servers, and dev environments secure access to your private infrastructure, databases, APIs, and internal services, without exposing them to the internet.

## The Problem

exe.dev gives you persistent VMs with built-in HTTPS proxies. Great for running agents. But what if your agent needs to:

- Query your company's private database
- Call internal APIs that aren't publicly exposed
- Access staging environments behind a firewall
- Communicate with other private services

You could expose those services publicly, but that's a security nightmare. VPNs work but add complexity. SSH tunnels are manual and fragile.

## The Solution: Private Connect

Private Connect creates secure tunnels between your exe.dev VMs and your private infrastructure. Your agent gets access; your services stay private.

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────┐
│ exe.dev / Mac Mini  │────────▶│  Hub  │◀────────│  Your Server    │
│                     │         └───────┘         │                 │
│ Your AI Agent       │                           │ Private DB      │
│ → localhost:5432    │                           │ localhost:5432  │
└─────────────────────┘                           └─────────────────┘
```

## Quick Start: Access a Private Database

### Step 1: Expose your database (on your private server)

```bash
# On your home server / office / AWS instance
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Expose your PostgreSQL database
connect localhost:5432 --name prod-db
```

Your database stays on localhost — nothing is publicly exposed.

### Step 2: Connect from exe.dev

```bash
# SSH into your exe.dev VM
ssh exe.dev

# Install Private Connect
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Connect to your database
connect prod-db
```

Now your exe.dev agent can access the database at `localhost:5432` as if it were running locally.

```bash
# Your agent can now do this:
psql -h localhost -U myuser mydb
```

## Persistent Connection (Recommended)

Install the daemon so connections survive VM restarts:

```bash
# On your private server
connect daemon install
connect localhost:5432 --name prod-db

# On exe.dev VM
connect daemon install
connect prod-db
```

The tunnel stays up 24/7, reconnecting automatically.

## Common Use Cases

### Private API Access

Your agent needs to call internal APIs:

```bash
# On your internal API server
connect localhost:8080 --name internal-api

# On exe.dev VM
connect internal-api
# → Agent calls http://localhost:8080
```

### Multiple Services

Expose several services with different names:

```bash
# On private infrastructure
connect localhost:5432 --name prod-db
connect localhost:6379 --name redis-cache
connect localhost:8080 --name internal-api

# On exe.dev VM
connect prod-db
connect redis-cache
connect internal-api
# → All available on localhost with their respective ports
```

### Cross-VM Communication

Two exe.dev VMs talking privately (not via public URLs):

```bash
# VM 1: Run an ML inference server
python -m vllm.entrypoints.openai.api_server --port 8000
connect localhost:8000 --name ml-inference

# VM 2: Your agent consumes the ML API
connect ml-inference
curl http://localhost:8000/v1/completions ...
```

### Team Development Environment

Share your exe.dev setup with teammates:

```bash
# On your exe.dev VM
connect share
# → Share code: x7k9m2

# Teammate (anywhere)
connect join x7k9m2
# → Gets access to all your exposed services
```

Or create a shareable link:

```bash
connect link prod-db --expires 7d
# → https://link.privateconnect.co/share/abc123
```

## Integration with exe.dev AGENTS.md

If you're using exe.dev's Shelley/AGENTS.md system, your agent can use Private Connect to access private resources. Add to your agent's context:

```markdown
## Available Private Services

The following services are available via Private Connect tunnels:
- `prod-db` → PostgreSQL database at localhost:5432
- `internal-api` → REST API at localhost:8080
- `redis-cache` → Redis at localhost:6379

To connect to these, run `connect <name>` in the terminal.
```

## Security Comparison

| | Expose publicly | VPN | SSH Tunnel | Private Connect |
|---|-----------------|-----|------------|-----------------|
| Security risk | High | Low | Low | Low |
| Setup complexity | Low | High | Medium | Low |
| Multi-service | N/A | Yes | Manual | Yes |
| Persistent | Yes | Yes | No | Yes |
| Team sharing | Hard | Hard | Hard | Easy |

## One-Click VM Setup (Moltbot + Private Connect)

When creating a new VM on exe.dev, paste this prompt for automatic Moltbot + Private Connect setup:

```
PRIVATECONNECT_API_KEY=<your-api-key>

Set up Moltbot (https://docs.molt.bot/install) on this VM using non-interactive mode.
Configure nginx to forward from port 18789 to the root location, enabling WebSocket support.

Then install Private Connect:
curl -fsSL https://privateconnect.co/install.sh | bash -s -- \
  --non-interactive \
  --api-key=$PRIVATECONNECT_API_KEY \
  --daemon \
  --expose-moltbot
```

After VM creation, connect from any device:

```bash
connect reach moltbot
```

See [scripts/exe-dev-moltbot.md](../scripts/exe-dev-moltbot.md) for the full template.

## Troubleshooting

### Check connection status

```bash
connect status
connect doctor  # Full diagnostics
```

### Verify service is exposed

```bash
# On the server exposing the service
connect status
# Should show: prod-db → localhost:5432
```

### Verify connectivity from exe.dev

```bash
# On exe.dev VM
connect status
nc -zv localhost 5432
```

### View tunnel logs

```bash
connect daemon logs
```

## Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                         Your Infrastructure                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                          │
│  │ Database │  │ API      │  │ Redis    │                          │
│  │ :5432    │  │ :8080    │  │ :6379    │                          │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                          │
│       │             │             │                                 │
│       └─────────────┼─────────────┘                                 │
│                     │                                               │
│              ┌──────▼──────┐                                        │
│              │   Private   │                                        │
│              │   Connect   │                                        │
│              └──────┬──────┘                                        │
└─────────────────────┼──────────────────────────────────────────────┘
                      │
                      ▼
               ┌──────────────┐
               │     Hub      │
               │ (relay only) │
               └──────┬───────┘
                      │
┌─────────────────────┼──────────────────────────────────────────────┐
│                     ▼                    exe.dev                    │
│              ┌──────────────┐                                       │
│              │   Private    │                                       │
│              │   Connect    │                                       │
│              └──────┬───────┘                                       │
│                     │                                               │
│       ┌─────────────┼─────────────┐                                 │
│       │             │             │                                 │
│  ┌────▼─────┐  ┌────▼─────┐  ┌────▼─────┐                          │
│  │ :5432    │  │ :8080    │  │ :6379    │                          │
│  │ prod-db  │  │ api      │  │ redis    │                          │
│  └──────────┘  └──────────┘  └──────────┘                          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────────────┐  │
│  │  Your AI Agent                                                │  │
│  │  → Connects to localhost:5432, :8080, :6379                   │  │
│  └──────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## FAQ

**Q: Is my traffic encrypted?**  
A: Yes. All connections use TLS encryption. The hub relays your data as opaque packets without inspecting the contents.

**Q: Does my database data go through your servers?**  
A: Traffic passes through the hub as an opaque relay — the hub forwards packets without inspecting or storing payload data. For zero-trust requirements, you can self-host the hub.

**Q: Can I self-host the hub?**  
A: Yes. Private Connect is open source: `docker compose up` with your own hub.

**Q: Why not just use exe.dev's built-in HTTP proxy?**  
A: exe.dev's proxy exposes services publicly via HTTPS. Private Connect keeps services private — only devices in your workspace can access them.

**Q: Does this work with exe.dev's Shelley?**  
A: Yes. Shelley (the AI agent) can run `connect` commands to access private services. Include available services in your AGENTS.md for context.

## Links

- [Private Connect](https://privateconnect.co)
- [exe.dev](https://exe.dev)
- [GitHub](https://github.com/treadiehq/private-connect)
- [Discord](https://discord.gg/KqdBcqRk5E)
