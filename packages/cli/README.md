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

## Need more?

For permanent tunnels, sharing with teammates, and AI agent integration:

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

→ [privateconnect.co](https://privateconnect.co)
