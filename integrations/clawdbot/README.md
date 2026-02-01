# Private Connect Skill for Clawdbot

Access your Clawdbot gateway from anywhere, and connect to private services by name.

## Secure Remote Access to Clawdbot

**Running Clawdbot on a VPS or Mac Mini?** Access it securely from your phone, laptop, or any device, without exposing the gateway publicly.

```
You: "Expose my Clawdbot gateway for remote access"
Clawd: ✓ Gateway exposed as "clawdbot"
       On other devices, run: connect reach clawdbot
       Tunnel will persist across reboots.

# Later, from your phone or laptop:
You: "Connect to my Clawdbot"
Clawd: ✓ Connected to clawdbot gateway
       WhatsApp/Telegram will work as if Clawdbot were local.
```

This is the **easiest secure alternative to Tailscale/ngrok** for remote Clawdbot access. No VPN setup, no public URLs, no firewall changes.

See the [full remote access guide](../../docs/clawdbot-remote-access.md) for details.

---

## Access Private Services

This skill also lets you control Private Connect through natural language.

**Examples:**

```
You: "Connect me to the staging database"
Clawd: ✓ Connected to staging-db on localhost:5432

You: "What services are available?"
Clawd: Found 5 services:
       • staging-db (online)
       • prod-api (online)  
       • redis (online)
       • mlflow (offline)
       • jupyter-gpu (online)

You: "Clone Alice's setup"
Clawd: ✓ Cloned 4 services from alice
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

Copy this skill to your Clawdbot skills directory:

```bash
cp -r integrations/clawdbot ~/clawd/skills/private-connect
```

Or if you're using ClawdHub:

```bash
clawdbot skills install private-connect
```

### 3. Restart Clawdbot

```bash
clawdbot restart
```

## Available Commands

### Gateway Access (Clawdbot Remote)

| Command | What it does |
|---------|--------------|
| `connect_expose_gateway` | Expose your Clawdbot gateway for remote access |
| `connect_reach_gateway` | Connect to a remote Clawdbot gateway |

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
# On your VPS where Clawdbot runs:
You: "Set up remote access to this Clawdbot"
Clawd: ✓ Clawdbot gateway exposed as "clawdbot"
       Your gateway at localhost:18789 is now accessible remotely.
       On other devices, run: connect reach clawdbot
       Tunnel will persist across reboots.

# Later, from your phone or laptop:
You: "Connect to my Clawdbot server"
Clawd: ✓ Connected to remote Clawdbot gateway
       Endpoint: ws://localhost:18789
       Your chat apps will work as if Clawdbot were running locally.
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

- Clawdbot v2026.1.0 or later
- Private Connect CLI installed (`connect` in PATH)
- Authenticated with `connect up`

## Links

- [Private Connect](https://privateconnect.co)
- [GitHub](https://github.com/treadiehq/private-connect)
- [Clawdbot](https://github.com/clawdbot/clawdbot)

