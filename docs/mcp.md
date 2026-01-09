# MCP Integration

> Connect AI assistants (Cursor, Claude Desktop, etc.) to your private services.

---

## What is MCP?

Model Context Protocol (MCP) is a standard for AI tools to interact with external systems. Private Connect's MCP server lets your AI assistant:

- Access databases, APIs, and services behind firewalls
- Query data, run commands, and deploy code
- Coordinate with other agents across machines

---

## Setup

### 1. Generate configuration

```bash
connect mcp setup
```

This outputs JSON configuration for your AI tool.

### 2. Add to your AI tool

**Cursor**

1. Open Settings (Cmd/Ctrl + ,)
2. Search for "MCP"
3. Click "Add MCP Server"
4. Paste the configuration

**Claude Desktop**

Add to `~/.config/claude/mcp.json`:

```json
{
  "mcpServers": {
    "private-connect": {
      "command": "connect",
      "args": ["mcp", "serve"],
      "env": {
        "CONNECT_HUB_URL": "https://api.privateconnect.co"
      }
    }
  }
}
```

### 3. Verify

Ask your AI: "What Private Connect services are available?"

---

## Available Tools

### Service Access

| Tool | Description | Example |
|------|-------------|---------|
| `list_services` | List all services you can access | "Show me available services" |
| `reach_service` | Connect to a service | "Connect to prod-db" |
| `expose_service` | Expose a local service | "Expose my local API on port 3000" |
| `get_connection_string` | Get DATABASE_URL, REDIS_URL | "Get the connection string for prod-db" |

### Agent Orchestration

| Tool | Description | Example |
|------|-------------|---------|
| `list_agents` | List all agents | "What agents are online?" |
| `find_agents_by_capability` | Find agents by capability | "Find agents with GPU access" |
| `register_capabilities` | Register agent capabilities | "Register that I have GPU access" |
| `send_agent_message` | Message another agent | "Tell the GPU agent to start training" |
| `broadcast_message` | Broadcast to all agents | "Announce that deployment is complete" |
| `get_agent_messages` | Check inbox | "Any messages for me?" |
| `create_session` | Create ephemeral session | "Create a temp session for this task" |
| `end_session` | End session | "End the session" |

---

## Examples

### Query a database

```
User: "How many users signed up this week?"

AI: [Uses list_services to find prod-db]
    [Uses get_connection_string to get DATABASE_URL]
    [Runs query: SELECT COUNT(*) FROM users WHERE created_at > now() - interval '7 days']
    
    "423 users signed up this week."
```

### Deploy to staging

```
User: "Deploy the current branch to staging"

AI: [Uses list_agents to find staging-agent]
    [Uses send_agent_message to trigger deployment]
    
    "Deployment triggered. The staging agent will notify when complete."
```

### Access internal API

```
User: "What's the current status of the payment service?"

AI: [Uses reach_service to connect to payment-api]
    [Calls GET /health]
    
    "Payment service is healthy. Response time: 45ms."
```

### Coordinate GPU training

```
User: "Train the new model on our GPU cluster"

AI: [Uses find_agents_by_capability('gpu')]
    [Uses send_agent_message to GPU agent]
    
    "Training started on gpu-cluster-1 (NVIDIA A100). 
     Estimated time: 4 hours. I'll notify when complete."
```

---

## Broker Integration

When using MCP with the Agent Permission Broker, all AI actions are policy-checked:

```bash
# Initialize broker policy
connect broker init

# MCP server automatically respects .connect/policy.yml
```

Actions that violate policy are blocked:

```
User: "Delete all the .env files"

AI: [Uses expose_service]
    [Action blocked by broker policy]
    
    "I can't delete .env files - they're protected by your workspace policy."
```

---

## Troubleshooting

### "MCP server not found"

Make sure `connect` is in your PATH:

```bash
which connect
# Should output: /usr/local/bin/connect or similar
```

### "Authentication required"

Run `connect up` first:

```bash
connect up
# → Opens browser for auth
# → MCP will work after this
```

### "Service not reachable"

Check that the service is exposed:

```bash
connect ls
# → Lists available services
```

---

## Advanced: Custom MCP Server

For advanced use cases, run the MCP server manually:

```bash
# Start MCP server with custom options
connect mcp serve --port 9876

# With debug logging
connect mcp serve --verbose
```

---

## Related

- [AI Integration Guide](./AI.md) - Full AI documentation
- [Broker Policy](./broker.md) - Access control for AI agents
- [TypeScript SDK](../packages/sdk/README.md) - Programmatic access

