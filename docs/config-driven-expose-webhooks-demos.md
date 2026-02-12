# Config-driven expose: `connect serve`

Expose multiple local services from one config file with one command. Define your webhooks, demos, and APIs in `pconnect.yml` and run `connect serve`.

---

## Quick start

Add an `expose` section to your `pconnect.yml`:

```yaml
# pconnect.yml

expose:
  web:
    target: localhost:3000
    public: true
  api:
    target: localhost:8000
```

Then:

```bash
connect serve
```

Output:

```
📡 Private Connect Serve

  Config:   /path/to/pconnect.yml
  Hub:      https://api.privateconnect.co
  Services: 2

  ── web ──

  🔗 Exposing localhost:3000 as "web"...
  [ok] Service registered
  🌐 Public URL: https://abc123.privateconnect.co

  ── api ──

  🔗 Exposing localhost:8000 as "api"...
  [ok] Service registered

─────────────────────────────────────
  Serve Summary

  ✓ 2 service(s) exposed:

    web → localhost:3000 [public]
    api → localhost:8000 [private]

  Press Ctrl+C to stop all services
```

---

## Config format

The `expose` block goes in the same `pconnect.yml` (or `.yaml` / `.json`) that `connect dev` already uses. Both sections can coexist in one file.

### YAML

```yaml
# Services to reach (connect dev)
services:
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379

# Services to expose from this machine (connect serve)
expose:
  web:
    target: localhost:3000
    public: true
  api:
    target: localhost:8000
    public: true
  internal-api:
    target: localhost:8081
```

### JSON

```json
{
  "services": [
    { "name": "staging-db", "port": 5432 },
    { "name": "redis", "port": 6379 }
  ],
  "expose": {
    "web": { "target": "localhost:3000", "public": true },
    "api": { "target": "localhost:8000", "public": true },
    "internal-api": { "target": "localhost:8081" }
  }
}
```

### Fields

| Field | Required | Description |
|-------|----------|-------------|
| `target` | Yes | `host:port` to expose (e.g. `localhost:3000`) |
| `public` | No | If `true`, the hub creates a public URL (for webhooks/demos). Default: `false` |

The key (e.g. `web`, `api`) becomes the **service name** in the hub. Teammates can `connect reach web` or `connect reach api` to access it.

---

## CLI reference

```bash
connect serve [options]

Options:
  -H, --hub <url>    Hub URL (default: https://api.privateconnect.co)
  -f, --file <path>  Path to pconnect.yml file
  -c, --config <path> Agent config file path
```

`connect serve` reads only the `expose` block. `connect dev` reads only the `services` block. Same file, two commands, clear separation.

---

## Webhook testing workflow

1. Add your app and webhook endpoint to `pconnect.yml`:

```yaml
expose:
  webhooks:
    target: localhost:3000
    public: true
```

2. Start your app locally (`npm run dev`, `bun dev`, etc.).

3. Run `connect serve`. Copy the public URL from the output.

4. Paste the URL into your webhook provider (Stripe, GitHub, Polar, etc.).

5. Webhooks hit your local app. Stop with Ctrl+C.

Next session: same file, same command, same URL (as long as the service name stays the same).

---

## Multiple demos

Running a frontend and backend that both need public URLs:

```yaml
expose:
  frontend:
    target: localhost:3000
    public: true
  backend:
    target: localhost:8000
    public: true
```

```bash
connect serve
# Both get public URLs. Share them with your team or stakeholders.
```

---

## Private-only (no public URL)

Not everything needs a public URL. Omit `public` (or set it to `false`) and the service is only reachable by teammates via `connect reach`:

```yaml
expose:
  internal-api:
    target: localhost:8081
  worker:
    target: localhost:9000
```

Teammates run:

```bash
connect reach internal-api
connect reach worker
```

---

## Relation to other commands

| Use case | Command |
|----------|---------|
| Quick anonymous tunnel (no config, no account) | `npx private-connect tunnel 3000` |
| Single expose with flags | `connect expose localhost:3000 --name web --public` |
| Multiple exposes from config | `connect serve` (reads `expose` block) |
| Reach team's services from config | `connect dev` (reads `services` block) |
| Public URL with policy (methods, paths, rate limit) | `connect link <service> --expires 7d --methods POST` |

`connect serve` and `connect dev` complement each other: one exposes, one reaches. Both read from the same `pconnect.yml`.
