# Agent Permission Broker

> ⚠️ **Experimental Feature**: AI agent governance is an emerging space. This feature is forward-looking and may change significantly.

Control what AI coding assistants can do in your workspace.

## Overview

The Agent Permission Broker provides policy-based access control for AI agents operating in your codebase. It evaluates file writes, commands, and git operations against configurable rules before allowing execution.

**Use cases:**
- Prevent AI agents from modifying secrets, CI/CD configs, or sensitive files
- Require human review for certain operations
- Audit all agent actions for security review

## Quick Start

```bash
# Initialize in your project (creates .connect/policy.yml)
connect broker init

# Run any CLI-based AI agent through the broker  
connect broker run -- claude      # Anthropic Claude Code CLI
connect broker run -- aider       # Aider
connect broker run -- opencode    # OpenCode

# View what agents tried to do
connect audit
```

## How It Works

1. **Policy file** (`.connect/policy.yml`) defines allow/block/review rules
2. AI agent actions are evaluated against rules before execution
3. Audit log records every action for security review

> **Note:** `connect broker run -- aider` executes `aider` on your machine—install the tool first. For GUI apps like Cursor, use MCP: `connect mcp setup`

## Default Policy

When you run `connect broker init`, the following protections are applied:

| Target | Action | Why |
|--------|--------|-----|
| Source code (`src/**`, `*.ts`, `*.py`) | allow | Safe for agents to modify |
| Config files (`*.json`, `*.yml`) | review | Prompt before changes |
| Secrets (`.env`, `*.key`) | block | Never allow agent access |
| CI/CD (`.github/workflows/**`) | block | Can run arbitrary code |
| Destructive commands (`rm -rf *`) | block | Prevent accidents |

## Policy Configuration

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
  - path: ".github/workflows/**"
    action: block
    reason: "CI/CD can run arbitrary code"
  - command: "rm -rf *"
    action: block
```

### Rule Types

**File rules** - Control writes to specific paths:
```yaml
- path: "src/**"
  action: allow

- path: "*.key"
  action: block
  reason: "Private keys should never be modified by agents"
```

**Command rules** - Control shell command execution:
```yaml
- command: "rm -rf *"
  action: block

- command: "npm publish"
  action: review
  reason: "Publishing requires human approval"
```

**Git rules** - Control git operations:
```yaml
- git: "force-push"
  action: block
  reason: "Force pushes can destroy history"
```

### Actions

| Action | Behavior |
|--------|----------|
| `allow` | Permit silently |
| `block` | Deny with message |
| `review` | Prompt user for approval |

## Git Hooks

Install pre-commit and pre-push hooks to enforce policy on git operations:

```bash
connect broker hooks           # Install hooks
connect broker hooks --uninstall  # Remove hooks
```

## Audit Log

View all agent actions:

```bash
connect audit                  # Recent actions
connect audit --stats          # Statistics
connect audit --limit 100      # More entries
connect audit --type file      # Filter by type
connect audit --action block   # Filter by action
```

## CLI Reference

```bash
connect broker init            # Initialize policy in workspace
connect broker status          # Check policy and hooks
connect broker run -- <cmd>    # Run command through broker
connect broker hooks           # Install git hooks
connect broker hooks --uninstall  # Remove git hooks
connect audit                  # View audit log
connect audit --stats          # View statistics
```

### Options

```bash
# Global broker options
--observe              # Log but don't enforce (dry run)
--working-dir <path>   # Working directory
--agent <name>         # Agent identifier for audit log

# Audit options
--limit <n>            # Number of entries (default: 50)
--type <type>          # Filter: file, command, git
--action <action>      # Filter: allow, block, review
--stats                # Show statistics instead of log
```

## Integration with AI Tools

### CLI-based agents (Aider, Claude Code, etc.)

```bash
connect broker run -- aider
connect broker run -- claude
```

### GUI-based agents (Cursor, etc.)

Use MCP integration:

```bash
connect mcp setup
```

The MCP server communicates with the broker to enforce policy.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `CONNECT_BROKER` | Set to `1` when running under broker |
| `CONNECT_AGENT` | Agent identifier |
| `CONNECT_OBSERVE` | Set to `1` for observe-only mode |
| `CONNECT_AUTO_APPROVE` | Set to `1` to auto-approve reviews |
| `CONNECT_AUTO_DENY` | Set to `1` to auto-deny reviews |

## Feedback

This is an experimental feature. We'd love to hear how you're using it and what's missing.

- [Discord](https://discord.gg/KqdBcqRk5E)
- [GitHub Issues](https://github.com/treadiehq/private-connect/issues)

