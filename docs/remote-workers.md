# Build Remote Workers into Your Product

**Ship "run anywhere, control from anywhere" without building networking infrastructure.** Use Private Connect as the connectivity layer so your users can run your tool on any machine and operate it remotely — from a web app, a phone, or another machine.

## The Pattern

Products like Cursor, Windsurf, and Devin are shipping a new UX: run a worker process on a powerful remote machine, control it from wherever you are. The worker connects home, exposes a control surface, and the user sends commands from a lightweight client.

Building this yourself means solving NAT traversal, relay infrastructure, encryption, auth, service discovery, and multi-tenant isolation. Private Connect handles all of that so you can focus on your product.

```
┌──────────────────────┐                          ┌──────────────────────┐
│   User's Phone /     │                          │   Remote Machine     │
│   Web App / CLI      │                          │                      │
│                      │                          │   ┌────────────────┐ │
│   your-tool control  │──── reach by name ──────▶│   │  your-tool     │ │
│                      │                          │   │  worker         │ │
│                      │      ┌─────────┐         │   └───────┬────────┘ │
│                      │◀────▶│   Hub   │◀────────│───────────┘          │
└──────────────────────┘      │ (relay) │         │   connect expose     │
                              └─────────┘         │   "my-tool-control"  │
                                                  └──────────────────────┘
```

**What you build:** Your tool's control protocol, your UI, your user auth.
**What Private Connect handles:** Networking, encryption, discovery, machine auth, multi-tenant isolation.

## Quick Start: Embed Private Connect

### Step 1: Worker startup (remote machine)

When your tool's worker process starts on a user's machine, register it as a Private Connect agent and expose its control interface.

**Using the SDK (Node.js/TypeScript):**

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

async function startWorker(controlPort: number) {
  const pc = new PrivateConnect({
    apiKey: process.env.PRIVATECONNECT_API_KEY,
  });

  // Register this machine as an agent
  const agent = await pc.agents.provision({
    clientType: 'other',
    label: `worker-${hostname()}`,
    ttlSeconds: 86400,
  });

  // Expose the worker's control interface by name
  await pc.services.expose({
    name: 'my-tool-control',
    port: controlPort,
  });

  console.log(`Worker registered. Reachable as: my-tool-control`);
}
```

**Using the CLI (any language):**

```bash
# Install Private Connect on the worker machine
curl -fsSL https://privateconnect.co/install.sh | bash

# Register and expose in two commands
connect up --api-key "$PRIVATECONNECT_API_KEY"
connect expose localhost:9000 --name my-tool-control
```

Your tool spawns these commands as a subprocess — works from Go, Rust, Python, or anything that can exec a shell command.

### Step 2: Control surface (client side)

From your web app, CLI, or mobile app, reach the worker's control interface by name.

**Using the SDK:**

```typescript
const pc = new PrivateConnect({
  apiKey: process.env.PRIVATECONNECT_API_KEY,
});

// Connect to the worker — returns a local port
const connection = await pc.services.reach({ name: 'my-tool-control' });

// Now talk to localhost:<port> using your tool's protocol
const ws = new WebSocket(`ws://localhost:${connection.port}`);
ws.send(JSON.stringify({ command: 'run-task', payload: { ... } }));
```

**Using the CLI:**

```bash
connect reach my-tool-control
# → my-tool-control available at localhost:9000

# Your client connects to localhost:9000
```

### Step 3: Multi-worker (optional)

Users running workers on multiple machines get named services per worker.

```typescript
// Worker on GPU box
await pc.services.expose({ name: 'worker-gpu-a100', port: 9000 });

// Worker on CPU box
await pc.services.expose({ name: 'worker-cpu-build', port: 9000 });

// Client lists available workers
const services = await pc.services.list();
// → [{ name: 'worker-gpu-a100', online: true }, { name: 'worker-cpu-build', online: true }]

