# Access Private Services from Sprites (sprites.dev)

**How to access your local database from Sprites.** Give your Sprites, stateful sandboxes on [sprites.dev](https://sprites.dev), secure access to your private databases, APIs, and internal services without exposing them to the internet.

## The Problem

Sprites are persistent Linux environments: great for running apps, agents, and workloads with checkpoint/restore. But what if your Sprite needs to:

- Query your company's private database
- Call internal APIs that aren't publicly exposed
- Reach staging or prod services behind your network
- Use Redis, Postgres, or other backends that live elsewhere

You could expose those services publicly; that's a security risk. VPNs and SSH tunnels add complexity and don't play nicely with ephemeral or pay-per-use compute. You need **your Sprite in the cloud** to talk to **your private backend**—without opening firewall ports or sharing URLs.

## The Solution: Private Connect

Private Connect creates secure tunnels between your Sprites and your private infrastructure. Your app in the Sprite uses `localhost:5432` (or whatever port); Private Connect makes that point at your real database.

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────┐
│ Sprites (sprites.dev)│────────▶│  Hub  │◀────────│  Your Server    │
│                     │         └───────┘         │                 │
│ Your app / agent    │                           │ Private DB      │
│ → localhost:5432    │                           │ localhost:5432  │
└─────────────────────┘                           └─────────────────┘
```

## Quick Start: Reach a Private Database from a Sprite

### Step 1: Expose your database (on the machine that has it)

```bash
# On your laptop, home server, or AWS instance
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Expose PostgreSQL by name
connect expose localhost:5432 --name staging-db
```

Your database stays on localhost—nothing is publicly exposed.

### Step 2: Use Private Connect inside the Sprite

Install and run Private Connect inside your Sprite so it can reach your backend:

```bash
# Inside the Sprite (e.g. via sprite exec or in your startup script)
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Reach your database by name
connect reach staging-db
```

Now anything running in the Sprite can use `localhost:5432` and it will tunnel to your real database.

```bash
# Your app or agent in the Sprite:
psql -h localhost -U myuser mydb
# or DATABASE_URL=postgres://localhost:5432/mydb
```

## Automated Setup (non-interactive)

For Sprites you create programmatically or via the Sprites API, use non-interactive install so the daemon runs without prompts:

```bash
# Inside the Sprite (e.g. in your image or startup script)
curl -fsSL https://privateconnect.co/install.sh | bash -s -- \
  --non-interactive \
  --api-key=YOUR_API_KEY \
  --daemon

# Then reach your services
connect reach staging-db
connect reach redis-cache
```

Run your app after `connect reach` so it sees the tunnels on localhost.

## Common Use Cases

### App in Sprite, database at home

Your web app runs in a Sprite (served on the Sprite URL). The app needs Postgres that lives on your laptop or server:

```bash
# On your machine with the DB
connect expose localhost:5432 --name my-db

# In the Sprite (install + reach)
connect reach my-db
# Start your app; it connects to localhost:5432
```

### Multiple backends

Expose several services and reach them all from the Sprite:

```bash
# On your private infrastructure
connect expose localhost:5432 --name prod-db
connect expose localhost:6379 --name redis
connect expose localhost:8080 --name internal-api

# In the Sprite
connect reach prod-db
connect reach redis
connect reach internal-api
# All available on localhost with their ports
```

### Team sharing

Teammates get the same access without re-exposing:

```bash
# You (with the DB): already have connect expose staging-db
# Teammate: clone your workspace
connect clone you
# They (and their Sprites) can now connect reach staging-db
```

### OpenClaw on a Mac Mini (or elsewhere)

If your backend is OpenClaw running on a Mac Mini, home server, or VPS, the full setup (expose on the server, reach from any device) is in **[Secure OpenClaw Remote Access](openclaw-remote-access.md)**. From a Sprite you then run:

```bash
connect reach openclaw
# OpenClaw is at localhost:18789 inside the Sprite
```

Same for other private services on that machine: expose them there, then `connect reach <name>` from the Sprite.

## Sprite URL vs private backends

- **Sprite URL** (sprites.dev): Your Sprite’s public HTTPS URL—traffic hits whatever listens on port 8080 inside the Sprite. Use it for web apps, webhooks, demos.
- **Private Connect**: For the *reverse* need—when the Sprite must **reach out** to your private DB/API. No public URL for your backend; the Sprite uses `connect reach` and talks to it over an encrypted tunnel.

Use both: serve your app on the Sprite URL, and have that app connect to `localhost:5432` (or other ports) provided by Private Connect.

## Security Comparison

| | Expose backend publicly | VPN | SSH tunnel | Private Connect |
|---|-------------------------|-----|------------|-----------------|
| Security risk | High | Low | Low | Low |
| Setup complexity | Low | High | Medium | Low |
| Works from Sprites | Yes | Depends | Manual | Yes |
| Multi-service by name | N/A | Yes | Manual | Yes |
| Team sharing | Hard | Hard | Hard | Easy |

## Troubleshooting

### Check status inside the Sprite

```bash
connect status
connect doctor
```

### Verify connectivity

```bash
# After connect reach staging-db
nc -zv localhost 5432
# or
psql -h localhost -U myuser -d mydb -c "SELECT 1"
```

### Daemon for long-lived Sprites

If your Sprite stays up and you want tunnels to survive restarts:

```bash
connect daemon install
connect reach staging-db
# Tunnels reconnect automatically
```

## Links

- [Private Connect](https://privateconnect.co)
- [Sprites (sprites.dev)](https://sprites.dev)
- [exe.dev + Private Connect](exe-dev-private-access.md) — same idea for exe.dev VMs
- [Database + Cursor](database-and-cursor.md) — reach your DB from Cursor
