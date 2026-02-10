# Database + Cursor: 2-minute setup

Reach your local Postgres or MySQL from anywhere—and let Cursor’s AI use it—without opening ports or changing your app’s connection string.

---

## 1. Install and expose your DB

**On the machine where the database runs** (e.g. your laptop):

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

Expose the database by name:

```bash
# Postgres on localhost:5432
connect expose localhost:5432 --name my-db

# Or MySQL on localhost:3306
connect expose localhost:3306 --name my-db
```

Leave this running (or run the agent as a daemon so it stays up). Your DB stays on `127.0.0.1`; nothing is bound to `0.0.0.0`.

---

## 2. Reach it from another machine

**From a second laptop, exe.dev, Codespaces, or your phone:**

```bash
connect up   # if not already logged in
connect reach my-db
```

You’ll see something like: `Reaching my-db at localhost:5432`. From that moment, `localhost:5432` on this machine is your DB. Use it with `psql`, your app, or any client. Same host/port your code already uses.

---

## 3. Let Cursor’s AI use your DB

So the AI in Cursor can query your database (e.g. “what tables exist?”, “run this read-only query”):

**One-time MCP setup:**

```bash
connect mcp setup
```

Copy the output into Cursor: **Settings → MCP → Add server** and paste the config.

**In Cursor:**

1. On the machine that has (or can reach) the DB, run `connect reach my-db` so the DB is available at `localhost:5432`.
2. In the chat, ask: *“What Private Connect services are available?”* The AI will list them.
3. Then: *“Get the connection string for my-db”* or *“What tables are in my-db?”* The AI uses the MCP tools to reach the service and run read-only checks.

Your app keeps using `localhost:5432`; the AI uses the same endpoint via Private Connect. No open ports, no VPN.

---

## Summary

| Step | Where | Command |
|------|--------|---------|
| Install | Machine with DB | `curl -fsSL https://privateconnect.co/install.sh \| bash` then `connect up` |
| Expose DB | Machine with DB | `connect expose localhost:5432 --name my-db` |
| Reach DB | Any other machine | `connect reach my-db` |
| AI access | Cursor | `connect mcp setup` → add to Cursor MCP → ask AI to use `my-db` |

For more: [AI & MCP](AI.md), [MCP integration](mcp.md), [Tailscale + Private Connect](tailscale-and-private-connect.md).
