# Terminal from anywhere

Use Private Connect to get a **remote shell** (terminal) on your Mac or server from another machine or from a teammate—no open ports, no VPN.

## How it works

1. **Host** runs `connect shell` to expose the local SSH server (port 22) as the service `shell`.
2. **Host** runs `connect share` so the `shell` service is included in the shared environment.
3. **Joiner** runs `connect join <code>` then `connect reach shell`. They get `localhost:22` and can run `ssh localhost` (or use any SSH client).

No port 22 open on the host; traffic goes over the Private Connect tunnel.

## Host setup

```bash
# Expose SSH as "shell" (default: localhost:22)
connect shell

# Or a different port, e.g. a custom SSH or PTY server
connect shell 2222
```

Then share your environment so the joiner can reach the `shell` service:

```bash
connect share
# → Share code: abc123. Teammate runs: connect join abc123
```

Make sure Remote Login (SSH) is enabled on the host (macOS: System Settings → General → Sharing → Remote Login).

## Joiner: terminal from another machine

```bash
# Join the shared environment
connect join abc123

# Reach the host's shell service (gets localhost:22)
connect reach shell

# SSH in (use your username on the host)
ssh $(whoami)@localhost
```

## Device approval (optional)

If the host created the share with **device approval** (`connect share --require-approval`), the joiner will see "This share requires host approval." The host can then:

```bash
# See who is waiting
connect share --pending abc123

# Approve a device (use the agentId from the pending list)
connect share --approve abc123 --agent <agent-id>
```

After approval, the joiner runs `connect join abc123` again and can then `connect reach shell` and SSH as usual.

## Browser terminal

You can open a shell in the **browser** with just a share code—no CLI on the joiner side.

1. Host runs `connect shell` and `connect share` (and gives the share code to the joiner).
2. Joiner opens the browser terminal (e.g. `https://app.privateconnect.co/terminal` or your self‑hosted web app’s `/terminal`).
3. Joiner enters the share code and clicks Connect. They get a live terminal to the host’s shell.

Use this when the joiner doesn’t have the CLI installed or prefers not to use SSH.

## See also

- [Share and join](README.md) — environment sharing
<!-- - [Free tier](free-tier.md) — no-signup tunnels -->
