# Private Connect Use Cases

Real scenarios where Private Connect saves hours of setup and frustration.

---

## Onboard Teammates Instantly

**The old way:**
1. "Join the VPN"
2. "Add these entries to /etc/hosts"
3. "Here's the SSH key for the bastion"
4. "Forward ports 5432, 6379, and 8080"
5. "Oh, you're on Windows? Let me find the other instructions..."

**With Private Connect:**
```bash
# Senior dev
connect share
# → Share code: x7k9m2

# New teammate
connect join x7k9m2
# ✓ Connected. Same environment. Done.
```

**Time saved:** 2 hours → 30 seconds

---

## Debug Production Issues Together

Two engineers need to look at the same staging database to debug an issue.

```bash
# Alice (already connected)
connect share --name "staging-debug"
# → Share code: k8m3n5

# Bob
connect join k8m3n5
# ✓ staging-db → localhost:5432
# ✓ redis → localhost:6379

# Both now have identical environments
# "I see the bug on row 4521" — "Me too, looking at it now"
```

No more "can you SSH into prod and run this query for me?"

---

## Same Setup, Anywhere

Your `.env` stays the same whether you're at the office, home, or a café.

```bash
# .env (never changes)
DATABASE_URL=postgres://localhost:5432/myapp
REDIS_URL=redis://localhost:6379
API_URL=http://localhost:8080
```

```bash
# Morning: run this once
connect dev

# Your app connects to localhost
# Private Connect routes to the real services
npm run dev
```

Switch between home/office/travel without touching configuration.

---

## CI/CD to Private Infrastructure

GitHub Actions deploying to servers that aren't publicly accessible.

```yaml
# .github/workflows/deploy.yml
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Connect to private infra
        run: |
          curl -fsSL https://privateconnect.co/install.sh | bash
          connect up --api-key ${{ secrets.PRIVATECONNECT_KEY }}
          connect reach deploy-server
          
      - name: Deploy
        run: |
          # deploy-server is now at localhost:22
          rsync -avz ./dist/ localhost:/var/www/app/
```

No bastion hosts. No VPN configurations. No firewall rules.

---

## Access Your Home Lab from Anywhere

Raspberry Pi, NAS, or self-hosted services — reach them without exposing ports.

```bash
# On your home server (runs 24/7)
connect daemon install
connect expose localhost:8096 --name jellyfin
connect expose localhost:8080 --name homeassistant
connect expose 192.168.1.50:445 --name nas

# From anywhere in the world
connect reach jellyfin
# → http://localhost:8096 — your media server

connect reach nas
# → localhost:445 — your NAS shares
```

No dynamic DNS. No port forwarding. No security exposure.

---

## Give Contractors Temporary Access

External developer needs to test against your staging API for a week.

```bash
# Create a time-limited share
connect share --expires 7d --name "acme-contractor"
# → Share code: p4r7n3r

# Contractor uses the code
connect join p4r7n3r
# ✓ staging-api → localhost:8080
# Access expires automatically in 7 days
```

Revoke anytime:
```bash
connect share --revoke p4r7n3r
```

No VPN account to provision. No credentials to rotate. No access to revoke manually.

---

## Let Open-Source Contributors Hit Your Prod API

Contributors need to run your frontend locally, but it requires your production API. The old way means sharing secrets, setting up local databases, or maintaining a separate dev environment.

**With Private Connect:**

```bash
# Maintainer creates a public link
connect link api --expires 30d --methods GET,POST --paths /api/v1
# → https://link.privateconnect.co/share_abc123...
```

**Contributor just uses it:**
```bash
# .env.local (no secrets!)
API_URL=https://link.privateconnect.co/share_abc123...

# Run frontend
bun dev
# → Auth works, API calls work, no setup required
```

**What they get:**
- Real API, real data (or staging)
- No CLI installation
- No account creation
- No secrets on their machine
- Auth flows work naturally

**Safety controls:**
```bash
# Read-only access
connect link api --methods GET

# Specific paths only
connect link api --paths /api/public,/health

# Rate limited
connect link api --rate-limit 100

# Revoke anytime
# (from web dashboard or API)
```

