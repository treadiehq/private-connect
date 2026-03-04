# Security Best Practices Report — Private Connect

**Generated:** 2026-03-04  
**Stack:** NestJS (Node.js/TypeScript) · PostgreSQL (Prisma/RLS) · Nuxt 3 (Vue 3) · pnpm monorepo  
**Scope:** `apps/api`, `apps/web`, `docker-compose.yml`, `apps/agent`

---

## Executive Summary

The core architecture is thoughtful — Row-Level Security tenant isolation, passwordless magic-link auth with optimistic replay protection, per-key IP allowlisting, and a `SecureLogger` all demonstrate intentional security design. However, several findings undermine that foundation. The most urgent issue is **API keys stored as plaintext in the database** while agent tokens (in the same codebase) are correctly hashed — the inconsistency is the tell. Combined with a workspace API key being written to `localStorage` (XSS-stealable), a mismatch in how `X-Forwarded-For` is extracted between guards (IP spoofing window), a third-party analytics script without Subresource Integrity, and weak Docker credentials, the project needs meaningful security work before being considered production-hardened.

There is no single catastrophic finding, but the combination of **S-001** (plaintext API keys) and **S-004** (localStorage API key) in particular forms a dangerous pair: steal the key via XSS, use it directly without needing to crack a hash.

---

## Critical

### S-001 — API Keys Stored Plaintext in the Database

- **Rule ID:** S-001
- **Severity:** Critical
- **Location:**
  - `apps/api/prisma/schema.prisma` line 82: `key  String  @unique`
  - `apps/api/src/api-keys/api-keys.service.ts` line 18: key generation
  - `apps/api/src/auth/api-key.guard.ts` line ~85: `prisma.apiKey.findUnique({ where: { key: apiKey } })`
- **Evidence:**
  ```typescript
  // schema.prisma – key column is plaintext
  key  String  @unique

  // api-key.guard.ts – lookup by raw value
  await this.prisma.withoutRls().apiKey.findUnique({ where: { key: apiKey } })
  ```
  Compare with agent tokens in `apps/api/src/agents/agents.service.ts` lines 55–57, which **are** SHA-256 hashed:
  ```typescript
  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
  ```
- **Impact:** If the database is compromised (SQL injection, backup leak, insider access), every API key is immediately usable by an attacker with zero cracking effort. The inconsistency with agent tokens shows hashing was understood and deliberately applied in one place but not the other.
- **Fix:** Store a SHA-256 (or better, HMAC-SHA256) hash of the key. Return the raw key only at creation time (already done). On each request, hash the incoming value and compare against the stored hash. Update the Prisma schema to rename the column (e.g. `keyHash`) and run a migration to hash all existing keys.
- **Mitigation (immediate):** Rotate all existing API keys. This forces re-issuance and eliminates exposure of the current plaintext set even before a code fix is deployed.

---

## High

### S-002 — `aiApiKey` Described as "Encrypted" But Stored/Retrieved in Plaintext

- **Rule ID:** S-002
- **Severity:** High
- **Location:**
  - `apps/api/prisma/schema.prisma` line 66: `aiApiKey  String?  // Encrypted API key for cloud providers`
  - `apps/api/src/ai/ai.service.ts` lines ~82–84: key stored and retrieved without any encryption layer
- **Evidence:**
  ```prisma
  aiApiKey  String?  // Encrypted API key for cloud providers
  ```
  The comment says "Encrypted" but the service reads and writes the value directly with no cipher/decrypt call visible in the code path.
- **Impact:** Third-party AI provider keys (OpenAI, Anthropic, etc.) stored by users are exposed in plaintext. A DB compromise leaks credentials that can generate large provider bills and access sensitive model interactions.
- **Fix:** Implement application-level encryption (e.g., AES-256-GCM with a master key stored in an environment variable / secret manager). Encrypt before write, decrypt after read. Update the schema comment to reflect reality. Alternatively, remove the aspirational comment and clearly document that field-level encryption is not yet implemented.

