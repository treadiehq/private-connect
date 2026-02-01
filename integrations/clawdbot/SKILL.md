---
name: private-connect
description: Secure remote access to Clawdbot gateway access private services by name. No VPN or SSH tunnels.
homepage: https://privateconnect.co
repository: https://github.com/treadiehq/private-connect
author: Treadie
gating:
  binary: connect
---

# Private Connect

**Secure remote access to your Clawdbot gateway**, plus access to private services by name. No VPN or SSH tunnels needed.

## What it does

1. **Remote Clawdbot Access**: Access your Clawdbot gateway from anywhere (phone, laptop) while it runs on a VPS or Mac Mini — without exposing it publicly.

2. **Private Service Access**: Reach private infrastructure (databases, APIs, GPU clusters) using simple names instead of IPs and ports.

## Commands

### connect_expose_gateway
Expose your Clawdbot gateway (localhost:18789) for secure remote access.

**Examples:**
- "Expose my Clawdbot for remote access"
- "Set up remote access to this gateway"
- "Make my Clawdbot accessible from my phone"

### connect_reach_gateway
Connect to a remote Clawdbot gateway from your current device.

**Examples:**
- "Connect to my Clawdbot server"
- "Reach my remote Clawdbot"
- "Access my VPS Clawdbot"

### connect_reach
Connect to a private service by name.

**Examples:**
- "Connect me to the staging database"
- "Reach the prod API"
- "Connect to jupyter-gpu"

### connect_status
Show available services and their connection status.

**Examples:**
- "What services are available?"
- "Show my connected services"
- "Is the staging database online?"

### connect_share
Share your current environment with a teammate.

**Examples:**
- "Share my environment"
- "Create a share link that expires in 7 days"
- "Share my setup with the team for a week"

### connect_join
Join a shared environment from a teammate.

**Examples:**
- "Join share code x7k9m2"
- "Connect to Bob's environment"

### connect_clone
Clone a teammate's entire environment setup.

**Examples:**
- "Clone Alice's environment"
- "Set up my environment like the senior dev"

### connect_list_shares
List active environment shares.

**Examples:**
- "Show my active shares"
- "What environments am I sharing?"

### connect_revoke
Revoke a shared environment.

**Examples:**
- "Revoke share x7k9m2"
- "Stop sharing with the contractor"

## Setup

1. Install Private Connect:
```bash
curl -fsSL https://privateconnect.co/install.sh | bash
```

2. Authenticate:
```bash
connect up
```

3. The skill will use your authenticated session.

## Requirements

- Private Connect CLI installed and authenticated
- `connect` command available in PATH

