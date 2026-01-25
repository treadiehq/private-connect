# Live Debugging

Real-time traffic inspection and AI-powered debugging for Private Connect services.

---

## Overview

Private Connect's debug mode lets you see exactly what's happening with your services in real-time. When enabled, all traffic flowing through your tunnel is captured and streamed to a web-based viewer that you can share with teammates.

**Key capabilities:**
- Real-time traffic streaming via WebSocket
- Protocol-aware parsing (HTTP, GraphQL, gRPC, databases)
- AI-powered analysis and chat
- Session sharing for pair-debugging
- Request replay for testing
- Export for offline analysis

---

## Quick Start

### Enable Debug Mode

```bash
# Expose a service with debugging enabled
connect expose localhost:3000 --debug
```

Output:
```
✓ Service exposed: my-api
✓ Debug session active

Debug viewer: https://app.privateconnect.co/debug/abc123
Share this link with teammates for live pair-debugging

Keep this running to capture traffic.
```

### With AI Copilot

```bash
# Enable both debug viewer and AI analysis
connect expose localhost:3000 --debug --ai
```

---

## Debug Viewer

The debug viewer is a web-based interface for inspecting traffic in real-time.

### Traffic List

Each captured packet shows:

| Field | Description |
|-------|-------------|
| Status | HTTP status code (color-coded) |
| Method | GET, POST, PUT, DELETE, etc. |
| Path | Request path |
| Protocol | Detected protocol (HTTP, GraphQL, gRPC, etc.) |
| Duration | Response time in milliseconds |
| Time | When the request occurred |

### Packet Details

Click any packet to expand and see:

- **Request Headers** - All HTTP headers
- **Request Body** - Parsed JSON, form data, or raw bytes
- **Response Headers** - Server response headers
- **Response Body** - Parsed response content
- **Timing** - Detailed timing breakdown

### Filtering

Filter traffic to find what you're looking for:

```
Protocol:   All | HTTP | GraphQL | gRPC | PostgreSQL | Redis | MySQL
Direction:  All | Inbound | Outbound
Search:     [free text search across path, body, headers]
```

---

## Protocol Detection

Private Connect automatically detects and parses common protocols:

### HTTP/REST

Standard HTTP requests with full header and body parsing.

```
200 OK  GET  /api/users  12ms
```

### GraphQL

Detects GraphQL by inspecting request body for `query`, `mutation`, or `subscription` keywords.

```
200 OK  POST  /graphql  Query: GetUsers  45ms
```

Shows:
- Operation type (Query/Mutation/Subscription)
- Operation name
- Variables (if present)
- Response data fields or errors

### gRPC

Detects gRPC by HTTP/2 headers and `application/grpc` content-type.

```
200 OK  POST  /grpc  UserService.GetUser  23ms
```

Shows:
- Service name
- Method name
- Request/response message content

### Database Protocols

Detects PostgreSQL, MySQL, and Redis wire protocols:

```
PostgreSQL  SELECT * FROM users WHERE id = $1  5ms
Redis       GET session:abc123  1ms
MySQL       INSERT INTO logs (...)  8ms
```

---

## AI Copilot

Get intelligent analysis of your traffic with the AI Copilot.

### Configuration

Configure your AI provider in the web UI:

1. Go to **Settings → AI Copilot**
2. Choose a provider:
   - **Ollama** - Run locally, data never leaves your machine
   - **OpenAI** - GPT-5.2, GPT-4.5, GPT-4o
   - **Anthropic** - Claude Opus 4.5, Sonnet 4, 3.5 Sonnet
3. Enter your API key (for cloud providers)
4. Save configuration

### Using the Copilot

In the debug viewer, use the AI chat panel to ask questions:

```
You: Why is the /api/checkout endpoint returning 500?

AI: Looking at the captured traffic, the 500 error on /api/checkout 
is caused by a null reference in the payment processing. The request 
body is missing the required `paymentMethodId` field. The upstream 
service at payment-gateway is returning:

  {"error": "payment_method_required", "message": "..."}

Suggested fix: Ensure the client includes paymentMethodId in the 
checkout request body.
```

### Auto-Analysis

Enable auto-analyze to get proactive insights:

- Automatically surfaces errors when 4xx/5xx responses occur
- Identifies slow queries and performance issues
- Detects common patterns like N+1 queries, auth failures

### Privacy

When using cloud AI providers:
- PII is automatically redacted before sending (emails, API keys, etc.)
- Only relevant packet data is sent, not full payloads
- For maximum privacy, use Ollama to run AI locally

