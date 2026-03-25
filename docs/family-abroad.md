# Share Your Home with Family Abroad

Give family in another country access to your home network and services, without VPN setup, port forwarding, or walking them through firewall rules.

---

## The scenario

You’re in the US (or anywhere). Your dad, sibling, or friend is in Japan, Brazil, or another country. You want them to:

- **Use your home as an exit** (optional) — e.g. watch US Netflix, YouTube TV, or other region-locked services by routing through your connection.
- **Reach your home services by name** — Jellyfin, Plex, NAS, Home Assistant, cameras, or anything you expose — without remembering IPs or ports.
- **Get access in seconds** — you send a link or code; they run one command. Revoke anytime.

**Tailscale** handles the network (and optional exit node). **Private Connect** handles named service access and sharing.

---

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│  Family abroad (e.g. Japan)                                     │
│  • Laptop/phone/tablet: Private Connect → your services by name  │
│  • Apple TV / TV device: Tailscale only → US exit for streaming  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │  Tailscale (network)
                            │  Private Connect (service names + share)
                            │
┌───────────────────────────▼─────────────────────────────────────┐
│  Your home (e.g. US)                                             │
│  • Router / server: Tailscale exit node (optional)               │
│  • Home server: connect expose jellyfin, nas, …                  │
└─────────────────────────────────────────────────────────────────┘
```

- **Streaming (e.g. US Netflix)**  
  They use Tailscale with your router (or a device at your home) as exit node. Traffic exits in your country; streaming works. No Private Connect needed for that part.

- **Your home services (Jellyfin, NAS, etc.)**  
  You expose them with Private Connect and share a code. They run `connect join <code>` and get `jellyfin`, `nas`, and whatever you shared — by name, from anywhere.

---

## Setup (you, at home)

**1. Tailscale (if you want exit-node + streaming for them)**

```bash
# On your router or a machine that’s always on
tailscale up --advertise-exit-node
```

In the Tailscale admin, allow that node as an exit node. Your family then selects it as “Exit node” in the Tailscale client to use your home for streaming.

**2. Private Connect on your home server**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect daemon install
```

**3. Expose your home services**

```bash
connect expose localhost:8096 --name jellyfin
connect expose localhost:8123 --name homeassistant
connect expose 192.168.1.50:445 --name nas
# add whatever you want them to reach
```

**4. Create a share for family**

Use a long-lived share so they don’t have to re-join often:

```bash
connect share --expires 90d --name "Family abroad"
# → Share code: x7k9m2
```

Send them the code (or the share link from `connect share` if you use the web flow).

---

## Setup (family, abroad)

**1. Tailscale (optional — only if they want your exit for streaming)**

- Install Tailscale on their devices (e.g. Apple TV, laptop, phone).
- Join your tailnet (you invite the same Tailscale account or use a shared tailnet).
- On devices where they want “US” streaming: set your home node as **Exit node** in Tailscale. Done.

**2. Private Connect (for your home services by name)**

They only need a machine where they can run the CLI (laptop, desktop, or a small VM):

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect join x7k9m2
```

After that:

- `connect reach jellyfin` → Jellyfin on their localhost (e.g. browser: `http://localhost:8096`)
- `connect reach nas` → NAS on localhost
- Same for any service you exposed and included in the share.

No VPN config, no IPs, no port lists. Revoke access anytime with `connect share --revoke x7k9m2`.

---

## Summary

| Goal                         | Use                         |
|-----------------------------|-----------------------------|
| They use your home for streaming (e.g. US Netflix) | Tailscale + your router/device as exit node |
| They reach your Jellyfin, NAS, etc. by name        | Private Connect: you `expose` + `share`, they `join` |
| Revoke or change access                            | `connect share --revoke <code>` or create a new share |

Tailscale gives them the network (and optional exit). Private Connect gives them **your services by name** and a single share code. No new software to build — just this setup and a clear story for “family abroad.”

See also:

- [Tailscale and Private Connect](tailscale-and-private-connect.md) — how the two fit together
- [Use Cases: Access Your Home Lab from Anywhere](./use_cases.md#access-your-home-lab-from-anywhere) — home lab basics
