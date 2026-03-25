# Security Architecture

This document describes how Private Connect handles security, data isolation, and privacy.

## Overview

Private Connect uses a **hub-and-spoke** architecture where agents connect to a central coordination layer (the Hub). Understanding what the Hub sees—and doesn't see—is critical for evaluating the security model.

```
┌─────────────────┐                              ┌─────────────────┐
│   Agent A       │                              │   Agent B       │
│   (Exposing)    │                              │   (Reaching)    │
│                 │      ┌──────────────┐        │                 │
│  localhost:5432 │◀────▶│     Hub      │◀──────▶│  localhost:5432 │
│                 │      │              │        │                 │
└─────────────────┘      │  Metadata    │        └─────────────────┘
                         │  + Relay     │
                         └──────────────┘
```

## What the Hub Sees

| Data | Visibility | Notes |
|------|------------|-------|
| Agent identity | ✓ Visible | Agent ID, label, workspace |
| Service names | ✓ Visible | e.g., "prod-db", "redis" |
| Target host:port | ✓ Visible | e.g., "localhost:5432" |
| Connection metadata | ✓ Visible | When connections are made, duration |
| IP addresses | ✓ Visible | For audit logging (masked in logs) |
| **Payload data** | **E2E encrypted** | Encrypted with AES-256-GCM; Hub cannot read contents |

### Payload Handling

When Agent A exposes a service and Agent B reaches it, data is **end-to-end encrypted** between the agents:

1. Agents negotiate an ephemeral shared secret via X25519 ECDH through the Hub
2. Agent B encrypts data with AES-256-GCM and sends as base64-encoded ciphertext
3. Hub relays the ciphertext to Agent A without the ability to decrypt
4. Agent A decrypts and forwards plaintext to the target service
5. Responses flow back the same way (encrypted in the opposite direction)

The Hub cannot:
- Decrypt or inspect payload contents (it lacks the ephemeral session keys)
- Store meaningful payload data (only ciphertext)
- Reconstruct plaintext from captured traffic

## Encryption

### In Transit

| Connection | Encryption |
|------------|------------|
| Agent ↔ Hub | TLS 1.2+ required (enforced for non-localhost) |
| Hub ↔ Database | TLS (when using managed PostgreSQL) |
| Web UI ↔ API | HTTPS |

HTTPS enforcement can be bypassed for local development only:
```bash
CONNECT_ALLOW_INSECURE=true connect up --hub http://localhost:3001
```

### At Rest

- Database: Encryption depends on your PostgreSQL provider
- Hosted version: Uses Railway's managed PostgreSQL with encryption at rest
- Self-hosted: Configure your database provider's encryption settings

### End-to-End Encryption (Agent-to-Agent)

Agent-to-agent tunnels (`connect expose` + `connect reach`) use E2E encryption by default. The Hub relays encrypted packets it cannot read, even if compromised.

**Protocol:**

1. After the tunnel bridge is established, the reaching agent generates an ephemeral X25519 key pair and sends the public key to the exposing agent via the Hub.
2. The exposing agent generates its own ephemeral X25519 key pair, computes the shared secret via ECDH, and sends its public key back.
3. Both agents derive two directional AES-256-GCM keys using HKDF-SHA256 with the `connectionId` as salt.
4. All subsequent tunnel data is encrypted with AES-256-GCM. Each packet carries a 12-byte nonce (counter-based) and a 16-byte authentication tag.

**Properties:**
- **Zero dependencies**: Built entirely on Node.js `crypto` (X25519, AES-256-GCM, HKDF-SHA256).
- **Forward secrecy**: Ephemeral keys are generated per-connection. Compromising one connection does not compromise past or future connections.
- **Authenticated encryption**: GCM provides both confidentiality and integrity. Tampered packets are rejected.
- **Transparent fallback**: If one side doesn't support E2E (older agent), the handshake times out after 5 seconds and the connection falls back to unencrypted relay with a warning.
- **Opt-out**: Use `--no-e2e` on either `connect expose` or `connect reach` to disable.

**Scope**: E2E encryption applies to agent-to-agent TCP bridges only. Temporary public tunnels (`npx private-connect tunnel`) and browser-originated connections (e.g., browser terminal) are not E2E encrypted because the other endpoint is not a known agent.

