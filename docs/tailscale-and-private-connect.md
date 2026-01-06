# Using Private Connect with Tailscale

Tailscale gets you on the network. Private Connect gets you to your services.

---

## The problem with network-level access

Tailscale is great. You install it, join a tailnet, and suddenly you can reach `100.x.x.x` from anywhere. Your home server, your work VM, your friend's Raspberry Pi, all accessible.

But then what?

- Which IP is the staging database again?
- What port is that API running on?
- How do I give my new teammate access to the same services I use?

Tailscale gives you **network access**. You still need to manage the services yourself.

---

## Private Connect adds a service layer

Private Connect sits on top of any network. Tailscale, VPN, or plain internet, and adds:

| Capability | Without Private Connect | With Private Connect |
|------------|-------------------------|----------------------|
| Access a database | `psql -h 100.64.1.50 -p 5432` | `connect reach prod-db` |
| Remember what's running | Spreadsheet / tribal knowledge | `connect status` |
| Share with teammate | "Here's the IP and port..." | `connect clone alice` |
| Revoke access | Delete VPN config? | `connect share --revoke` |

---

## How they work together

```
┌─────────────────────────────────────────────┐
│           Private Connect                   │
│   Named services: prod-db, staging-api      │
│   Team sharing: clone, share, join          │
├─────────────────────────────────────────────┤
│              Tailscale                      │
│   Network mesh: 100.64.x.x addresses        │
│   Encrypted tunnels between devices         │
├─────────────────────────────────────────────┤
│           Your infrastructure               │
│   VMs, home servers, cloud instances        │
└─────────────────────────────────────────────┘
```

Tailscale handles the networking. Private Connect handles service discovery and access.

---

## Example: AI development VM

You're running Claude Code on a beefy VM. You access it via Tailscale + SSH. But you also have:
- A dev server on port 8000
- A database on port 5432
- An API on port 3000

**Without Private Connect:**

```bash
# SSH in via Tailscale
ssh 100.64.1.50

# In another terminal, forward ports manually
ssh -L 8000:localhost:8000 -L 5432:localhost:5432 100.64.1.50
```

You're managing port forwards. If a teammate needs access, you explain the whole setup.

**With Private Connect:**

```bash
# On the VM (once)
connect daemon install
connect expose localhost:8000 --name dev-server
connect expose localhost:5432 --name dev-db
connect expose localhost:3000 --name dev-api

# From your laptop (anywhere)
connect reach dev-server
connect reach dev-db
connect reach dev-api

# Teammate joins in 30 seconds
connect clone you
```

Named services. No port memorization. Teammates clone your setup instantly.

---

## Example: Home lab

You have a home server running:
- Jellyfin on port 8096
- Home Assistant on port 8123
- A NAS on 192.168.1.50

Tailscale gets you home. Private Connect names your services.

```bash
# On your home server
connect expose localhost:8096 --name jellyfin
connect expose localhost:8123 --name homeassistant  
connect expose 192.168.1.50:445 --name nas

# From anywhere
connect reach jellyfin
# → localhost:8096 — your media server
```

---

## When to use which

| Use case | Tool |
|----------|------|
| "I need to SSH into my VM" | Tailscale |
| "I need to reach the database on my VM" | Private Connect |
| "I need to share my dev environment with a teammate" | Private Connect |
| "I need all my devices on one network" | Tailscale |
| "I need named, discoverable services" | Private Connect |

They're complementary. Use both.

---

## Setup

**1. Install Tailscale** (if you haven't already)

```bash
# Your machines can now reach each other
tailscale up
```

**2. Install Private Connect**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

**3. Expose services on your machines**

```bash
# On the machine with the service
connect expose localhost:5432 --name my-database
```

**4. Reach them from anywhere**

```bash
# On any other machine
connect reach my-database
# → localhost:5432 just works
```

---

## The bottom line

Tailscale is network infrastructure. Private Connect is developer experience.

- Tailscale: "Can I reach that machine?"
- Private Connect: "Can I reach that service by name and share it with my team?"

Use Tailscale for the network. Use Private Connect for the services.

---

**Get started:**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

