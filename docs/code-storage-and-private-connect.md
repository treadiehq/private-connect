# Private Connect and Code Storage

Code Storage keeps the code. Private Connect reaches the private world around it.

---

## The story

[Code Storage](https://code.storage) (by Pierre Computer Company) is the system of record for machine-generated code: API-first Git infrastructure with programmatic repo creation, ultra-low-latency clone/push/fetch, ephemeral branches, and SDKs in TypeScript, Python, and Go.

Private Connect is the access layer for everything around that code: secure, named access to private services — databases, staging APIs, preview apps, internal tools — without exposing them to the internet.

Together:

- **Code Storage** handles the repo lifecycle (create repo → push code → branch → merge)
- **Private Connect** handles the runtime access (create environment → expose services → grant access → tear down)

They don't compete. They complement. If someone is building "create repo → push code → run app," Code Storage gives them the Git layer, Private Connect gives them:

- Secure service discovery by name
- Ephemeral share links to previews
- Revocable access for teammates or agents
- Private DNS for generated environments

---

## Getting started: Reach Code Storage privately

The simplest integration — expose a self-hosted or BYOC Code Storage instance via Private Connect and reach it from anywhere by name.

### Step 1: Expose Code Storage (on your server)

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
connect daemon install

connect expose localhost:3000 --name code-storage
```

Your Code Storage instance stays on localhost. Nothing is publicly exposed.

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

Or via the Code Storage SDK:

```typescript
const store = new GitStorage({
  name: 'my-org',
  key: process.env.CODE_STORAGE_KEY,
  baseUrl: 'http://localhost:3000',
});

const repo = await store.createRepo('new-project');
await repo.push(files);
```

### CI/CD pipelines

GitHub Actions or other CI runners can reach Code Storage without exposing it publicly:

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

### Project config

Include Code Storage alongside your other services so `connect dev` sets everything up:

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
```

### Receive Code Storage webhooks locally

During development, receive Code Storage webhooks on your local machine:

```bash
connect expose localhost:8080 --name webhook-dev --public
# → https://abc123.privateconnect.co

# Use that URL as Code Storage's webhook endpoint
# Pushes to any repo now hit your local handler
```

### Share access with teammates

Give teammates or contractors access to Code Storage without managing VPN accounts:

```bash
# Time-limited share
connect share --expires 7d --name "contractor-git-access"
# → Share code: x7k9m2

# Contractor joins
connect join x7k9m2
connect reach code-storage --port 3000
# → git clone works immediately
```

Revoke anytime: `connect share --revoke x7k9m2`

---

## Branch-to-environment access

The strongest integration pattern: when Code Storage creates a branch, Private Connect automatically creates a named environment for the runtime behind it.

```
Code Storage                          Private Connect
─────────────                         ───────────────
branch created: agent/fix-auth-bug
  → webhook fires                     → POST /v1/groups
                                        { name: "fix-auth-bug",
                                          services: [app, db, logs] }

                                      → fix-auth-bug.app.connect
                                      → fix-auth-bug.db.connect
                                      → fix-auth-bug.logs.connect

branch deleted                        → DELETE /v1/groups/:id
                                      → all services, grants, shares gone
```

Agents and humans get stable access without VPN setup or manual tunnels.

---

## How it works (API)

### Create a group with services

```bash
curl -X POST https://api.privateconnect.co/v1/groups \
  -H "x-api-key: pc_xxx" \
  -d '{
    "name": "fix-auth-bug",
    "metadata": { "branch": "fix-auth-bug", "repo": "acme/app" },
    "services": [
      { "agentId": "...", "name": "app", "targetHost": "localhost", "targetPort": 3000 },
      { "agentId": "...", "name": "db",  "targetHost": "localhost", "targetPort": 5432 }
    ]
  }'
```

Services are created as `fix-auth-bug.app` and `fix-auth-bug.db`, reachable via `fix-auth-bug.app.connect` and `fix-auth-bug.db.connect` with local DNS.

### Grant scoped access to the group

```bash
curl -X POST https://api.privateconnect.co/v1/grants \
  -H "x-api-key: pc_xxx" \
  -d '{
    "agentLabel": "codex",
    "resourceType": "api",
    "groupId": "<group-id>",
    "scope": "full",
    "ttl": "1d"
  }'
```

Creates a time-limited grant for every service in the group.

### Share the group with a teammate

```bash
curl -X POST https://api.privateconnect.co/v1/groups/<id>/shares \
  -H "x-api-key: pc_xxx" \
  -d '{ "name": "preview-for-alice", "expiresIn": "24h" }'
```

Alice gets share links for each service — no account required.

### Tear it all down

```bash
curl -X DELETE https://api.privateconnect.co/v1/groups/<id> \
  -H "x-api-key: pc_xxx"
```

Group deleted. All services, grants, and shares cascade-deleted.

---

## How it works (SDK)

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({ apiKey: process.env.PC_KEY });

// Branch created → spin up environment
const group = await pc.groups.create({
  name: 'fix-auth-bug',
  metadata: { branch: 'fix-auth-bug', repo: 'acme/app' },
  services: [
    { agentId, name: 'app', targetHost: 'localhost', targetPort: 3000 },
    { agentId, name: 'db',  targetHost: 'localhost', targetPort: 5432 },
  ],
});

// Grant access for an AI agent
const grants = await pc.grants.create({
  agentLabel: 'codex',
  resourceType: 'api',
  groupId: group.id,
  scope: 'full',
  ttl: '1d',
});

// Share with a teammate
const shares = await pc.groups.createShares(group.id, {
  name: 'preview-for-alice',
  expiresIn: '24h',
});

// Branch deleted → tear down
await pc.groups.delete(group.id);
```

---

## Integration patterns

### 1. Webhook-driven (recommended)

Code Storage fires webhooks on repo and branch events. Your glue service (Cloudflare Worker, Lambda, or app server) receives them and calls Private Connect's API:

```
Code Storage webhook → your middleware → Private Connect REST API
```

### 2. SDK-to-SDK

Your application code calls both SDKs directly:

```typescript
// Code Storage
const store = new GitStorage({ name: 'org', key });
const repo  = await store.createRepo('agent-session-123');

// Private Connect
const group = await pc.groups.create({
  name: 'agent-session-123',
  services: [{ agentId, name: 'app', targetHost: 'localhost', targetPort: 3000 }],
});
```

### 3. Self-hosted / BYOC Code Storage

For managed-on-your-hardware or self-managed enterprise deployments, use the tunnel approach from [Getting Started](#getting-started-reach-code-storage-privately) above. Expose the instance by name, reach it from anywhere — no public endpoint required.

---

## Use cases

| Scenario | Code Storage role | Private Connect role |
|----------|-------------------|----------------------|
| AI agent writes code to a branch | Git storage for the branch | Named access to staging DB, APIs |
| Preview environment per branch | Ephemeral branch with in-memory writes | Ephemeral service group with share links |
| CI/CD builds from private repos | Git infra for build artifacts | Secure access for CI runners to private infra |
| Contractor needs to see a preview | - | Time-limited share code for the group |
| Branch merged/deleted | Repo cleanup, cold storage | Cascade-delete group and all access |

---

## Comparison

| Approach | Public exposure | Multi-device | Team sharing | Batch teardown | Setup time |
|----------|----------------|--------------|--------------|----------------|------------|
| Public endpoint | Yes (risky) | Yes | N/A | N/A | 0 min |
| VPN | No | Yes | Complex | Manual | 30+ min |
| SSH tunnel | No | Manual | No | No | 10 min |
| IP allowlist | Partially | No | Per-IP | Manual | 15 min |
| **Private Connect** | **No** | **Yes** | **One command** | **One API call** | **2 min** |

---

## Related

- [Code Storage docs](https://code.storage/docs)
- [Code Storage pricing](https://code.storage/pricing)
- [Private Connect AI integration](AI.md)
- [Private Connect SDK reference](../packages/sdk/README.md)
- [Private Connect security model](security.md)