// Reach a specific one
await pc.services.reach({ name: 'worker-gpu-a100' });
```

## What You Get for Free

| Capability | What it means for your product |
|---|---|
| **NAT traversal** | Workers behind firewalls, home routers, corporate NATs — all reachable |
| **E2E encryption** | X25519 + AES-256-GCM between client and worker — the hub can't read traffic |
| **Named services** | Workers are `worker-gpu-a100`, not `192.168.1.47:9000` |
| **No open ports** | Workers make outbound connections only — nothing listens publicly |
| **Agent auth** | 256-bit tokens, SHA-256 hashed at rest, auto-expire after TTL |
| **Workspace isolation** | Each customer's workers are isolated by workspace — no cross-tenant leakage |
| **Auto-reconnect** | Daemon mode survives network blips, reboots, sleep/wake |
| **Audit trail** | Every connection logged with agent ID, service name, timestamp |
| **Share codes** | `connect share` gives a one-code path to grant someone access to a worker |
| **Grants** | Scoped, time-limited tokens for AI agents to access worker services |

## Integration Patterns

### Pattern 1: CLI sidecar (any language)

Your tool spawns the `connect` CLI as a subprocess. Works from any language.

```python
# Python example
import subprocess, os

def start_worker(control_port: int):
    subprocess.run([
        "connect", "up",
        "--api-key", os.environ["PRIVATECONNECT_API_KEY"]
    ], check=True)

    subprocess.run([
        "connect", "expose",
        f"localhost:{control_port}",
        "--name", f"worker-{socket.gethostname()}"
    ], check=True)
```

```go
// Go example
func startWorker(controlPort int) error {
    if err := exec.Command("connect", "up",
        "--api-key", os.Getenv("PRIVATECONNECT_API_KEY"),
    ).Run(); err != nil {
        return err
    }

    return exec.Command("connect", "expose",
        fmt.Sprintf("localhost:%d", controlPort),
        "--name", fmt.Sprintf("worker-%s", hostname()),
    ).Run()
}
```

### Pattern 2: SDK embed (Node.js/TypeScript)

Import the SDK directly. Tighter integration, no subprocess management.

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

class WorkerManager {
  private pc: PrivateConnect;

  constructor(apiKey: string) {
    this.pc = new PrivateConnect({ apiKey });
  }

  async register(name: string, controlPort: number) {
    await this.pc.agents.provision({
      clientType: 'other',
      label: name,
      ttlSeconds: 86400,
    });

    await this.pc.services.expose({ name, port: controlPort });
  }

  async listWorkers() {
    return this.pc.services.list();
  }

  async connectTo(workerName: string) {
    return this.pc.services.reach({ name: workerName });
  }
}
```

### Pattern 3: API-driven (HTTP)

Use the REST API directly from any language or platform.

```bash
# Provision an agent
curl -X POST https://api.privateconnect.co/v1/agents/provision \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "clientType": "other",
    "label": "worker-gpu-01",
    "ttlSeconds": 86400
  }'

# List services
curl https://api.privateconnect.co/v1/services \
  -H "x-api-key: $API_KEY"
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Your Product                                  │
│                                                                      │
│  ┌─────────────────┐          ┌──────────────────────────────────┐  │
│  │  Control Client  │          │  Worker Process                  │  │
│  │  (Web/Mobile/CLI)│          │  (Remote Machine)                │  │
│  │                  │          │                                  │  │
│  │  Your UI         │          │  Your Tool Logic                 │  │
│  │  Your Auth       │          │  ┌────────────────────────────┐  │  │
│  │  Your Protocol   │          │  │ Control Interface (:9000)  │  │  │
│  │                  │          │  └────────────┬───────────────┘  │  │
│  └────────┬─────────┘          └───────────────┼─────────────────┘  │
│           │                                    │                     │
└───────────┼────────────────────────────────────┼─────────────────────┘
            │                                    │
            │         Private Connect            │
            │    ┌───────────────────────┐        │
            │    │                       │        │
            ▼    ▼                       ▼        ▼
     ┌──────────────┐             ┌──────────────┐
     │  SDK / CLI   │             │  SDK / CLI   │
     │  reach()     │             │  expose()    │
     └──────┬───────┘             └──────┬───────┘
            │                            │
            │      ┌──────────────┐      │
            └─────▶│     Hub      │◀─────┘
                   │  (encrypted  │
                   │   relay)     │
                   └──────────────┘
```

**Your product owns the top half.** Private Connect owns the bottom half.

## Real-World Example: AI Coding Agent

An AI coding tool wants to let users run agents on powerful remote machines and control them from a browser.