### ~~S-003 — X-Forwarded-For Extraction Inconsistency~~ *(Retracted)*

This finding was incorrect. `api-key.guard.ts` line 82 uses `request.ip` as its primary IP source, only falling back to manual XFF parsing if `request.ip` is absent. Since `trust proxy = 1` is configured in `main.ts`, Express populates `request.ip` correctly from the XFF header in all normal production conditions. The fallback path is essentially unreachable in practice. IP allowlist enforcement is correct.

### S-004 — Workspace API Key Written to `localStorage` (XSS-Stealable)

- **Rule ID:** S-004
- **Severity:** High
- **Location:**
  - `apps/web/composables/useAuth.ts` lines 86–88
- **Evidence:**
  ```typescript
  // Also store API key in localStorage for backward compatibility
  if (data.workspace?.apiKey) {
    localStorage.setItem('privateconnect_apikey', data.workspace.apiKey);
  }
  ```
- **Impact:** Any JavaScript executing on the page — including injected via XSS — can read `localStorage` and steal the workspace API key. Because API keys are stored plaintext (S-001), the stolen value is immediately usable. This is especially dangerous combined with S-001.
- **Fix:** Remove the `localStorage` fallback. Session cookies are already used for web auth; the API key is a CLI credential that should not be needed by the browser session. If certain pages legitimately need the API key displayed (e.g., a settings page), fetch it on-demand from the API with an authenticated session rather than persisting it in storage.
- **Mitigation:** At minimum add a comment explaining the known risk and file a tracked issue. If backward compat truly requires it, store only in `sessionStorage` (cleared on tab close) and ensure a strong CSP is deployed.

---

## Medium

### S-005 — Static PostgreSQL Credentials in `docker-compose.yml`

- **Rule ID:** S-005
- **Severity:** Medium (Low in isolated dev, Medium if the file is used as a basis for any production deployment)
- **Location:**
  - `docker-compose.yml` lines 9–11 and line 28
- **Evidence:**
  ```yaml
  POSTGRES_USER: privateconnect
  POSTGRES_PASSWORD: privateconnect
  POSTGRES_DB: privateconnect
  # ...
  DATABASE_URL=postgresql://privateconnect:privateconnect@postgres:5432/privateconnect
  ```
  Username and password are identical, the value is the product name, and it is committed to version control.
- **Impact:** If this compose file is deployed as-is (common for "just spin it up" self-hosting), the database uses a trivially guessable credential. Anyone who can reach the Postgres port — or any future developer who sees the repo — knows the credentials.
- **Fix:** Switch to environment variable substitution in the compose file:
  ```yaml
  POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
  ```
  Document in the README that operators must supply a strong password. Provide a `.env.example` for the compose file with a placeholder.

### ~~S-006 — Session Cookie Missing `SameSite` / `Secure`~~ *(Retracted)*

Verified in `apps/api/src/auth/auth.controller.ts` lines 125–131. The cookie is already correctly set:
```typescript
res.cookie('session', result.sessionToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000,
  path: '/',
});
```
All required attributes are present and correctly conditioned on `NODE_ENV`.

### S-007 — Third-Party Analytics Script Without Subresource Integrity (SRI)

- **Rule ID:** S-007
- **Severity:** Medium
- **Location:**
  - `apps/web/nuxt.config.ts` line 63
- **Evidence:**
  ```typescript
  { src: 'https://cdn.seline.com/seline.js', async: true, 'data-token': 'd5fd31a3538303d' },
  ```
  No `integrity` attribute is present.
- **Impact:** Third-party JS runs with full first-party origin privileges. If `cdn.seline.com` is compromised, an attacker's script runs on every page of the app — able to steal session cookies, API keys from `localStorage`, and keylog all user input.
- **Fix:** Generate an SRI hash for the pinned version of `seline.js` and add it:
  ```typescript
  { 
    src: 'https://cdn.seline.com/seline.js', 
    async: true, 
    'data-token': 'd5fd31a3538303d',
    integrity: 'sha384-<hash-of-pinned-version>',
    crossorigin: 'anonymous',
  }
  ```
  If Seline rotates the file without versioned URLs, consider self-hosting or proxying it.

