# Device allowlisting

When you share an environment, you can require **device approval**: only devices you explicitly approve can join. No one with the share code can connect until you approve their device.

## Create a share with approval required

```bash
connect share --require-approval
# → Share code: abc123
```

Teammates who run `connect join abc123` will see:

```
This share requires host approval.
Ask the host to approve your device.
They can run: connect share --pending abc123
Then: connect share --approve <code> --agent <your-agent-id>
```

They stay in a pending state until you approve them.

## As the host: see pending requests

```bash
connect share --pending abc123
```

Example output:

```
  Pending join requests for abc123:

  a1b2c3d4-... (Bob's laptop)
    Requested: 3/9/2026, 2:30:00 PM
    Approve: connect share --approve abc123 --agent a1b2c3d4-...
    Deny:    connect share --deny abc123 --agent a1b2c3d4-...
```

## Approve or deny a device

**Approve** (they can join now):

```bash
connect share --approve abc123 --agent <agent-id>
```

**Deny** (removes them from pending; they cannot join unless they request again and you approve):

```bash
connect share --deny abc123 --agent <agent-id>
```

Use the `agent-id` (UUID) shown in `connect share --pending abc123`.

## List your shares (includes pending count)

```bash
connect share --list
```

If a share has `--require-approval` and there are pending join requests, you’ll see something like `2 pending approval` next to that share.

## Summary

| Who   | Action |
|-------|--------|
| Host  | `connect share --require-approval` — create share with approval required |
| Host  | `connect share --pending <code>` — list devices waiting for approval |
| Host  | `connect share --approve <code> --agent <id>` — allow a device |
| Host  | `connect share --deny <code> --agent <id>` — deny a device |
| Joiner| `connect join <code>` — request access; if not approved, they see instructions to ask the host |

Once a device is approved, it can join that share anytime until the share expires or is revoked. You don’t need to approve them again for the same share.
