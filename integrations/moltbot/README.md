# Private Connect Skill for Moltbot

Access your Moltbot gateway from anywhere, and connect to private services by name.

> **Note:** Moltbot was previously called Clawdbot. This skill works with both.

## Secure Remote Access to Moltbot

**Running Moltbot on a VPS, exe.dev VM, or Mac Mini?** Access it securely from your phone, laptop, or any device — without exposing the gateway publicly.

```
You: "Expose my Moltbot gateway for remote access"
Molt: ✓ Gateway exposed as "moltbot"
       On other devices, run: connect reach moltbot
       Tunnel will persist across reboots.

# Later, from your phone or laptop:
You: "Connect to my Moltbot"
Molt: ✓ Connected to moltbot gateway
       WhatsApp/Telegram will work as if Moltbot were local.
```

This is the **easiest secure alternative to Tailscale/ngrok** for remote Moltbot access. No VPN setup, no public URLs, no firewall changes.

See the [full remote access guide](../../docs/moltbot-remote-access.md) for details.

---

## Access Private Services

This skill also lets you control Private Connect through natural language.

**Examples:**

```
You: "Connect me to the staging database"
Molt: ✓ Connected to staging-db on localhost:5432

You: "What services are available?"
Molt: Found 5 services:
       • staging-db (online)
       • prod-api (online)  
       • redis (online)
       • mlflow (offline)
       • jupyter-gpu (online)

You: "Clone Alice's setup"
Molt: ✓ Cloned 4 services from alice
       • staging-db → localhost:5432
       • redis → localhost:6379
       • prod-api → localhost:8080
       • jupyter-gpu → localhost:8888
```

## Installation

### 1. Install Private Connect

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

### 2. Install the skill

Copy this skill to your Moltbot skills directory:

```bash
cp -r integrations/moltbot ~/molt/skills/private-connect
```

Or if you're using MoltHub:

```bash
moltbot skills install private-connect
```

### 3. Restart Moltbot

```bash
moltbot restart
```

## Available Commands

### Gateway Access (Moltbot Remote)

| Command | What it does |
|---------|--------------|
| `connect_expose_gateway` | Expose your Moltbot gateway for remote access |
| `connect_reach_gateway` | Connect to a remote Moltbot gateway |

### Service Access

| Command | What it does |
|---------|--------------|
| `connect_reach` | Connect to a service by name |
| `connect_status` | Show available services |
| `connect_share` | Share your environment |
| `connect_join` | Join a shared environment |
| `connect_clone` | Clone a teammate's setup |
| `connect_expose` | Expose a local service |
| `connect_list_shares` | List active shares |
| `connect_revoke` | Revoke a share |

## Example Conversations

### Remote Gateway Access

```
# On your VPS where Moltbot runs:
You: "Set up remote access to this Moltbot"
Molt: ✓ Moltbot gateway exposed as "moltbot"
       Your gateway at localhost:18789 is now accessible remotely.
       On other devices, run: connect reach moltbot
       Tunnel will persist across reboots.

# Later, from your phone or laptop:
You: "Connect to my Moltbot server"
Molt: ✓ Connected to remote Moltbot gateway
       Endpoint: ws://localhost:18789
       Your chat apps will work as if Moltbot were running locally.
```

### Connecting to services

```
You: "I need to access the staging database"
Clawd: Running connect reach staging-db...
       ✓ Connected on localhost:5432
       You can now connect with: psql -h localhost -p 5432
```

### Sharing with teammates

```
You: "Share my environment with the contractor for a week"
Clawd: Created share with 7-day expiration.
       Share code: x7k9m2
       Send this code to your contractor.
```

### Onboarding

```
You: "Set up my environment like Alice"
Clawd: Cloning alice's environment...
       ✓ staging-db → localhost:5432
       ✓ redis → localhost:6379
       ✓ prod-api → localhost:8080
       All services connected. Ready to work.
```

## Requirements

- Moltbot v2026.1.0 or later (or Clawdbot v2026.1.0+)
- Private Connect CLI installed (`connect` in PATH)
- Authenticated with `connect up`

## Links

- [Private Connect](https://privateconnect.co)
- [GitHub](https://github.com/treadiehq/private-connect)
- [Moltbot](https://docs.molt.bot)

