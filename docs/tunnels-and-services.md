# Tunnels and Services Architecture

This document explains all the different tunnels and services in Private Connect and how they differ.

## Core Concepts

### Services (Database Entity)
A **Service** is the core entity stored in the database. It represents a target service you want to access.

**Key Properties:**
- `targetHost` / `targetPort` - Where the actual service runs
- `agentId` - Which agent exposes it (null for external services)
- `tunnelPort` - Local port on hub for tunnel access (null for external services)
- `isPublic` - Whether it's publicly accessible via subdomain
- `publicSubdomain` - Subdomain for public access (e.g., "abc123" → abc123.privateconnect.co)
- `isExternal` - True if target is reached directly (no agent tunnel)

**Types of Services:**
1. **Agent-Exposed Service** (`agentId` not null)
   - Exposed by an agent running on a machine
   - Has a `tunnelPort` for local tunnel access
   - Traffic flows: Client → Hub (tunnelPort) → Agent → Target

2. **External Service** (`isExternal = true`, `agentId = null`)
   - Target is reached directly from the hub
   - No `tunnelPort` (no tunnel needed)
   - Traffic flows: Client → Hub → Target (direct connection)

---

## Tunnel Services

### 1. TunnelService (`apps/api/src/tunnel/tunnel.service.ts`)
**Purpose:** Manages persistent tunnels for registered services with agents.

**What it does:**
- Creates TCP listeners on `tunnelPort` for each service
- When a client connects to `tunnelPort`, it requests the agent to dial the target
- Bridges data between client and agent through WebSocket
- Supports agent-to-agent bridges (one agent reaching another agent's service)

**Key Features:**
- Persistent (until service is deleted)
- Requires authentication (services belong to workspaces)
- Supports debug packet capture
- Emits webhooks for tunnel events

**Flow:**
```
Client connects to localhost:tunnelPort
  ↓
TunnelService creates listener
  ↓
Client → Hub → Agent → Target Service
```

**Used by:**
- Registered services exposed via `connect expose` or API
- Services with `agentId` and `tunnelPort`

---

### 2. TemporaryTunnelService (`apps/api/src/tunnel/temporary-tunnel.service.ts`)
**Purpose:** Manages temporary, unauthenticated tunnels (no signup required).

**What it does:**
- Creates short-lived tunnels that auto-expire (default 2 hours)
- Supports both HTTP and TCP tunnels
- HTTP tunnels get a random subdomain (8 hex chars)
- TCP tunnels get a dynamic port (40000-50000 range)
- No authentication required

**Key Features:**
- Temporary (auto-expires after TTL)
- No authentication required
- HTTP tunnels: `https://privateconnect.co/w/{subdomain}`
- TCP tunnels: `tcp://hub-host:{dynamic-port}`
- Supports debug packet capture

**Flow:**
```
CLI: npx private-connect tunnel 3000
  ↓
Creates temporary tunnel with subdomain
  ↓
Public requests → Hub → CLI WebSocket → localhost:3000
```

**Used by:**
- Quick tunnels via `npx private-connect tunnel`
- No signup required use cases

---

### 3. TunnelsService (`apps/api/src/tunnels/tunnels.service.ts`)
**Purpose:** High-level abstraction over ServicesService for the REST API.

**What it does:**
- Wraps ServicesService to provide a "tunnel" abstraction
- Converts Service entities to TunnelResponse DTOs
- Provides REST API endpoints for tunnel management
- Handles tunnel sharing

**Key Features:**
- REST API layer
- Tunnel sharing functionality
- Auto-generates service names from ports

**Used by:**
- REST API (`/v1/tunnels/*` endpoints)
- Web dashboard

---

## Controllers

### ProxyController (`apps/api/src/tunnel/proxy.controller.ts`)
**Purpose:** Handles public HTTP requests to services.

**What it does:**
- Routes requests from `/w/{subdomain}/*` to services
- First checks for temporary tunnels by subdomain
- Falls back to regular services by subdomain
- Forwards HTTP requests through tunnels or directly

**Flow:**
```
Public request: https://privateconnect.co/w/abc123/api
  ↓
ProxyController checks:
  1. Temporary tunnel with subdomain "abc123"?
  2. Regular service with publicSubdomain "abc123"?
  ↓
Forwards request through appropriate tunnel
```

---

## ServicesService (`apps/api/src/services/services.service.ts`)
**Purpose:** Core service management (CRUD operations).

**What it does:**
- Creates/updates/deletes services
- Allocates `tunnelPort` (23000-23999 range)
- Generates public subdomains
- Manages service status and diagnostics
- Handles both agent-exposed and external services

**Key Methods:**
- `register()` - Create/update agent-exposed service
- `registerExternal()` - Create/update external service (no agent)
- `findBySubdomain()` - Find service by public subdomain
- `setCustomSubdomain()` - Set custom subdomain for service

---

## Summary Table

| Type | Authentication | Persistence | Port/URL | Use Case |
|------|---------------|-------------|----------|----------|
| **TunnelService** | Required | Persistent | `localhost:tunnelPort` | Registered services with agents |
| **TemporaryTunnelService (HTTP)** | None | Temporary (2hr) | `https://privateconnect.co/w/{subdomain}` | Quick testing, demos |
| **TemporaryTunnelService (TCP)** | None | Temporary (2hr) | `tcp://hub:{port}` | Raw TCP connections |
| **External Service** | Required | Persistent | Direct connection | Services reachable from hub directly |
| **TunnelsService** | Required | Persistent | REST API wrapper | API/Web dashboard |

---

## Common Patterns

### Pattern 1: Agent-Exposed Service
```
User: connect expose 5432
  ↓
Agent registers service with hub
  ↓
ServicesService creates Service (agentId, tunnelPort)
  ↓
TunnelService starts listener on tunnelPort
  ↓
Client: connect prod-db
  ↓
Connects to localhost:tunnelPort
  ↓
TunnelService bridges to agent → target
```

### Pattern 2: Temporary Tunnel
```
User: npx private-connect tunnel 3000
  ↓
TemporaryTunnelController creates tunnel
  ↓
TemporaryTunnelService creates HTTP tunnel with subdomain
  ↓
CLI connects via WebSocket
  ↓
Public: https://privateconnect.co/w/abc123
  ↓
ProxyController forwards to TemporaryTunnelService
  ↓
TemporaryTunnelService forwards via WebSocket to CLI
```

### Pattern 3: Public Service
```
Service has isPublic=true, publicSubdomain="my-api"
  ↓
Public: https://privateconnect.co/w/my-api
  ↓
ProxyController finds service by subdomain
  ↓
Forwards to TunnelService (if agent-exposed)
  OR
Forwards directly (if external)
```

---

## Key Differences

1. **TunnelService vs TemporaryTunnelService:**
   - TunnelService: Authenticated, persistent, uses `tunnelPort`
   - TemporaryTunnelService: No auth, temporary, uses subdomain or dynamic port

2. **Agent-Exposed vs External Services:**
   - Agent-Exposed: Requires agent, uses tunnel, traffic goes through agent
   - External: No agent, direct connection from hub to target

3. **TunnelsService vs ServicesService:**
   - ServicesService: Low-level service CRUD
   - TunnelsService: High-level tunnel abstraction for API

4. **HTTP vs TCP Tunnels:**
   - HTTP: For web services, uses subdomain routing
   - TCP: For raw TCP (databases, etc.), uses port allocation
