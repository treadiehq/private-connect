# Free tier

Temporary tunnels and share-by-code are available **without an account**. These limits apply to unauthenticated use.

## Temporary tunnels (`npx private-connect tunnel <port>`)

| Limit | Value |
|-------|--------|
| **Session TTL** | Up to **24 hours** (configurable via `--ttl` in minutes; server cap is set by `MAX_TEMP_TUNNEL_TTL_MINUTES`, default 1440). |
| **Protocols** | HTTP, TCP (`--tcp`), UDP (`--udp`) in one CLI/API. |
| **Stable URL** | Optional `--slug` (e.g. `--slug mygame`) gives a stable subdomain like `https://mygame.privateconnect.co` if the name is available. Otherwise you get a random or prefixed subdomain. |
| **Bandwidth** | No hard cap for normal dev use; fair use applies. |
| **Account** | Not required. |

Example:

```bash
# 24-hour tunnel with a stable URL (no signup)
npx private-connect tunnel 3000 --slug myapp --ttl 1440
```

## Share codes (up/join)

- **No account** required for the viewer; share link or join code works in the browser or CLI.
- Share creator can use the full CLI with or without an account depending on flow.
- Audit logs and expiration (e.g. 30m, 24h) apply as configured.

## Server configuration

Operators can tune the free tier:

- **`MAX_TEMP_TUNNEL_TTL_MINUTES`** — Maximum TTL for temporary tunnels (default `1440` = 24h). Min 60, max 10080 (7 days).
- Rate limits (per-IP / per-endpoint) are defined in the API; no separate “free tier bandwidth” cap is enforced by default.

## Paid / registered features

- **Custom subdomains** for named services (e.g. `pc-myname.privateconnect.co`) and persistent tunnels are available with a workspace/account.
- **Named agents**, **reach by name**, and **team sharing** use the full CLI with signup.

See [README](../README.md) and [DETAILED.md](../DETAILED.md) for full capabilities.
