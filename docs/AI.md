# Private Connect for AI

> Build AI agents that securely access private services, orchestrate multi-machine workflows, and collaborate with each other.

---

## Overview

Private Connect provides three layers of AI integration:

| Layer | What it does | Use case |
|-------|--------------|----------|
| **MCP** | AI tools can access services | Claude/Cursor connecting to your database |
| **Broker** | Policy-based access control | Prevent AI from modifying secrets |
| **Orchestration** | Agent-to-agent coordination | Distributed AI workflows across machines |

---

## Quick Start

```bash
# Set up MCP for your AI tool (Cursor, Claude Desktop)
connect mcp setup

# Initialize broker policy in your project
connect broker init

# List available agents for orchestration
connect agents
```

---

## MCP Integration

Model Context Protocol (MCP) lets AI assistants interact with your Private Connect services.

### Setup

```bash
connect mcp setup
```

This outputs configuration for your AI tool. Add it to:

- **Cursor**: Settings → MCP → Add server
- **Claude Desktop**: `~/.config/claude/mcp.json`

### Available Tools

Once connected, AI agents can use these tools:

#### Service Access

| Tool | Description |
|------|-------------|
| `list_services` | List all available services |
| `reach_service` | Connect to a service |
| `get_connection_string` | Get DATABASE_URL, REDIS_URL, etc. |
| `expose_service` | Expose a local service |

#### Agent Orchestration

| Tool | Description |
|------|-------------|
| `list_agents` | List all agents in workspace |
| `find_agents_by_capability` | Find agents with specific capabilities |
| `register_capabilities` | Register what this agent can do |
| `send_agent_message` | Send message to another agent |
| `broadcast_message` | Broadcast to all agents |
| `get_agent_messages` | Check inbox for messages |
| `create_session` | Create ephemeral session |
| `end_session` | End ephemeral session |

### Example: AI accessing your database

```
User: "What tables are in our production database?"

AI: [Uses get_connection_string for prod-db]
    [Connects via DATABASE_URL]
    [Lists tables and returns answer]
```

---

## Agent Permission Broker

Control what AI agents can do in your codebase.

### Quick Start

```bash
# Initialize policy
connect broker init

# Run AI agent through broker
connect broker run -- aider
connect broker run -- claude
```

### Default Protections

| Target | Action | Why |
|--------|--------|-----|
| Source code (`src/**`) | allow | Safe for agents to modify |
| Config files (`*.json`) | review | Prompt before changes |
| Secrets (`.env`, `*.key`) | block | Never allow agent access |
| CI/CD workflows | block | Can run arbitrary code |

### Policy File

```yaml
# .connect/policy.yml
version: 1
default: review

rules:
  - path: "src/**"
    action: allow
  - path: ".env*"
    action: block
    reason: "Environment files contain secrets"
  - command: "rm -rf *"
    action: block
```

→ Full documentation: [broker.md](./broker.md)

---

## Agent Orchestration

Coordinate multiple agents across different machines.

### Use Cases

- **Distributed training**: GPU agent + data agent + monitoring agent
- **Multi-environment workflows**: Dev agent + staging agent + prod agent
- **Collaborative AI**: Multiple AI assistants working together

### Agent Discovery

```bash
# List all agents
connect agents

# Find agents with specific capability
connect agents --capability gpu
connect agents --capability database
```

### Capabilities

Register what your agent can do:

```bash
# Via CLI
connect capabilities register gpu "NVIDIA A100, 80GB"
connect capabilities register database "PostgreSQL 15"

# Via MCP (AI can do this)
register_capabilities({ capabilities: ["gpu", "database"] })
```

Find agents by capability:

```bash
connect agents --capability gpu
# → agent-gpu-cluster-1 (gpu: NVIDIA A100)
# → agent-gpu-cluster-2 (gpu: NVIDIA H100)
```

### Agent Messaging

Agents can communicate directly:

```typescript
// Send to specific agent
await sdk.agents.sendMessage(targetAgentId, {
  type: "request",
  action: "run_training",
  params: { model: "llama-3", epochs: 10 }
});

// Broadcast to all agents
await sdk.agents.broadcast({
  type: "announcement",
  message: "Training complete, model available"
});

// Check inbox
const messages = await sdk.agents.getMessages();
```

### Ephemeral Sessions

Create temporary contexts for short-lived workflows:

```typescript
// Create session
const session = await sdk.agents.createSession({
  ttl: "1h",
  metadata: { task: "data-preprocessing" }
});

// Use session for work...

// End session
await sdk.agents.endSession(session.id);
```

### Agent Provisioning API

AI agent runtimes (Cursor cloud agents, Claude Code, Codex, Devin, GitHub Actions, etc.) can programmatically obtain short-lived agent tokens without the interactive device authorization flow.

```bash
curl -X POST https://api.privateconnect.co/v1/agents/provision \
  -H "x-api-key: pc_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "clientType": "cursor",
    "label": "staging",
    "ttlSeconds": 7200
  }'
```

**Response:**

```json
{
  "agentId": "550e8400-e29b-41d4-a716-446655440000",
  "token": "a1b2c3d4e5f6...",
  "expiresAt": "2026-02-24T18:00:00.000Z",
  "workspaceId": "ws-uuid",
  "workspaceName": "my-workspace"
}
```

