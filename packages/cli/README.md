# Private Connect

Zero-friction connectivity tools. No signup required.

## Installation

```bash
npm i private-connect          # add to your project
npm i -g private-connect       # install globally
```

**Run it:** after a global install use `private-connect`; after a local install use `npx private-connect`. Or run without installing: `npx private-connect <command>`.

## Quick Start

```bash
# Test connectivity to any service
npx private-connect test db.internal:5432

# Create a temporary public tunnel
npx private-connect tunnel 3000

# Test webhooks locally (Polar, Stripe, GitHub, or any provider)
npx private-connect polar 3000
npx private-connect stripe 3000
```

## Commands

### `test` - Test connectivity

```bash
npx private-connect test <target>
```

**Examples:**
```bash
npx private-connect test db.internal:5432      # Database
npx private-connect test redis:6379            # Redis
npx private-connect test https://api.internal  # API
```

**What it checks:**
- TCP connection
- TLS/SSL (if applicable)
- HTTP response (for web services)
- Latency

### `tunnel` - Create a temporary tunnel

```bash
npx private-connect tunnel <port>
```

Instantly expose a local service to the internet. No signup required.

**Examples:**
```bash
npx private-connect tunnel 3000              # Expose localhost:3000
npx private-connect tunnel localhost:8080    # Specify host and port
```

**Named subdomains:** When you use a provider or app name, it becomes the subdomain prefix:

```bash
npx private-connect stripe 3000    # → https://stripe-a1b2.privateconnect.co
npx private-connect myapp 3000     # → https://myapp-f3d9.privateconnect.co
npx private-connect tunnel 3000    # → https://abc12345.privateconnect.co (random)
```

**Output:**
```
Private Connect - Temporary Tunnel
────────────────────────────────────

  Local:   localhost:3000
  Public:  https://stripe-a1b2.privateconnect.co
           Anyone can access this URL
  Inspector: https://privateconnect.co/debug/s-xyz789
           Live traffic monitoring & request replay
  Expires: 120 minutes

────────────────────────────────────

  Press Ctrl+C to stop
```

**TCP/UDP Tunnels:**
```bash
npx private-connect tunnel 5432 --tcp    # TCP tunnel (databases, etc.)
npx private-connect tunnel 27015 --udp   # UDP tunnel (game servers, etc.)
```

TCP/UDP output shows connection details:
```
  Local:   localhost:5432
  Public:  tcp://api.privateconnect.co:40001
  Connect: api.privateconnect.co:40001
  Expires: 120 minutes
```

**Sharing:**
- The public URL shows your actual website (like ngrok)
- Perfect for demos, testing, and sharing with teammates
- Works immediately - no landing page, just your app

**Features:**
- No signup or account required
- Auto-expires in 2 hours
- Real-time request logging
- Works with HTTP, TCP, and UDP services
- **Shareable URLs** - The public URL shows your actual website, perfect for demos and testing

### `<provider> <port>` - Webhook tunnel with provider setup

```bash
npx private-connect <provider> <port>
```

Create a tunnel and get provider-specific webhook setup instructions.

**Known providers** (with tailored instructions):
- `polar` — [Polar](https://polar.sh) webhooks
- `stripe` — [Stripe](https://stripe.com) webhooks
- `github` — [GitHub](https://github.com) webhooks
- `shopify` — [Shopify](https://shopify.dev) webhooks

**Any provider name works** — unknown names get generic webhook guidance.

**Examples:**
```bash
npx private-connect polar 3000              # Polar webhooks → localhost:3000
npx private-connect stripe 3000             # Stripe webhooks → localhost:3000
npx private-connect github 8080             # GitHub webhooks → localhost:8080
npx private-connect myapp 3000              # Generic webhooks → localhost:3000
```

### `setup-openclaw` - One-command OpenClaw setup

```bash
npx private-connect setup-openclaw
```

Quickly set up remote access to your OpenClaw (formerly Moltbot) gateway:
- Detects OpenClaw on localhost:18789
- Creates temporary tunnel for remote access
- Shows next steps for permanent setup

### `pair` - Mobile pairing

```bash
npx private-connect pair
```

Generate a QR code to pair your mobile device for remote access.

### `list` - List active tunnels

```bash
npx private-connect list
```

### `close` - Close tunnels

```bash
npx private-connect close <tunnelId>
npx private-connect close --all
```

## How Temporary Tunnels Work

```
┌──────────────┐        WebSocket        ┌─────────────────────┐        HTTPS        ┌─────────┐
│  Your Machine│◄───────────────────────►│  privateconnect.co  │◄────────────────────│ Internet│
│              │  (persistent connection) │  (Hub)              │  (TLS termination)  │         │
│  localhost:N │                          │                     │                     │         │
└──────────────┘                          └─────────────────────┘                     └─────────┘
```

1. You run `npx private-connect tunnel 3000`.
2. The CLI opens a WebSocket to the hub (`api.privateconnect.co`).
3. The hub assigns a public subdomain (e.g. `abc12345.privateconnect.co`) and handles TLS.
4. When a request arrives at the public URL, the hub forwards it over the WebSocket to your CLI.
5. Your CLI forwards it to `localhost:3000` and sends the response back.

**Key properties:**
- **No open ports** — Your machine only makes outbound connections (WebSocket).
- **Auto-reconnect** — If the connection drops, the CLI reconnects automatically (up to 10 retries with backoff).
- **No signup** — Tunnels are ephemeral (2-hour TTL). No account required.
- **End-to-end** — Request bodies are forwarded in-memory over the WebSocket; nothing is stored on disk.
- **TCP/UDP** — For `--tcp` and `--udp` tunnels, the hub allocates a public port and relays raw packets the same way.

## Installation Options

### Quick (npx)

```bash
npx private-connect tunnel 3000
```

### Full Install (with daemon)

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

### Automated/Non-interactive

```bash
# For scripts, CI/CD, or VM provisioning
curl -fsSL https://privateconnect.co/install.sh | bash -s -- \
  --non-interactive \
  --api-key=YOUR_KEY \
  --daemon
```

Options:
- `--non-interactive` - Skip all prompts
- `--api-key=KEY` - Set API key for authentication
- `--daemon` - Install and start background service
- `--expose-openclaw` - Expose OpenClaw gateway after install

## Need more?

For permanent tunnels, sharing with teammates, and AI agent integration:

→ [privateconnect.co](https://privateconnect.co)
