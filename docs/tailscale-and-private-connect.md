# Using Private Connect with Tailscale

Tailscale gets you on the network. Private Connect gets you to your services.

---

## The problem with network-level access

Tailscale is great. You install it, join a tailnet, and suddenly you can reach `100.x.x.x` from anywhere. Your home server, your work VM, your friend's Raspberry Pi, all accessible.

But then what?

- **Outside the cluster**: Kubernetes has internal DNS (`postgres.staging.svc.cluster.local`), but that only works inside the cluster. From your laptop, you need VPN, port forwarding, or a bastion host.
- **Cross-environment access**: Staging database is in one cluster, prod API in another. How do you access both from your local machine?
- **Team collaboration**: How do you give your new teammate access to the same services you use, without them setting up VPN, SSH tunnels, or cluster access?
- **Developer experience**: Even with Kubernetes service names, you're still managing port forwards, SSH tunnels, or VPN configs.

Tailscale gives you **network access**. Private Connect gives you **service access** with team collaboration built in.

---

## Private Connect adds a service layer

Private Connect sits on top of any network. Tailscale, VPN, Kubernetes, or plain internet, and adds:

| Capability | Without Private Connect | With Private Connect |
|------------|-------------------------|----------------------|
| Access from outside cluster | VPN + port forward, or SSH tunnel | `connect reach prod-db` |
| Cross-environment access | Different VPN configs per environment | Same command, works everywhere |
| Share with teammate | "Here's the VPN config and cluster access..." | `connect clone alice` |
| Works with Kubernetes | Internal DNS only works in-cluster | Access K8s services from your laptop |
| Revoke access | Delete VPN config? Remove cluster RBAC? | `connect share --revoke` |

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

## Example: Kubernetes cluster access

You have a Kubernetes cluster with services like `postgres.staging.svc.cluster.local`. Inside the cluster, DNS works great. But from your laptop?

**Without Private Connect:**

```bash
# Option 1: VPN + port forward
kubectl port-forward svc/postgres 5432:5432

# Option 2: SSH tunnel through bastion
ssh -L 5432:postgres.staging.svc.cluster.local:5432 bastion

# Option 3: Expose via LoadBalancer (security risk)
# kubectl expose svc/postgres --type=LoadBalancer
```

Each approach has problems: VPN configs, SSH key management, or exposing services publicly.

**With Private Connect:**

```bash
# In your cluster (via DaemonSet or sidecar)
connect expose postgres.staging.svc.cluster.local:5432 --name staging-db
connect expose redis.prod.svc.cluster.local:6379 --name prod-redis

# From your laptop (anywhere, no VPN needed)
connect reach staging-db
connect reach prod-redis

# Teammate gets same access instantly
connect clone you
```

Works with Kubernetes service names. No VPN. No SSH tunnels. Teammates clone your setup in 30 seconds.

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
| "I need to reach services from outside the cluster" | Private Connect |
| "I need to share my dev environment with a teammate" | Private Connect |
| "I need all my devices on one network" | Tailscale |
| "I need cross-environment access (staging + prod)" | Private Connect |
| "I need Kubernetes services accessible from my laptop" | Private Connect |
| "I need named, discoverable services across environments" | Private Connect |

They're complementary. Use both.

**Kubernetes users**: Private Connect works alongside your existing service discovery. It doesn't replace `postgres.staging.svc.cluster.local`—it makes those services accessible from outside the cluster, with team sharing built in.

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

- **Tailscale**: "Can I reach that machine?"
- **Private Connect**: "Can I reach that service by name, from anywhere, and share it with my team?"

**For Kubernetes users**: Your internal DNS (`postgres.staging.svc.cluster.local`) works great inside the cluster. Private Connect makes those same services accessible from your laptop, CI/CD, or any environment—without VPN, SSH tunnels, or exposing services publicly.

Use Tailscale for the network. Use Private Connect for cross-environment service access and team collaboration.

---

**Get started:**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

