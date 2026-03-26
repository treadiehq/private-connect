# Private Connect and Stripe Projects

Stripe Projects provisions the services. Private Connect makes them reachable.

---

## The gap

`stripe projects add` provisions a service — a database, auth instance, analytics project — generates credentials, and syncs environment variables to `.env`.

But those URLs still need to be *reachable* — from a dev laptop behind NAT, from a CI runner in a locked-down network, or from an AI agent's sandboxed environment.

Today that's manual: firewall rules, IP allowlists, SSH tunnels, VPN configs. Every provisioned service creates a new connectivity problem.

---

## The integration

Private Connect fits the Stripe Projects catalog as a connectivity provider — a new category alongside hosting, databases, and auth:

```bash
stripe projects init my-app
stripe projects add vercel/project
stripe projects add planetscale/database
stripe projects add clerk/auth
stripe projects add posthog/analytics
stripe projects add privateconnect/connectivity
```

Adding `privateconnect/connectivity` provisions a Private Connect workspace and deploys an always-on agent that exposes every provisioned service by name. From any machine — dev laptop, CI runner, agent sandbox — you just reach:

```bash
connect up
connect reach my-database --port 5432
connect reach my-api --port 3000
```

`localhost:5432` and `localhost:3000` tunnel to the provisioned services, E2E encrypted. No firewall changes, no open ports, no VPN.

New services added to the project later are automatically exposed and reachable.

---

## How Private Connect works

Private Connect uses a hub-and-spoke model. An agent on a machine that *can* reach a service runs `connect expose` to make it available by name. Any other machine runs `connect reach` to access it at localhost — all traffic E2E encrypted (X25519 + AES-256-GCM).

`connect expose` accepts any `host:port` — not just localhost. This means an agent can expose cloud-hosted services (databases, APIs, storage) as long as it has network access to them:

```bash
connect expose db-host.us-east-2.aws.example.com:5432 --name my-database
connect expose api.example.supabase.co:443 --name my-api
```

The Stripe Projects integration would automate this: when a service is provisioned, the deployed agent automatically exposes it. Developers and agents on the other end just `connect reach`.

---

## Where this matters most

### AI agent sandboxes

Agents provisioning infrastructure via Stripe Projects run in sandboxed environments. These sandboxes are typically firewalled and can't directly reach cloud services. With the integration, everything provisioned is already exposed — the sandbox just reaches:

```bash
# Inside an agent sandbox
connect up --api-key $PRIVATECONNECT_KEY
connect reach my-database --port 5432

# Agent can now query the provisioned database at localhost:5432
```

### Local development

Developer provisions cloud services but works locally. The provisioned services may have IP restrictions, require VPN, or sit behind a firewall. With the integration, all services are already reachable:

```bash
connect dev
# ✓ Connected: my-database (5432), auth-service (4000)
```

### CI/CD pipelines

CI runners need to reach provisioned services for integration tests. No need to allowlist runner IPs or manage VPN configs:

```yaml
# .github/workflows/test.yml
jobs:
  integration:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Reach provisioned services
        run: |
          curl -fsSL https://privateconnect.co/install.sh | bash
          connect up --api-key ${{ secrets.PRIVATECONNECT_KEY }}
          connect reach my-database --port 5432

      - name: Run integration tests
        run: pnpm test:integration
        env:
          DATABASE_URL: postgresql://localhost:5432/mydb
```

### Cross-environment access

Services provisioned for production need to be reachable from staging, or vice versa — without exposing them publicly:

```bash
connect reach prod-db --port 5432
connect reach staging-api --port 3000
```

---

## Project config

Include Private Connect alongside Stripe Projects so `connect dev` sets up all connectivity:

```yaml
# pconnect.yml
services:
  - name: my-database
    port: 5432
  - name: supabase-storage
    port: 8000
  - name: posthog
    port: 8080
```

```bash
cd my-app
connect dev
# ✓ Connected: my-database, supabase-storage, posthog
```

---

## Catalog entry

```bash
stripe projects catalog privateconnect
# → privateconnect/connectivity — E2E encrypted access to all provisioned services
```

| What Stripe Projects does | What Private Connect adds |
|---|---|
| Provisions services | Makes them reachable from anywhere |
| Generates credentials | Encrypts every connection E2E |
| Syncs env vars to `.env` | Ensures the URLs actually resolve |
| Manages billing and upgrades | Zero-config connectivity across environments |

---

## The story

Stripe Projects solved provisioning — creating accounts, generating credentials, and managing billing across providers from one CLI.

But provisioning is only half the problem. The other half is *reaching* what you provisioned. A `DATABASE_URL` in `.env` is useless if your machine can't connect to it.

Private Connect is the connectivity layer that makes every provisioned service actually usable — from any machine, any environment, any agent sandbox. No VPN, no open ports, E2E encrypted.

**Stripe Projects provisions. Private Connect connects.**
