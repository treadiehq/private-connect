# Private Connect vs ngrok

ngrok exposes ports to the internet. Private Connect shares services with your team.

---

## The core difference

**ngrok** creates public URLs for local services. Great for:
- Showing a client your WIP
- Testing webhooks locally
- Quick demos

**Private Connect** creates named, private services shared across your team. Great for:
- Team development environments
- Cross-environment access (staging, prod, home lab)
- Persistent service discovery

| | ngrok | Private Connect |
|---|-------|-----------------|
| **Model** | Local → public URL | Named services → team access |
| **Sharing** | Send a URL | `connect clone alice` |
| **Access control** | URL-based (anyone with link) | Team-based (workspace members) |
| **Persistence** | URL changes on restart (free tier) | Service names are permanent |
| **Direction** | One-way (expose only) | Bidirectional (expose + reach) |

---

## Side-by-side example

### Sharing a dev server

**ngrok:**
```bash
# You run this
ngrok http 3000
# → https://a1b2c3d4.ngrok.io

# Then you message your teammate:
# "Hey, check out https://a1b2c3d4.ngrok.io"

# Tomorrow, you restart ngrok:
# → https://e5f6g7h8.ngrok.io  (different URL)
# "Hey, new URL: https://e5f6g7h8.ngrok.io"
```

**Private Connect:**
```bash
# You run this once
connect expose localhost:3000 --name my-api

# Teammate runs this once
connect clone you

# Now they have access. Forever. No URLs to share.
connect reach my-api
# → localhost:3000 on their machine
```

---

### Accessing a remote database

**ngrok:**
```bash
# ngrok doesn't really solve this
# You'd need to expose the DB publicly (security risk)
# Or set up SSH tunnels manually
```

**Private Connect:**
```bash
# On the server with the database
connect expose localhost:5432 --name staging-db

# From your laptop (anywhere)
connect reach staging-db
# → localhost:5432 — connected to staging DB
```

Private Connect is bidirectional. You can **expose** services and **reach** remote services.

---

### Team onboarding

**ngrok:**
```
New teammate: "How do I access the dev services?"
You: "I'll send you the ngrok URLs... wait, let me restart them first"
You: "OK here's the API: https://abc.ngrok.io, DB: https://def.ngrok.io..."
You: "Oh those expired, here are new ones..."
```

**Private Connect:**
```
New teammate: "How do I access the dev services?"
You: "Run: connect clone alice"
Teammate: "Done. I see staging-db, dev-api, redis-cache..."
```

---

## When to use which

| Use case | ngrok | Private Connect |
|----------|-------|-----------------|
| Quick webhook testing | ✅ | |
| Demo to external client | ✅ | |
| Share dev environment with team | | ✅ |
| Access remote services from laptop | | ✅ |
| Kubernetes service access from outside cluster | | ✅ |
| Persistent service names | | ✅ |
| Cross-environment access (staging + prod) | | ✅ |
| Team collaboration built-in | | ✅ |

---

## Key differences explained

### 1. Public vs Private

**ngrok** creates public URLs. Anyone with the link can access.

**Private Connect** keeps services private. Only workspace members can access. No public URLs, no link sharing.

### 2. URLs vs Names

**ngrok** gives you random URLs: `https://a1b2c3d4.ngrok.io`

**Private Connect** gives you permanent names: `staging-db`, `prod-api`, `dev-server`

Your code can use `localhost:5432` and `connect reach staging-db` makes it work—no URL changes, no config updates.

### 3. Solo vs Team

**ngrok** is designed for solo developers exposing local services.

**Private Connect** is designed for teams sharing environments:
- `connect clone alice` — get all of Alice's exposed services
- `connect share` — generate invite links for teammates
- Workspace-level access control

### 4. Auto-reconnect

**ngrok** requires you to restart the process if the connection drops (free tier).

**Private Connect** tunnels automatically reconnect if the connection drops, up to 10 retries with exponential backoff. No manual restart needed.

### 5. One-way vs Bidirectional

**ngrok** only exposes (local → internet).

**Private Connect** does both:
- `connect expose` — make a local service available
- `connect reach` — access a remote service locally

This means you can access services running on remote VMs, Kubernetes clusters, or teammates' machines.

---

## Migration from ngrok

If you're using ngrok for team collaboration, here's how to switch:

**Before (ngrok):**
```bash
# Developer 1
ngrok http 3000
# Share URL in Slack...

# Developer 2
curl https://abc123.ngrok.io/api/health
```

**After (Private Connect):**
```bash
# Developer 1 (once)
connect expose localhost:3000 --name my-api

# Developer 2 (once)
connect clone developer1
connect reach my-api
curl localhost:3000/api/health
```

Benefits:
- No more URL sharing
- Service names don't change
- Works across all environments
- Teammates discover services automatically

---

## Quick tunnels (no signup)

Private Connect also handles the quick, no-signup use cases:

```bash
# Webhook testing with named subdomain
npx private-connect stripe 3000
# → https://stripe-a1b2.privateconnect.co (readable URL, 2hr expiry)

# Quick demo
npx private-connect myapp 3000
# → https://myapp-f3d9.privateconnect.co

# Anonymous tunnel
npx private-connect tunnel 3000
# → https://abc12345.privateconnect.co
```

Features: color-coded request log, live stats, auto-reconnect, web inspector.

## Still use ngrok for...

- **Custom domains on free tier**: ngrok supports this, Private Connect quick tunnels are random or slug-prefixed

Private Connect covers **team collaboration**, **cross-environment access**, and **quick public tunnels** (webhooks, demos).

---

## Get started

```bash
# Install
curl -fsSL https://privateconnect.co/install.sh | bash

# Expose a service
connect expose localhost:3000 --name my-api

# Teammate clones your setup
connect clone you

# They can now reach your services
connect reach my-api
```

---

## Summary

| | ngrok | Private Connect |
|---|-------|-----------------|
| **Best for** | Quick public URLs | Team service sharing |
| **Access model** | Anyone with URL | Workspace members only |
| **Service names** | Random URLs | Permanent names |
| **Direction** | Expose only | Expose + Reach |
| **Team features** | None | Clone, share, workspaces |
| **Persistence** | URLs change (free tier) | Names are permanent |
| **Reconnect** | Manual restart | Automatic (with backoff) |

**Use ngrok** when you need a public URL fast.

**Use Private Connect** when you need team collaboration and cross-environment service access.
