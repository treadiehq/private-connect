# Private Connect in Electron Apps

Embed tunnels and remote service access directly in your app — no subprocess spawning, no Tailscale dependency, no `.asar` unpacking hacks.

---

## The problem

Electron apps that need to reach services on remote machines have two common options today, and both create friction:

**Option 1: Tailscale**

The user has to install Tailscale, create an account, join a tailnet, and configure ACLs — before your app even comes into the picture. Your "Add Remote Machine" dialog ends up requiring a hostname like `100.64.1.50` or `mac-mini.local` that only works inside their tailnet. Two separate accounts, two separate setups.

**Option 2: Spawn the CLI as a subprocess**

Some apps install `private-connect` as an npm dependency and spawn it as a child process, parsing stdout for the tunnel URL. In a packaged Electron app this requires `.asar` path remapping, `ELECTRON_RUN_AS_NODE=1`, `NODE_PATH` environment overrides, and listing every transitive dependency in `asarUnpack`. Around 80 lines of plumbing for what should be a 3-line call.

**Private Connect has a programmatic Node.js API** that works as a standard import — no subprocess, no asar hacks, no user setup required.

---

## Two patterns

### Pattern A — Expose a local port publicly

Your app needs a temporary public URL pointing to a local HTTP server (for sharing, webhooks, live previews, etc.).

### Pattern B — Reach a named service on a remote machine

Your app needs to connect to a service running on another machine (a monitoring agent, a database, a dev server) without the user configuring VPN or SSH.

---

## Pattern A: Programmatic tunnel

Install the package:

```bash
npm install private-connect
```

Then in your Electron main process:

```typescript
import { createTunnel } from 'private-connect';

let tunnel: Awaited<ReturnType<typeof createTunnel>> | null = null;

async function startSharing(localPort: number): Promise<string> {
  tunnel = await createTunnel({ port: localPort });

  tunnel.on('disconnect', () => {
    // WebSocket to hub dropped — will auto-reconnect
    broadcastState({ tunnelStatus: 'reconnecting' });
  });

  tunnel.on('reconnect', () => {
    broadcastState({ tunnelStatus: 'connected', url: tunnel!.url });
  });

  tunnel.on('expire', () => {
    tunnel = null;
    broadcastState({ tunnelStatus: 'expired' });
  });

  return tunnel.url; // https://abc123.tunnel.privateconnect.co
}

async function stopSharing(): Promise<void> {
  await tunnel?.close();
  tunnel = null;
}
```

The `TunnelHandle` returned by `createTunnel` has:

| Property | Description |
|---|---|
| `url` | Public HTTPS URL for HTTP tunnels |
| `type` | `'http'`, `'tcp'`, or `'udp'` |
| `expiresAt` | ISO timestamp of tunnel expiry |
| `ttlMinutes` | TTL (default 120 minutes) |
| `tcpHost` / `tcpPort` | Public endpoint for TCP tunnels |
| `webUrl` | Browser-based DB viewer (for database ports) |

For TCP tunnels (databases, raw sockets), the mode is auto-detected from the port number or set explicitly:

```typescript
// Auto-detected as TCP (port 5432 is PostgreSQL)
const tunnel = await createTunnel({ port: 5432 });

// Explicit TCP
const tunnel = await createTunnel({ port: 8080, tcp: true });

// UDP
const tunnel = await createTunnel({ port: 27015, udp: true });
```

### No packaging headaches

Because `createTunnel()` is a standard import, there is no subprocess involved. You do not need:

- `asarUnpack` entries in `package.json`
- `ELECTRON_RUN_AS_NODE=1`
- `NODE_PATH` overrides
- `require.resolve()` path remapping

Add `private-connect` to your dependencies and import it. That is all.

---

## Pattern B: Reach a named remote service

This pattern is for connecting to a service on another machine — a monitoring agent, a remote database, a dev server — without exposing it publicly and without the user setting up Tailscale.

**On the remote machine (one-time setup):**

```bash
# Install the connect agent
curl -fsSL https://privateconnect.co/install.sh | bash

# Expose the service by name
connect expose localhost:18789 --name my-remote-agent
```

**In your Electron app:**

```bash
npm install @privateconnect/sdk
```

```typescript
import { connect } from '@privateconnect/sdk';

async function connectToRemote(serviceName: string) {
  const service = await connect(serviceName, {
    apiKey: process.env.PRIVATECONNECT_API_KEY,
  });

  console.log(service.connectionString);
  // → 'tcp://localhost:18789'
  // Use this as the host/port in your app's connection logic
}
```