---

## Session Sharing

Debug sessions are designed for collaboration.

### Sharing a Session

The debug URL is shareable by default:

```
https://app.privateconnect.co/debug/abc123
```

Anyone with the link can:
- View live traffic in real-time
- See full packet details
- Use the AI copilot (if enabled)
- Export the session

### Viewer Presence

See who else is viewing the session:
- Avatar bubbles show connected viewers
- Count displays total active viewers
- Names shown on hover

### Ending a Session

Sessions end when:
- The CLI agent stops (Ctrl+C)
- You explicitly end it via the UI
- The tunnel is deleted

---

## Request Replay

Re-send captured requests for testing and debugging.

### How to Replay

1. Find a request in the traffic list
2. Click to expand the packet details
3. Click **Replay** button
4. View the new response

### Use Cases

- **Test fixes** - Replay a failing request after deploying a fix
- **Compare responses** - See how responses differ over time
- **Load testing** - Quickly send the same request multiple times

---

## Export

Export debug sessions for offline analysis or sharing.

### Export Formats

**JSON** - Full packet data in machine-readable format:

```json
{
  "session": {
    "id": "abc123",
    "createdAt": "2026-01-24T10:30:00Z",
    "service": "my-api"
  },
  "packets": [
    {
      "id": "pkt_001",
      "direction": "inbound",
      "protocol": "http",
      "status": 200,
      "method": "GET",
      "path": "/api/users",
      "duration": 12,
      "request": { ... },
      "response": { ... }
    }
  ]
}
```

**Markdown** - Human-readable recap with summary:

```markdown
# Debug Session Recap

**Service:** my-api
**Duration:** 45 minutes
**Total Requests:** 234

## Summary
- 200 OK: 198 (85%)
- 4xx Errors: 24 (10%)
- 5xx Errors: 12 (5%)

## Notable Errors
1. POST /api/checkout - 500 Internal Server Error (12 occurrences)
2. GET /api/admin - 401 Unauthorized (8 occurrences)
...
```

### How to Export

1. Open the debug viewer
2. Click the **Export** button
3. Choose format (JSON or Markdown)
4. File downloads automatically

---

## CLI Reference

### expose with Debug

```bash
connect expose <target> [options]

Options:
  --debug              Enable debug session with live traffic viewer
  --ai                 Enable AI copilot for the debug session
  -n, --name <name>    Service name
```

### Examples

```bash
# Basic debug session
connect expose localhost:3000 --debug

# With custom name
connect expose localhost:8080 --debug --name my-api

# With AI copilot
connect expose localhost:3000 --debug --ai

# Full example
connect expose 127.0.0.1:5000 --name backend-api --debug --ai
```

---

## API Endpoints

Debug sessions can also be managed via the REST API.

### List Sessions

```bash
GET /v1/debug/sessions
```

### Get Session

```bash
GET /v1/debug/public/:token
```

### Get Packets

```bash
GET /v1/debug/public/:token/packets
```

### Export Session

```bash
GET /v1/debug/public/:token/export?format=json
GET /v1/debug/public/:token/export?format=markdown
```

### AI Chat

```bash
POST /v1/debug/public/:token/ai/chat
{
  "message": "Why is this request failing?"
}
```

---

## Best Practices

### When to Use Debug Mode

- **Development** - Always useful for seeing what's happening
- **Staging** - Debug integration issues before production
- **Pair debugging** - Share with teammates to troubleshoot together
- **Demo** - Show stakeholders real traffic patterns

### Performance Considerations

- Debug mode adds minimal overhead (~1-2ms per request)
- Packet storage is limited to session duration
- For high-traffic services, consider filtering

### Security

- Debug sessions use random tokens (not guessable)
- Sessions are scoped to your workspace
- Sensitive data in payloads should be handled carefully when sharing
- Use Ollama for AI if privacy is critical

---

## Troubleshooting

### No Packets Showing

1. Ensure the debug session is active (`--debug` flag)
2. Check that traffic is actually flowing to the service
3. Refresh the debug viewer page
4. Check browser console for WebSocket errors

### AI Not Working

1. Verify AI is configured in Settings → AI Copilot
2. Check that the provider is reachable (Test Connection button)
3. Ensure you have API credits (for cloud providers)
4. For Ollama, verify it's running (`ollama serve`)

### Session Expired

Debug sessions remain active as long as:
- The CLI agent is running
- The tunnel exists

If the session shows as expired, restart with `connect expose --debug`.
