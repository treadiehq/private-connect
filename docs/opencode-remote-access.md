# Secure OpenCode Remote Access in 5 Minutes

Access your OpenCode server from anywhere, laptop, phone, or any device, without exposing it to the internet.

## The Problem

OpenCode's server binds to `127.0.0.1:4096` by default for security. The docs warn against exposing it publicly. But what if you want to:

- Run OpenCode on a powerful VPS/GPU server and connect from your laptop
- Access your OpenCode instance from multiple devices
- Let teammates connect to a shared OpenCode server

Setting `--hostname 0.0.0.0` exposes your server publicly — even with `OPENCODE_SERVER_PASSWORD`, you're vulnerable to brute-force attacks and port scanning.

Common solutions have drawbacks:

| Solution | Problem |
|----------|---------|
| SSH tunnel | Manual, breaks when connection drops |
| Tailscale/headscale | Auth key management, mesh VPN overhead |
| ngrok | Public URLs (security risk), requires paid plan for persistence |
| Direct port forwarding | Exposes server to brute-force attacks |

## The Solution: Private Connect

Private Connect creates a secure, private tunnel to your OpenCode server. No public URLs, no VPN setup, no firewall changes.

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────┐
│   VPS / GPU Server  │────────▶│  Hub  │◀────────│   Your Laptop   │
│                     │         └───────┘         │                 │
│ opencode serve      │                           │ opencode attach │
│ localhost:4096      │                           │ localhost:4096  │
└─────────────────────┘                           └─────────────────┘
```

## Quick Start

### Step 1: Install Private Connect on your OpenCode server

```bash
# On your VPS / GPU server where OpenCode runs
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

### Step 2: Start OpenCode and expose it

```bash
# Start OpenCode server (stays on localhost)
opencode serve

# In another terminal, expose it via Private Connect
connect localhost:4096 --name opencode
```

That's it on the server side. The server stays bound to localhost — nothing is publicly exposed.

### Step 3: Connect from any device

On your laptop or any other machine:

```bash
# Install (if not already)
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Connect to your OpenCode server
connect opencode

# Now attach to it
opencode attach http://localhost:4096
```

Your OpenCode TUI connects through the encrypted tunnel as if the server were running locally.

## Persistent Connection (Recommended)

Install the background daemon so your connection survives reboots:

```bash
# On your OpenCode server
connect daemon install
connect localhost:4096 --name opencode

# On your laptop
connect daemon install
connect opencode
```

The tunnel stays up 24/7, reconnecting automatically.

## Web UI Access

If you're using `opencode web` instead:

```bash
# On server (use any port you prefer)
opencode web --port 8080
connect localhost:8080 --name opencode-web

# On laptop
connect opencode-web
# Open http://localhost:8080 in your browser
```

## Multi-Device Access

Once exposed, multiple devices can connect:

```bash
# Device 1 (laptop)
connect opencode
opencode attach http://localhost:4096

# Device 2 (work computer)
connect opencode
opencode attach http://localhost:4096

# Device 3 (tablet via web)
connect opencode-web
# Open browser to localhost:8080
```

All devices get secure access to the same OpenCode instance.

## Sharing with Teammates

Running a team OpenCode server? Share access securely:

```bash
# Create a share link (expires in 7 days)
connect link opencode --expires 7d

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

### Verify OpenCode is running

```bash
# On the server - check if server is listening
lsof -i :4096
# Or try connecting
nc -zv localhost 4096
# Or check the API docs endpoint
curl http://localhost:4096/doc
```

### View tunnel logs

```bash
connect daemon logs
```

## FAQ

**Q: Is my traffic encrypted?**  
A: Yes. All connections use TLS encryption. The hub relays your data as opaque packets without inspecting the contents.

**Q: Does my code go through your servers?**  
A: Traffic passes through the hub as an opaque relay — the hub forwards packets without inspecting or storing payload data. For zero-trust requirements, you can self-host the hub.

**Q: Can I self-host the hub?**  
A: Yes. Private Connect is open source: `docker compose up` with your own hub.

**Q: Does this work with `opencode attach`?**  
A: Yes. The tunnel is transparent — `opencode attach http://localhost:4096` works exactly as if the server were local.

**Q: What about the web UI?**  
A: Works the same way. Expose whatever port you use for `opencode web` and access it via localhost in your browser.

## Links

- [Private Connect](https://privateconnect.co)
- [OpenCode](https://opencode.ai)
- [GitHub](https://github.com/treadiehq/private-connect)
- [Discord](https://discord.gg/KqdBcqRk5E)
