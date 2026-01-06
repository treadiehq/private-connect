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
| **Payload data** | **Opaque relay** | Base64-encoded, not inspected |

### Payload Handling

When Agent A exposes a service and Agent B reaches it, data flows through the Hub as an **opaque relay**:

1. Agent B sends data as base64-encoded packets
2. Hub forwards packets to Agent A without inspection
3. Agent A decodes and forwards to the target service
4. Responses flow back the same way

The Hub does not:
- Decrypt or inspect payload contents
- Store payload data
- Log payload contents

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

### End-to-End Encryption (Future)

Currently, payload data passes through the Hub as an opaque relay. For environments requiring zero-knowledge relay, we're considering optional agent-to-agent encryption where:
- Agents negotiate keys directly
- Hub relays encrypted packets it cannot read
- Perfect forward secrecy via ephemeral keys

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

1. **Database-level**: All queries are scoped by `workspaceId`
2. **API-level**: Guards validate workspace ownership before any operation
3. **Realtime-level**: WebSocket rooms are isolated by workspace (`workspace:{id}`)
4. **Agent-level**: Agents can only access services within their workspace

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
- **Audit**: All token usage logged with IP and user-agent

### API Key Authentication

- **Format**: `pc_` prefix + 32 random characters
- **Scope**: Full workspace access
- **Revocation**: Instant via web UI or API

## Audit Logging

### What's Logged

| Event | Data Captured |
|-------|---------------|
| Agent connect/disconnect | Agent ID, IP (masked), timestamp |
| Token usage | Agent ID, IP, user-agent |
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

- Service shares support per-minute rate limits
- API endpoints should be rate-limited at the load balancer level

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
- Hub operator with database access (can see metadata, not payloads)

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

No. The Hub sees that Agent A connected to Agent B for service "prod-db", but the actual SQL queries and responses are opaque base64 packets that the Hub relays without inspection.

### Can other workspaces see my services?

No. Services are isolated to their workspace. Other workspaces cannot discover or connect to your services unless you explicitly share them.

### What happens if the Hub goes down?

Existing TCP connections through the Hub will fail. Agents will attempt to reconnect with exponential backoff. No data is lost—the Hub doesn't store payload data.

### Can I run multiple Hubs?

Currently, agents connect to a single Hub. Multi-region Hub federation is on the roadmap for high availability deployments.

### Is the agent open source?

Yes. The entire stack (agent, API, web UI) is open source under FSL-1.1-MIT license.

