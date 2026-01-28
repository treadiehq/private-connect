# exe.dev One-Click Moltbot + Private Connect Setup

Copy this prompt when creating a new VM on [exe.dev](https://exe.dev):

---

## VM Creation Prompt

```
PRIVATECONNECT_API_KEY=<your-api-key-here>

Set up Moltbot (https://docs.molt.bot/install) on this VM using non-interactive mode.
Configure nginx to forward from port 18789 to the root location on the default site,
enabling WebSocket support. exe.dev handles HTTPS for us.

Then install Private Connect and expose the Moltbot gateway:
curl -fsSL https://privateconnect.co/install.sh | bash -s -- \
  --non-interactive \
  --api-key=$PRIVATECONNECT_API_KEY \
  --daemon \
  --expose-moltbot

The final reachable URL should be https://<vm-name>.exe.xyz
```

---

## What This Does

1. **Installs Moltbot** with non-interactive setup
2. **Configures nginx** as a WebSocket-capable reverse proxy
3. **Installs Private Connect** with your API key
4. **Starts the daemon** for persistent connections
5. **Exposes the gateway** as `moltbot` for remote access

## After VM Creation

From your phone, laptop, or any other device:

```bash
# Install Private Connect (if not already)
curl -fsSL https://privateconnect.co/install.sh | bash
connect up

# Connect to your Moltbot
connect reach moltbot
```

Now `localhost:18789` tunnels to your exe.dev VM (or Mac Mini). WhatsApp, Telegram, and other chat apps
work as if Moltbot were running locally.

## Getting Your API Key

1. Go to [privateconnect.co](https://privateconnect.co)
2. Sign in or create an account
3. Navigate to Settings → API Keys
4. Create a new key and copy it

## Troubleshooting

```bash
# Check if Moltbot is running
lsof -i :18789

# Check Private Connect status
connect status

# View daemon logs
connect daemon logs

# Re-expose if needed
connect expose localhost:18789 --name moltbot
```

## Links

- [Private Connect](https://privateconnect.co)
- [Moltbot](https://molt.bot)
- [exe.dev](https://exe.dev)
