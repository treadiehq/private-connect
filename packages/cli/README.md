# private-connect

Test connectivity to any service. No signup required.

## Usage

```bash
npx private-connect test <target>
```

## Examples

```bash
# Test database connectivity
npx private-connect test db.internal:5432

# Test Redis
npx private-connect test redis:6379

# Test an API
npx private-connect test api.internal:8080
```

## What it checks

- DNS resolution
- TCP connection
- Port accessibility
- TLS/SSL (if applicable)
- Response time

## Output

```
Testing db.internal:5432...

✓ DNS resolved (12ms)
✓ TCP connection (45ms)
✓ Port open
✓ PostgreSQL detected

Connection successful!
```

## Need more?

For tunneling, sharing, and accessing private services:

```bash
curl -fsSL https://privateconnect.co/install.sh | bash
connect up
```

→ [privateconnect.co](https://privateconnect.co)