```typescript
// === WORKER SIDE (runs on user's devbox) ===

import { PrivateConnect } from '@privateconnect/sdk';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';

// 1. Start the control server
const server = createServer();
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.on('message', async (data) => {
    const { command, args } = JSON.parse(data.toString());
    const result = await executeCommand(command, args);
    ws.send(JSON.stringify({ result }));
  });
});

server.listen(9000);

// 2. Register with Private Connect
const pc = new PrivateConnect({
  apiKey: process.env.PRIVATECONNECT_API_KEY,
});

await pc.agents.provision({
  clientType: 'other',
  label: `agent-${hostname()}`,
  ttlSeconds: 86400,
});

await pc.services.expose({ name: `agent-${hostname()}`, port: 9000 });

console.log('Worker running. Control from anywhere.');
```

```typescript
// === CLIENT SIDE (browser, phone, CLI) ===

const pc = new PrivateConnect({
  apiKey: process.env.PRIVATECONNECT_API_KEY,
});

// List available workers
const workers = await pc.services.list();
// → [{ name: 'agent-devbox', online: true, latency: 45 }]

// Connect to a worker
const conn = await pc.services.reach({ name: 'agent-devbox' });

// Send a task
const ws = new WebSocket(`ws://localhost:${conn.port}`);
ws.send(JSON.stringify({
  command: 'run-task',
  args: { prompt: 'Refactor the auth module' },
}));
```

## Comparison: Build vs. Use Private Connect

| | Build it yourself | Private Connect |
|---|---|---|
| NAT traversal | STUN/TURN servers, relay infra | Built in |
| Encryption | TLS cert management, key exchange | E2E (X25519 + AES-256-GCM) |
| Service discovery | Custom registry, health checks | Named services, auto-discovery |
| Auth | Token issuance, rotation, revocation | Agent tokens, API keys, grants |
| Multi-tenant isolation | Application-level scoping | Workspace isolation + RLS |
| Reconnection | Retry logic, state reconciliation | Daemon mode, auto-reconnect |
| Audit | Custom logging pipeline | Built-in audit trail |
| Time to ship | Months | Days |

## Security Model

Private Connect is designed for zero-trust environments:

- **E2E encryption**: Traffic is encrypted between client and worker using X25519 key exchange and AES-256-GCM. The hub relays opaque ciphertext.
- **No open ports**: Workers make outbound connections only. Nothing listens on public interfaces.
- **Agent tokens**: 256-bit tokens, SHA-256 hashed at rest, configurable TTL (default 30 days, max 24 hours for provisioned agents).
- **Workspace isolation**: Each customer's agents and services are scoped to their workspace. No cross-tenant access.
- **Grants**: Time-limited, scoped tokens for AI agents — auto-expire, auditable, revocable.
- **Self-hostable**: Run your own hub for full control over the relay infrastructure.

See [Security Architecture](./security.md) for the full threat model.

## FAQ

**Q: What languages can I integrate from?**
A: The TypeScript SDK works for Node.js/TypeScript tools. For Go, Rust, Python, or anything else, use the CLI as a sidecar (spawn `connect` commands) or call the HTTP API directly.

**Q: Does my users' traffic go through your servers?**
A: Traffic passes through the hub as an E2E encrypted relay — the hub forwards opaque ciphertext without inspecting or storing payload data. For full control, self-host the hub.

**Q: Can my users self-host?**
A: Yes. Private Connect is open source. Your users can run their own hub with `docker compose up`.

**Q: How does this handle multiple workers per user?**
A: Each worker exposes a uniquely named service (e.g., `worker-gpu-01`, `worker-cpu-build`). The client lists available services and reaches the one it wants by name.

**Q: What about latency?**
A: The hub is a relay, so latency is hub round-trip + worker processing. For latency-sensitive workloads, direct connections (without relay) are supported when both sides are on the same network.

**Q: Can I white-label this?**
A: Self-host the hub and point `CONNECT_HUB_URL` to your own domain. Your users never see the Private Connect brand.

**Q: How do I handle worker auth for my product's users?**
A: You manage your product's user auth (login, sessions, etc.). Private Connect handles machine-to-machine auth (agent tokens, API keys). Your backend provisions Private Connect API keys per customer workspace.

## Getting Started

```bash
# Install
npm install @privateconnect/sdk

# Or use the CLI
curl -fsSL https://privateconnect.co/install.sh | bash
```

## Related Documentation

- [TypeScript SDK Reference](../packages/sdk/README.md)
- [AI Integration (MCP, Grants, Orchestration)](./AI.md)
- [Security Architecture](./security.md)
- [API Reference](./detailed.md)
