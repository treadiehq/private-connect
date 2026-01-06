# Private Connect Skill for Clawdbot

Access private services by name, from anywhere via natural language.

## What is this?

This is a [Clawdbot](https://github.com/clawdbot/clawdbot) skill that lets you control Private Connect through your AI assistant.

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