The token auto-expires after the requested TTL (default: 2 hours, max: 24 hours). Every audit event is tagged with the `clientType`, so you can see exactly which tool accessed which service and when.

**Supported client types:** `cursor`, `claude-code`, `codex`, `devin`, `github-actions`, `cli`, `sdk`, `other`

---

## TypeScript SDK

Programmatic access to Private Connect.

### Installation

```bash
npm install @privateconnect/sdk
```

### Usage

```typescript
import { PrivateConnect } from '@privateconnect/sdk';

const pc = new PrivateConnect({
  apiKey: process.env.PRIVATECONNECT_API_KEY,
  hubUrl: 'https://api.privateconnect.co'
});

// List services
const services = await pc.services.list();

// Get connection string
const dbUrl = await pc.services.getConnectionString('prod-db');

// List agents
const agents = await pc.agents.list();

// Send message between agents
await pc.agents.sendMessage(targetAgentId, {
  type: 'request',
  payload: { action: 'process_data' }
});

// Find agents with GPU
const gpuAgents = await pc.agents.findByCapability('gpu');
```

---

## Connection Strings

AI agents often need connection strings (DATABASE_URL, REDIS_URL, etc.).

### Get Connection String

```bash
# CLI
connect connection-string prod-db
# → postgresql://user:pass@localhost:5432/mydb

# MCP Tool
get_connection_string({ service: "prod-db" })

# SDK
const url = await pc.services.getConnectionString("prod-db");
```

### Supported Formats

| Service Type | Environment Variable |
|--------------|---------------------|
| PostgreSQL | `DATABASE_URL` |
| MySQL | `DATABASE_URL` |
| Redis | `REDIS_URL` |
| MongoDB | `MONGODB_URI` |
| HTTP API | `API_URL` |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                      AI Assistant                        │
│                  (Cursor, Claude, etc.)                  │
└─────────────────────┬───────────────────────────────────┘
                      │ MCP Protocol
                      ▼
┌─────────────────────────────────────────────────────────┐
│                    MCP Server                            │
│              (connect mcp serve)                         │
│  ┌─────────────┬─────────────┬─────────────────────┐    │
│  │   Services  │   Broker    │   Orchestration     │    │
│  │   Access    │   Policy    │   (Agent Comms)     │    │
│  └─────────────┴─────────────┴─────────────────────┘    │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  Private Connect Hub                     │
│         (Coordination, Auth, Service Discovery)         │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────┼─────────────┐
        ▼             ▼             ▼
   ┌─────────┐   ┌─────────┐   ┌─────────┐
   │ Agent 1 │   │ Agent 2 │   │ Agent 3 │
   │ (GPU)   │   │ (DB)    │   │ (API)   │
   └─────────┘   └─────────┘   └─────────┘
```

---

## Examples

### AI-Powered Data Pipeline

```typescript
// Orchestrator agent coordinates the pipeline
const dataAgent = await pc.agents.findByCapability('data-source');
const gpuAgent = await pc.agents.findByCapability('gpu');
const storageAgent = await pc.agents.findByCapability('storage');

// Step 1: Fetch data
await pc.agents.sendMessage(dataAgent[0].id, {
  type: 'request',
  action: 'fetch_dataset',
  params: { dataset: 'training-v2' }
});

// Step 2: Process on GPU
await pc.agents.sendMessage(gpuAgent[0].id, {
  type: 'request',
  action: 'run_training',
  correlationId: 'pipeline-123'
});

// Step 3: Store results
await pc.agents.sendMessage(storageAgent[0].id, {
  type: 'request',
  action: 'save_model',
  correlationId: 'pipeline-123'
});
```

### Multi-Agent Code Review

```typescript
// AI assistants on different machines collaborate
await pc.agents.broadcast({
  type: 'review_request',
  repo: 'my-project',
  pr: 42,
  files: ['src/auth.ts', 'src/db.ts']
});

// Each agent reviews their area of expertise
// Responses collected via messages
const reviews = await pc.agents.getMessages({
  correlationId: 'pr-42-review'
});
```

---

## CLI Reference

```bash
# MCP
connect mcp setup              # Output MCP config
connect mcp serve              # Start MCP server

# Broker
connect broker init            # Initialize policy
connect broker run -- <cmd>    # Run command through broker
connect broker status          # Check policy status
connect audit                  # View audit log

# Agents
connect agents                 # List agents
connect agents --capability X  # Filter by capability

# Capabilities
connect capabilities register <name> [metadata]
connect capabilities list

# Connection Strings
connect connection-string <service>
```

---

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PRIVATECONNECT_API_KEY` | API key for SDK/programmatic access |
| `CONNECT_HUB_URL` | Hub URL (default: https://api.privateconnect.co) |
| `CONNECT_BROKER` | Set when running under broker |
| `CONNECT_AGENT` | Agent identifier |
| `CONNECT_AUTO_APPROVE` | Auto-approve broker reviews |

---

## Related Documentation

- [Broker Policy Reference](./broker.md)
- [AI Teams Guide](./ai-teams.md)
- [Security Model](./security.md)
- [SDK README](../packages/sdk/README.md)