Perfect for: open-source projects, contractor onboarding, demo environments.

---

## Monitor Internal Services

Check if internal dashboards are responding, from anywhere.

```bash
# Quick health check
connect reach grafana --check
# ✓ DNS OK
# ✓ TCP OK  
# ✓ HTTP 200 OK
# ✓ Latency: 45ms

# Actually connect and open it
connect reach grafana
open http://localhost:3000
```

---

## Test Webhooks from Stripe, GitHub, etc.

Local development needs to receive webhooks from external services.

```bash
# Expose your local server with a public URL
connect expose localhost:3000 --name webhook-test --public
# → https://abc123.privateconnect.co

# Use that URL in Stripe/GitHub webhook settings
# Webhooks hit your local machine
```

Like ngrok, but integrated with your team's service mesh.

---

## Everything on Localhost, Via Subdomains

Tired of remembering which port is which service? Use the proxy for memorable URLs.

```bash
connect proxy
# ✓ Proxy running on port 3000

# Access services via subdomains:
#   http://staging-db.localhost:3000
#   http://redis.localhost:3000
#   http://user-api.localhost:3000
#   http://grafana.localhost:3000
```

**Your `.env` becomes readable:**
```bash
# Before: random ports
DATABASE_URL=postgres://localhost:23456/myapp
REDIS_URL=redis://localhost:23789
API_URL=http://localhost:24001

# After: meaningful names
DATABASE_URL=postgres://staging-db.localhost:3000/myapp
REDIS_URL=redis://redis.localhost:3000
API_URL=http://user-api.localhost:3000
```

**Benefits:**
- One port to remember (3000)
- Service names in URLs (self-documenting)
- Works with any tool that supports localhost
- Auto-discovers new services

```bash
# Map specific services to specific ports
connect map staging-db 5432
connect map redis 6379

# Now use standard ports
psql -h localhost -p 5432
redis-cli -p 6379
```

---

## Project-Based Environments

Every project knows what services it needs.

```yaml
# my-app/pconnect.yml
services:
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
  - name: user-service
    port: 8081
  - name: payment-service
    port: 8082
```

```bash
cd my-app
connect dev
# ✓ Connected: staging-db, redis, user-service, payment-service

npm run dev
# App works. All services available at localhost.
```

Clone a repo, run `connect dev`, start coding. That's it.

> Config file can be `pconnect.yml`, `pconnect.yaml`, or `pconnect.json`

---

## Security Without Friction

Private Connect gives you:

| Feature | Benefit |
|---------|---------|
| **No VPN** | No client to install, no split tunneling issues |
| **No firewall rules** | Services stay private, outbound-only connections |
| **No exposed ports** | Nothing listens publicly |
| **Time-limited shares** | Access expires automatically |
| **Instant revocation** | Cut off access in one command |
| **Audit trail** | See who accessed what, when |
| **Per-service access** | Grant access to specific services, not the whole network |

---

## Private Connect vs. Alternatives

| Scenario | VPN | SSH Tunnels | Private Connect |
|----------|-----|-------------|-----------------|
| Onboard new dev | 2+ hours | 30+ min | 30 seconds |
| Share environment | Not possible | Complex | One command |
| Works from anywhere | Sometimes | Fragile | Always |
| Revoke access | IT ticket | Find & delete keys | Instant |
| Audit who accessed | Limited | None | Built-in |
| Setup on new machine | Reinstall client | Copy keys | Run `connect up` |
| Public link (no account) | Not possible | Not possible | `connect link` |

---

## Quick Reference

```bash
# Always-on access
connect daemon install      # Set it and forget it

# Project-based
connect dev                 # Connect from pconnect.yml

# Collaboration
connect share               # Share your environment
connect join <code>         # Join teammate's environment

# Public links (no account needed)
connect link <service>      # Create public URL for a service

# Ad-hoc access
connect reach <service>     # Connect to any service
connect proxy               # All services via subdomains
```

---

**Ready to try it?**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```