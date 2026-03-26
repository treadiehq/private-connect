# Using Private Connect with Code Storage

Code Storage handles your Git infrastructure. Private Connect keeps it private and reachable.

---

## What is Code Storage?

[Code Storage](https://code.storage) (by Pierre Computer Company) is an API-first Git infrastructure layer. You create repos programmatically, push and fetch at ultra-low latency, and integrate Git workflows directly into your product via SDKs in TypeScript, Python, and Go.

It's built for AI coding platforms, agentic frameworks, and any product that needs programmable Git storage without the limitations of GitHub's API.

```javascript
const store  = new GitStorage({ name: 'test', key });
const repo   = await store.createRepo('repo');
const remote = await repo.getRemoteUrl(); // test.code.storage/repo
```

---

## Why Private Connect + Code Storage?

Code Storage offers managed cloud and self-hosted (bring your own cloud) deployments. In both cases, your Git infrastructure often needs to be reachable by machines — AI agents, CI runners, dev environments — without being exposed to the public internet.

Private Connect adds a secure, named service layer on top:

| Capability | Without Private Connect | With Private Connect |
|------------|-------------------------|----------------------|
| Agent access to Git infra | Public endpoint or VPN | `connect reach code-storage` |
| Team access to self-hosted instance | Firewall rules, VPN configs | `connect share` / `connect clone` |
| Contractor access | Provision VPN accounts | Time-limited share codes |
| CI/CD access | Allowlisted IPs or public endpoint | `connect up --api-key` + reach |
| Webhook delivery to local dev | ngrok or similar | `connect expose --public` |

---

## Architecture

```
┌─────────────────────┐         ┌───────┐         ┌─────────────────┐
│ AI Agent / CI / Dev  │────────▶│  Hub  │◀────────│  Your Server    │
│                     │         └───────┘         │                 │
│ SDK / git clone     │                           │ Code Storage    │
│ → localhost:3000    │                           │ localhost:3000  │
└─────────────────────┘                           └─────────────────┘
```

Code Storage stays on `localhost`. Private Connect makes it reachable by name. E2E encrypted, no open ports.

---

## Quick Start: Self-Hosted Code Storage

### Step 1: Expose Code Storage (on your server)

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect daemon install

connect expose localhost:3000 --name code-storage
```

Your Code Storage instance stays on localhost — nothing is publicly exposed.

### Step 2: Connect from anywhere

```bash
# From your laptop, a CI runner, or an AI agent VM
connect up
connect reach code-storage --port 3000
```

Now `localhost:3000` tunnels to your Code Storage instance:

```bash
git clone http://localhost:3000/my-org/repo
```

Or via the SDK:

```javascript
const store = new GitStorage({
  name: 'my-org',
  key: process.env.CODE_STORAGE_KEY,
  baseUrl: 'http://localhost:3000',
});

const repo = await store.createRepo('new-project');
await repo.push(files);
```

---

## Use Case: AI Agents with Private Git Access

AI coding agents (Codex, Cursor background agents, custom agentic frameworks) need to read and write repos. But your Git infrastructure shouldn't be internet-facing.

**On your server:**

```bash
connect expose localhost:3000 --name code-storage
```

**On the agent VM:**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up --api-key $PRIVATECONNECT_KEY
connect reach code-storage --port 3000
```

**In the agent's code:**

```javascript
const store = new GitStorage({
  name: 'workspace',
  key: process.env.CODE_STORAGE_KEY,
  baseUrl: 'http://localhost:3000',
});

const repo = await store.createRepo('agent-session-' + sessionId);
await repo.commit({ files, message: 'agent: initial scaffold' });
```

The agent creates repos, pushes code, and branches — all routed securely through Private Connect. No public URLs, no IP allowlists.

---

## Use Case: Team Access to Shared Git Infra

Your team runs a shared Code Storage instance for staging/dev repos. Instead of managing VPN access or firewall rules:

```bash
# Admin: expose the instance
connect expose localhost:3000 --name code-storage

# Share with the team
connect share --name "dev-git-infra"
# → Share code: x7k9m2
```

```bash
# Teammate
connect join x7k9m2
connect reach code-storage --port 3000

git clone http://localhost:3000/team/project
```

New hires get access in 30 seconds. Contractors get time-limited shares. Revoke with one command.

---

## Use Case: CI/CD Pipelines

GitHub Actions or other CI runners need to push artifacts to Code Storage without exposing it publicly.

```yaml
# .github/workflows/build.yml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Connect to private Git infra
        run: |
          curl -fsSL https://privateconnect.co/install.sh | bash
          connect up --api-key ${{ secrets.PRIVATECONNECT_KEY }}
          connect reach code-storage --port 3000

      - name: Push build artifacts
        run: |
          git clone http://localhost:3000/builds/artifacts
          cp -r dist/ artifacts/
          cd artifacts && git add . && git commit -m "build ${{ github.sha }}" && git push
```

---

## Use Case: Receive Code Storage Webhooks Locally

Code Storage sends webhooks when repos are pushed to, branches are created, etc. During development, receive them on your local machine:

```bash
# Expose your local webhook handler
connect expose localhost:8080 --name webhook-dev --public
# → https://abc123.privateconnect.co

# Configure Code Storage webhook to point to that URL
# Pushes to any repo now hit your local handler
```

---

## Project Config: `pconnect.yml`

Include Code Storage alongside your other services:

```yaml
# pconnect.yml
services:
  - name: code-storage
    port: 3000
  - name: staging-db
    port: 5432
  - name: redis
    port: 6379
```

```bash
cd my-project
connect dev
# ✓ Connected: code-storage, staging-db, redis

# Everything is on localhost, ready to go
```

---

## Comparison

| Approach | Public exposure | Multi-device | Team sharing | Revocable | Setup time |
|----------|----------------|--------------|--------------|-----------|------------|
| Public endpoint | Yes (risky) | Yes | N/A | N/A | 0 min |
| VPN | No | Yes | Complex | IT ticket | 30+ min |
| SSH tunnel | No | Manual | No | Delete keys | 10 min |
| IP allowlist | Partially | No | Per-IP | Manual | 15 min |
| **Private Connect** | **No** | **Yes** | **One command** | **Instant** | **2 min** |

---

## Related

- [Code Storage docs](https://code.storage/docs)
- [Code Storage pricing](https://code.storage/pricing)
- [Private Connect AI integration](AI.md)
- [exe.dev + Private Connect](exe-dev-private-access.md)
- [Private Connect security model](security.md)