**Limitation**: v1 protects against passive interception by the Hub. Active MITM by a fully compromised Hub (substituting public keys during the handshake) would require out-of-band identity verification, which is not yet implemented.

## Multi-Tenancy & Workspace Isolation

### Workspace Model

Every resource belongs to exactly one **workspace**:

```
Workspace
├── Agents (machines running the connect CLI)
├── Services (exposed endpoints)
├── API Keys (for programmatic access)
└── Shares (environment sharing codes)
```

### Isolation Guarantees

1. **Database-level**: PostgreSQL Row Level Security (RLS) enforces workspace isolation at the database layer. All workspace-scoped tables have RLS policies that only allow access to rows matching the current workspace context.
2. **Application-level**: All queries are additionally scoped by `workspaceId` in the application code (defense-in-depth)
3. **API-level**: Guards validate workspace ownership before any operation
4. **Realtime-level**: WebSocket rooms are isolated by workspace (`workspace:{id}`)
5. **Agent-level**: Agents can only access services within their workspace

### Who Can Access My Exposed Services?

**Only authenticated members of your workspace.** By default, exposed services are completely private.

```bash
# On your server (workspace: acme-corp)
connect up
connect expose localhost:5432 --name prod-db

# On your laptop (same workspace: acme-corp)  
connect up
connect reach prod-db          # ✓ Works

# Random person (different workspace)
connect reach prod-db          # ❌ "Service not found"
```

Outsiders cannot:
- Discover that your services exist
- List services in your workspace
- Connect to any of your services

The workspace IS the access boundary — think of it like a private Tailnet in Tailscale.

### Cross-Workspace Access

Services can be shared across workspace boundaries via:
- **Service Shares**: Token-based access with permissions (allowed paths, methods, rate limits)
- **Public Links**: Time-limited URLs with configurable restrictions

Both methods are **opt-in** and create audit logs. They can be revoked instantly.

## Hosted Version

The production Hub at `api.privateconnect.co` runs on:

| Component | Provider | Region |
|-----------|----------|--------|
| API Server | Railway | US (Oregon) |
| Database | Railway PostgreSQL | US (Oregon) |
| Web Frontend | Railway | US (Oregon) |

### Data Residency

For the hosted version:
- All data resides in US (Oregon) region
- No data replication to other regions
- For EU data residency requirements, self-host in your preferred region

## Self-Hosting

Private Connect can be fully self-hosted for:
- Data residency requirements
- Air-gapped environments
- Custom security policies
- Compliance requirements

### Quick Start

```bash
# Clone the repository
git clone https://github.com/treadiehq/private-connect.git
cd private-connect

# Start with Docker Compose
docker compose up -d

# Or run components separately
cd apps/api && pnpm install && pnpm start
cd apps/web && pnpm install && pnpm dev
```

### Configuration

Point agents to your self-hosted hub:

```bash
# Via CLI flag
connect up --hub https://hub.yourcompany.com

# Via environment variable
export CONNECT_HUB_URL=https://hub.yourcompany.com
connect up
```

### Production Checklist

- [ ] Enable TLS (required for non-localhost)
- [ ] Use managed PostgreSQL with encryption at rest
- [ ] Configure database backups
- [ ] Set up monitoring and alerting
- [ ] Review and customize token expiry settings
- [ ] Configure rate limiting at load balancer level

## Authentication & Authorization

### User Authentication

- **Passwordless**: Magic links sent via email
- **Sessions**: HTTP-only cookies with secure flags
- **Expiry**: Sessions expire after 30 days of inactivity

### Agent Authentication

- **Tokens**: 256-bit random tokens, stored as SHA-256 hashes
- **Expiry**: Tokens expire after 30 days (configurable)
- **Rotation**: `connect up --rotate-token` to rotate before expiry
- **Audit**: All token usage logged with IP, user-agent, and client type

#### Provisioned Tokens (for AI agents)

AI agent runtimes can request short-lived tokens via `POST /v1/agents/provision`:

- **Default TTL**: 2 hours (configurable: 5 min to 24 hours)
- **Client identity**: Each token is tagged with a `clientType` (`cursor`, `claude-code`, `codex`, `devin`, `github-actions`, `cli`, `sdk`, `other`)
- **Auto-generated credentials**: The API generates both `agentId` and `token` -- callers cannot reuse or supply their own
- **Audit trail**: A `PROVISIONED` event is logged at creation, and all subsequent token usage carries the `clientType` for attribution

