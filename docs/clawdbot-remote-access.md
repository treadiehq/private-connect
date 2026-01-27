# Secure Clawdbot Remote Access in 5 Minutes

Access your Clawdbot gateway from anywhere, phone, laptop, or any device, without exposing it to the internet.

## The Problem

Clawdbot's gateway binds to `127.0.0.1:18789` by default for security. The docs are clear: **never expose it publicly**. But what if you want to:

- Access your Clawdbot from your phone via WhatsApp/Telegram while it runs on a VPS
- Connect from your laptop when Clawdbot runs on a home server or Mac Mini
- Let multiple devices reach the same Clawdbot instance

Common solutions have drawbacks:

| Solution | Problem |
|----------|---------|
| SSH tunnel | Manual, clunky for mobile, breaks when connection drops |
| Tailscale/headscale | Auth key management, mesh VPN overhead |
| ngrok | Public URLs (security risk), requires paid plan for persistence |
| Direct port forwarding | Exposes gateway to brute-force attacks |

## The Solution: Private Connect

Private Connect creates a secure, private tunnel to your Clawdbot gateway. No public URLs, no VPN setup, no firewall changes.

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────┐
│   VPS / Mac Mini    │────────▶│  Hub  │◀────────│   Your Phone    │
│                     │         └───────┘         │                 │
│ Clawdbot Gateway    │                           │ WhatsApp/TG     │
│ localhost:18789     │                           │ → localhost:18789│
└─────────────────────┘                           └─────────────────┘
```

## Quick Start

### Step 1: Install Private Connect on your Clawdbot server

```bash
# On your VPS / Mac Mini / home server where Clawdbot runs
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

### Step 2: Expose the Clawdbot gateway

```bash
connect localhost:18789 --name clawdbot
```

That's it on the server side. The gateway stays bound to localhost — nothing is publicly exposed.

### Step 3: Connect from any device

On your laptop, phone, or any other machine:

```bash
# Install (if not already)
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Connect to your Clawdbot gateway
connect clawdbot
```

Now `localhost:18789` on your device tunnels to your Clawdbot gateway. Your chat apps connect as if Clawdbot were running locally.

## Persistent Connection (Recommended)

Install the background daemon so your connection survives reboots:

```bash
# On your Clawdbot server
connect daemon install
connect localhost:18789 --name clawdbot

# On your laptop/phone
connect daemon install
connect clawdbot
```

The tunnel stays up 24/7, reconnecting automatically.

## Multi-Device Access

Once exposed, multiple devices can connect:

```bash
# Device 1 (laptop)
connect clawdbot

# Device 2 (phone via Termux or similar)
connect clawdbot

# Device 3 (work computer)
connect clawdbot
```

All devices get secure access to the same Clawdbot instance.

## Sharing with Teammates

Running a team Clawdbot? Share access securely:

```bash
# Create a share link (expires in 7 days)
connect link clawdbot --expires 7d

# Output:
# https://link.privateconnect.co/share/abc123
# Share this link with your team
```

Or share your entire environment:

```bash
connect share
# → Share code: x7k9m2

# Teammate runs:
connect join x7k9m2
```

## Security Comparison

| | ngrok | Tailscale | SSH Tunnel | Private Connect |
|---|-------|-----------|------------|-----------------|
| Public URL | Yes (risky) | No | No | No |
| Multi-device | Limited | Yes | Manual | Yes |
| Persistent | Paid | Yes | No | Yes |
| Setup time | 2 min | 10 min | 5 min | 2 min |
| VPN overhead | No | Yes | No | No |
| Self-hosted option | No | Headscale | Yes | Yes |

## Troubleshooting

### Check connection status

```bash
connect status
connect doctor  # Full diagnostics
```

### Verify Clawdbot is running

```bash
# On the server - check if gateway is listening
lsof -i :18789
# Or try connecting
nc -zv localhost 18789
```

### View tunnel logs

```bash
connect daemon logs
```

## FAQ

**Q: Is my traffic encrypted?**  
A: Yes. All connections use TLS encryption. The hub relays your data as opaque packets without inspecting the contents.

**Q: Does my Clawdbot data go through your servers?**  
A: Traffic passes through the hub as an opaque relay — the hub forwards packets without inspecting or storing payload data. For zero-trust requirements, you can self-host the hub.

**Q: Can I self-host the hub?**  
A: Yes. Private Connect is open source: `docker compose up` with your own hub.

**Q: Does this work with WhatsApp/Telegram/Discord?**  
A: Yes. Your chat apps connect to `localhost:18789` as usual — the tunnel is transparent.

## Links

- [Private Connect](https://privateconnect.co)
- [Clawdbot](https://clawd.bot)
- [GitHub](https://github.com/treadiehq/private-connect)
- [Discord](https://discord.gg/KqdBcqRk5E)