The connection string is always `localhost:<port>` — the same whether the service is local or on a machine across the world. Your app code does not need to know anything about the remote machine's IP address or network setup.

### What the user experience looks like

Instead of asking the user for a tailnet hostname or IP address:

```
Hostname: mac-mini.local or 192.168.1.50  ← requires Tailscale
Username: benji
Port:     18789
```

You ask for a service name:

```
Service name: my-remote-agent              ← resolves via Private Connect
```

Or better — you discover services automatically and present a list:

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({ apiKey: process.env.PRIVATECONNECT_API_KEY });

// List all online agents that the user's account can reach
const agents = await pc.agents.list({ onlineOnly: true });

// Show agents in a dropdown — user clicks one, connection is made
```

---

## Tailscale vs Private Connect for Electron

| | Tailscale | Private Connect |
|---|---|---|
| **User must install separately** | Yes | No |
| **User must create an account** | Yes (Tailscale account) | Optional (free tunnels need no account) |
| **Programmatic Node.js API** | No | Yes — `createTunnel()`, `connect()` |
| **Works in packaged `.app`** | Yes (system daemon) | Yes — standard npm import, no asar hacks |
| **Connection string for app code** | `100.64.1.50:18789` (tailnet IP) | `localhost:18789` (always localhost) |
| **Named services** | No — IPs and hostnames only | Yes — `my-remote-agent`, `staging-db` |
| **Auto-reconnect** | System-level | Built into `TunnelHandle` events |
| **Temporary public URLs** | No | Yes — `createTunnel({ port: 3000 })` |
| **No open ports required** | Yes | Yes |

---

## Complete example: remote monitoring app

Here is what the full Electron main process integration looks like for a monitoring app (the Readout pattern):

**Remote machine setup (user does this once, or you automate it):**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect expose localhost:18789 --name $(hostname)-monitor
```

**Electron main process:**

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({
  apiKey: await keychain.get('PRIVATECONNECT_API_KEY'),
});

// Populate the "Add Remote Machine" list automatically
ipcMain.handle('list-remote-machines', async () => {
  const agents = await pc.agents.list({ onlineOnly: true });
  return agents.filter(a => a.services.some(s => s.includes('monitor')));
});

// Connect to a selected machine
ipcMain.handle('connect-to-machine', async (_event, serviceName: string) => {
  const service = await pc.connect(serviceName);
  // service.connectionString = 'tcp://localhost:18789'
  // store this and use it in your monitoring client
  return service.connectionString;
});
```

**Renderer process:**

```typescript
// Fetch available machines and populate the UI
const machines = await ipcRenderer.invoke('list-remote-machines');

// User clicks a machine
const conn = await ipcRenderer.invoke('connect-to-machine', machines[0].services[0]);
```

The user never sees an IP address, never configures Tailscale, and never touches a terminal.

---

## Reconnect handling

The `TunnelHandle` from `createTunnel()` manages WebSocket reconnection automatically (up to 10 attempts with exponential backoff). For Pattern B, the SDK's `connect()` call is stateless — just call it again if you need to reconnect.

For long-running connections in Pattern A, wire the lifecycle events into your app state:

```typescript
tunnel.on('disconnect', () => updateUI('reconnecting...'));
tunnel.on('reconnect',  () => updateUI(`connected: ${tunnel.url}`));
tunnel.on('expire',     () => { tunnel = null; updateUI('tunnel expired'); });
tunnel.on('error',      (msg) => console.error('tunnel error:', msg));
```

---

## Get started

**Pattern A (temporary public tunnel):**

```bash
npm install private-connect
```

```typescript
import { createTunnel } from 'private-connect';
const tunnel = await createTunnel({ port: 3000 });
console.log(tunnel.url); // https://abc123.tunnel.privateconnect.co
```

**Pattern B (named remote service):**

```bash
npm install @privateconnect/sdk
```

```typescript
import { connect } from '@privateconnect/sdk';
const service = await connect('my-remote-agent', { apiKey: 'pc_...' });
console.log(service.connectionString); // tcp://localhost:18789
```

**Install the agent on remote machines:**

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect expose localhost:18789 --name my-remote-agent
```

---

## See also

- [Private Connect vs ngrok](ngrok-and-private-connect.md)
- [Using Private Connect with Tailscale](tailscale-and-private-connect.md)
- [SDK reference](../packages/sdk/README.md)
- [CLI reference](../packages/cli/README.md)