### API Key Authentication

- **Format**: `pc_` prefix + 32 random characters
- **Scope**: Full workspace access
- **Revocation**: Instant via web UI or API

## Audit Logging

### What's Logged

| Event | Data Captured |
|-------|---------------|
| Agent connect/disconnect | Agent ID, client type, IP (masked), timestamp |
| Token provisioned | Agent ID, client type, TTL, timestamp |
| Token usage | Agent ID, client type, IP, user-agent |
| Token rotation | Agent ID, client type, new expiry |
| IP changes | Previous IP, new IP, timestamp |
| Service expose/unexpose | Service name, target, agent |
| Share creation/revocation | Share ID, creator, permissions |
| Share access | IP, path, method, status code |

### Log Security

- Sensitive data (tokens, keys) is scrubbed before logging
- IP addresses are masked in logs (`192.168.x.x`)
- Logs are structured JSON for SIEM ingestion

### Accessing Audit Logs

```bash
# View agent action audit log
connect audit

# With filters
connect audit --limit 100 --type file --action block
```

## Security Features

### Token Security

- 30-day expiry with 7-day warning
- 24-hour grace period for rotation
- IP change notifications
- Automatic rejection of expired tokens

### Log Scrubbing

Production logs automatically redact:
- API keys (`pc_...`)
- Agent tokens (64 hex characters)
- Bearer tokens
- Session cookies

### Rate Limiting

- `ThrottlerGuard` is registered as a global `APP_GUARD` with three tiers: 10/sec, 100/min, 1000/hour
- WebSocket gateways and health endpoints are exempted via `@SkipThrottle()`
- Service shares support additional per-minute rate limits

### Input Validation

- A global `ValidationPipe` enforces DTO validation on all HTTP endpoints (`whitelist`, `forbidNonWhitelisted`, `transform`)

### CORS

- WebSocket gateways use an env-driven origin allowlist (`CORS_ORIGINS`) — never `origin: '*'`
- Defaults to `https://app.privateconnect.co,https://privateconnect.co` when unset

## Threat Model

### Trusted

- The Hub operator (you, if self-hosted; us, if using hosted version)
- Workspace members with API keys

### Untrusted

- Network between agents and Hub (mitigated by TLS)
- Other workspaces (isolated by design)
- External share recipients (limited by share permissions)

### Not Protected Against

- Malicious workspace owner (they control their workspace)
- Compromised agent machine (agent has full access to its exposed services)
- Active MITM by a compromised Hub (key substitution during E2E handshake — mitigated in a future version with agent identity verification)

## Compliance

### Current State

Private Connect is designed with security in mind but does not currently hold compliance certifications.

### Self-Hosted Compliance

When self-hosting, you control:
- Data residency and jurisdiction
- Encryption configuration
- Access controls and audit policies
- Backup and retention policies

This allows you to meet your organization's compliance requirements (SOC 2, HIPAA, GDPR, etc.) through your own policies.

### Roadmap

We're evaluating:
- SOC 2 Type II certification for the hosted version
- GDPR compliance documentation
- Security questionnaire / CAIQ responses

## Reporting Security Issues

Please report security vulnerabilities to:

- **Email**: security@privateconnect.co
- **Discord**: DM a maintainer in our [Discord server](https://discord.gg/KqdBcqRk5E)

We aim to acknowledge reports within 48 hours and provide a fix timeline within 7 days.

## FAQ

### Does the Hub see my database queries?

No. Agent-to-agent tunnels are end-to-end encrypted with AES-256-GCM. The Hub sees that Agent A connected to Agent B for service "prod-db", but the actual SQL queries and responses are encrypted ciphertext that the Hub relays without the ability to decrypt.

### Can other workspaces see my services?

No. Services are isolated to their workspace. Other workspaces cannot discover or connect to your services unless you explicitly share them.

### What happens if the Hub goes down?

Existing TCP connections through the Hub will fail. Agents will attempt to reconnect with exponential backoff. No data is lost—the Hub doesn't store payload data.

### Can I run multiple Hubs?

Currently, agents connect to a single Hub. Multi-region Hub federation is on the roadmap for high availability deployments.

### Is the agent open source?

Yes. The entire stack (agent, API, web UI) is open source under FSL-1.1-MIT license.