### S-008 — `trust proxy` Set to `1` But `X-Forwarded-Proto` Used Directly in a Redirect

- **Rule ID:** S-008
- **Severity:** Medium
- **Location:**
  - `apps/api/src/main.ts` line 77
- **Evidence:**
  ```typescript
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  return res.redirect(301, `${protocol}://${baseDomain}${req.originalUrl || req.url}`);
  ```
  This reads the raw `x-forwarded-proto` header directly rather than `req.protocol` (which respects `trust proxy`). An attacker can send `X-Forwarded-Proto: javascript` and trigger a redirect to `javascript://...` — or more practically, `http://` to downgrade the redirect.
- **Impact:** Protocol injection in the redirect. In the worst case (depending on browser handling) this can be abused to redirect victims to non-HTTPS URLs or unexpected schemes.
- **Fix:** Replace with:
  ```typescript
  const protocol = req.protocol; // respects trust proxy setting
  return res.redirect(301, `${protocol}://${baseDomain}${req.originalUrl || req.url}`);
  ```

---

## Low

### S-009 — Swagger UI Exposed with `unsafe-inline` and `unsafe-eval` CSP in Production

- **Rule ID:** S-009
- **Severity:** Low
- **Location:**
  - `apps/api/src/main.ts` lines 126–130
- **Evidence:**
  ```typescript
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ..."
  );
  ```
- **Impact:** `/docs` is a significant XSS attack surface because Swagger UI renders user-influenced strings (API descriptions, example values). The relaxed CSP removes the primary browser defense against XSS at that route.
- **Fix:** Consider protecting `/docs` behind admin authentication or restricting it to internal IPs. If it must be public, pin the Swagger UI scripts with hashes/nonces rather than `unsafe-inline`/`unsafe-eval`. At minimum, restrict access to the route in production environments.

### S-010 — Debug Logging in `main.ts` Leaks System Details

- **Rule ID:** S-010
- **Severity:** Low
- **Location:**
  - `apps/api/src/main.ts` lines 9–12 and 59–63
- **Evidence:**
  ```typescript
  console.error('=== MAIN.TS LOADED ===');
  console.error('Node version:', process.version);
  console.error('CWD:', process.cwd());
  console.error('Files in dist:', require('fs').readdirSync('.').join(', '));
  ```
  Also:
  ```typescript
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);
  ```
- **Impact:** In most production setups logs are accessible to operators only, so this is low severity. However, `readdirSync('.')` leaks internal file structure, and if logs are ever exposed (e.g., a log-streaming endpoint, misconfigured logging dashboard), this aids attacker reconnaissance.
- **Fix:** Gate these lines behind a `process.env.DEBUG` or `NODE_ENV !== 'production'` check. The Railway-specific troubleshooting that motivated this logging should be cleaned up now that it's presumably resolved.

### S-011 — Health Check Endpoint Leaks Internal State

- **Rule ID:** S-011
- **Severity:** Low
- **Location:**
  - `apps/api/src/main.ts` lines 247–254
- **Evidence:**
  ```typescript
  res.status(200).json({ 
    status: 'ok', 
    appReady: true,
    dbConnected,          // leaks DB connectivity state
    timestamp: new Date().toISOString() 
  });
  ```
- **Impact:** Exposes internal infrastructure state to unauthenticated callers. Not critical, but provides useful reconnaissance data.
- **Fix:** Return only `{ status: 'ok' }` publicly. Move detailed health data to an authenticated internal endpoint or restrict by IP.

### S-012 — Agent Config File Stores API Key in Plaintext on Disk

- **Rule ID:** S-012
- **Severity:** Low
- **Location:**
  - `apps/agent/` — `~/.private-connect/config.json` (chmod 0600)
- **Evidence:** The agent stores its API key in a local config file at `~/.private-connect/config.json` with `0600` permissions. The permissions are correct, but the key is plaintext on disk.
- **Impact:** Process listings, memory dumps, or symlink attacks could expose the key. On multi-user systems, any process running as the same user can read it.
- **Fix:** This is relatively acceptable for a CLI tool (similar to how `~/.ssh/id_rsa` works). The current `0600` permissions are correct. Consider documenting this clearly in the CLI's security documentation. As an enhancement, the key could be stored in the OS keychain (`keytar` library) on supported platforms.

---

## Informational

### S-013 — No CSRF Tokens for Cookie-Authenticated State-Changing Requests

- **Rule ID:** S-013
- **Severity:** Informational (see notes)
- **Location:**
  - All POST/PUT/PATCH/DELETE routes in `apps/api/src/`
- **Notes:** CSRF is only relevant for cookie-authenticated requests. The web app uses session cookies for auth (`credentials: 'include'`). In practice, `SameSite=Lax` (if implemented per S-006) provides significant CSRF protection for top-level navigations. However, there are no explicit CSRF tokens implemented. If `SameSite` is properly set to `Lax` or `Strict`, this becomes low risk. Resolve S-006 first and then evaluate whether explicit CSRF tokens are needed based on your CORS and cookie configuration.

### S-014 — No Rate Limiting on Magic-Link Email Endpoint

- **Rule ID:** S-014
- **Severity:** Informational
- **Location:**
  - `apps/api/src/auth/` — magic link request endpoint
- **Notes:** Global throttling is configured, but it's worth verifying that the magic-link request endpoint has per-email-address rate limiting to prevent email spam/abuse. Unlimited magic-link requests to a target email address would be a nuisance to users and potentially a reputation issue for the sending domain.

---

## Findings Summary Table

| ID    | Title                                                | Severity      | File(s)                                              |
|-------|------------------------------------------------------|---------------|------------------------------------------------------|
| S-001 | API keys stored plaintext in DB                      | **Critical**  | `prisma/schema.prisma`, `api-keys.service.ts`, `api-key.guard.ts` |
| S-002 | `aiApiKey` stored/retrieved without encryption       | **High**      | `prisma/schema.prisma`, `ai/ai.service.ts`           |
| ~~S-003~~ | ~~XFF extraction mismatch enables IP allowlist bypass~~ | ~~High~~ | *(Retracted — implementation is correct)* |
| S-004 | Workspace API key in `localStorage`                  | **High**      | `apps/web/composables/useAuth.ts`                    |
| S-005 | Static Postgres credentials in docker-compose        | **Medium**    | `docker-compose.yml`                                 |
| ~~S-006~~ | ~~Session cookie missing `SameSite` / conditional `Secure`~~ | ~~Medium~~ | *(Retracted — already correctly implemented)* |
| S-007 | Third-party script without SRI                       | **Medium**    | `apps/web/nuxt.config.ts`                            |
| S-008 | `X-Forwarded-Proto` read directly in www redirect    | **Medium**    | `apps/api/src/main.ts`                               |
| S-009 | Swagger UI served with `unsafe-inline`/`unsafe-eval` | Low           | `apps/api/src/main.ts`                               |
| S-010 | Debug logging leaks system details                   | Low           | `apps/api/src/main.ts`                               |
| S-011 | Health endpoint leaks internal state                 | Low           | `apps/api/src/main.ts`                               |
| S-012 | Agent API key stored plaintext on disk               | Low           | `apps/agent/` config                                 |
| S-013 | No explicit CSRF tokens                              | Informational | All cookie-auth routes                               |
| S-014 | Magic-link endpoint may lack per-email rate limit    | Informational | `apps/api/src/auth/`                                 |

---

*Report written to `security_best_practices_report.md` at the workspace root.*
