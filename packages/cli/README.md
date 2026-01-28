# Private Connect

Zero-friction connectivity tools. No signup required.

## Quick Start

```bash
# Test connectivity to any service
npx private-connect test db.internal:5432

# Create a temporary public tunnel
npx private-connect tunnel 3000
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

**Output:**
```
Private Connect - Temporary Tunnel
────────────────────────────────────

  Local:   localhost:3000
  Public:  https://privateconnect.co/w/abc12345
           Anyone can access this URL
  Inspector: https://privateconnect.co/debug/s-xyz789
           Live traffic monitoring & request replay
  Expires: 120 minutes

────────────────────────────────────

  Press Ctrl+C to stop
```

**Sharing:**
- The public URL shows your actual website (like ngrok)
- Perfect for demos, testing, and sharing with teammates
- Works immediately - no landing page, just your app

**Features:**
- No signup or account required
- Auto-expires in 2 hours
- Real-time request logging
- Works with any HTTP service
- **Shareable URLs** - The public URL shows your actual website, perfect for demos and testing

### `setup-moltbot` - One-command Moltbot setup

```bash
npx private-connect setup-moltbot
```

Quickly set up remote access to your Moltbot gateway:
- Detects Moltbot on localhost:18789
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
- `--expose-moltbot` - Expose Moltbot gateway after install

## Need more?

For permanent tunnels, sharing with teammates, and AI agent integration:

→ [privateconnect.co](https://privateconnect.co)
