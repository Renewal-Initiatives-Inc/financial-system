# Security Audit — All Repositories

**Baseline:** [Information Security Policy](information-security-policy.md) (effective 2026-02-17)
**Audit date:** 2026-03-01
**Scope:** All 7 Renewal Initiatives GitHub repositories, code-level review
**Severity cutoff:** Critical, High, and Medium only (Low items omitted)

---

## Summary

| Repo | Critical | High | Medium | Total |
|------|----------|------|--------|-------|
| financial-system | 1 | 2 | 3 | 6 |
| claude-timesheet-app-3kickoff | 0 | 5 | 4 | 9 |
| proposal-rodeo | 1 | 5 | 6 | 12 |
| expense-reports-homegrown | 0 | 3 | 1 | 4 |
| app-portal | 0 | 0 | 1 | 1 |
| zitadel-mcp | 2 | 4 | 6 | 12 |
| claude-global-appbuilding-skills | 0 | 0 | 0 | 0 |
| **Total** | **4** | **14** | **16** | **44** |

---

## financial-system

### CRITICAL

#### FS-C1. SQL Injection in Data Retention Dashboard
- **File:** `src/app/(protected)/settings/data-retention/actions.ts:58-72`
- **Policy:** Section 7.2 (parameterized queries)
- **Issue:** `getRetentionSummary()` uses `sql.raw()` with string interpolation for table names and column names. While the `queries` array is currently hardcoded, this bypasses Drizzle ORM's parameterization and sets a dangerous pattern.
- **Fix:** Replace with Drizzle query builders using explicit table references, or use a `switch` statement over hardcoded table references instead of dynamic table names.

### HIGH

#### ~~FS-H1. Missing RBAC on Admin-Only Features~~ — DISREGARDED
- **Reason:** Only admin users can authenticate to the system. Zitadel sign-in callback rejects anyone without the `app:finance` role, and only admins have that role. No non-admin user can reach these pages.

#### FS-H2. W-9 Documents Stored with Public Blob Access
- **File:** `src/app/api/upload/route.ts:36-38`
- **Policy:** Section 6.1 (Confidential data classification — tax info restricted to admin role)
- **Issue:** Uploaded W-9 documents (containing SSNs/EINs) are stored with `access: 'public'` in Vercel Blob. Anyone with the URL can download them without authentication. Category parameter is also unvalidated.
- **Fix:** Use `access: 'private'` and serve files through authenticated API routes. Validate the `category` parameter against an allowlist.

#### FS-H3. Upload Endpoint Accepts Unsanitized Filenames
- **File:** `src/app/api/upload/route.ts:36`
- **Policy:** Section 7.2 (input validation)
- **Issue:** User-provided `file.name` is used directly in the Vercel Blob path without sanitization, enabling potential path traversal (`../../../` in filename).
- **Fix:** Sanitize filenames to alphanumeric, dots, hyphens only: `file.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255)`

### MEDIUM

#### FS-M1. CSP Allows Unsafe-Inline Styles
- **File:** `src/middleware.ts:10`
- **Policy:** Section 7.2 (XSS prevention via CSP)
- **Issue:** `style-src 'self' 'unsafe-inline'` weakens XSS defense-in-depth. Unlike the `script-src` which uses nonces, style-src has no such safeguard.
- **Fix:** Add nonce-based style loading or accept as known limitation with documented risk.

#### FS-M2. Weak Encryption Key Entropy Validation
- **File:** `src/lib/encryption.ts:7-21`
- **Policy:** Section 6.2 (AES-256-GCM encryption)
- **Issue:** `getKeyFromEnv()` validates key length but not entropy. A 32-byte key of all zeros would be accepted.
- **Fix:** Add minimum unique-byte check (e.g., reject keys with fewer than 4 unique byte values).

#### FS-M3. Error Messages Leak Internal Details
- **Files:** `src/app/api/extract-contract/route.ts:23-28`, `src/app/api/copilot/route.ts:182`
- **Policy:** Section 7.2 (application security)
- **Issue:** Error responses return `error.message` directly to clients, potentially leaking database details, library versions, or internal paths.
- **Fix:** Return generic error messages to clients. Log detailed errors server-side only.

---

## claude-timesheet-app-3kickoff

### HIGH

#### TS-H1. Uploaded Documents of Minors Stored with Public Access
- **File:** `packages/backend/src/services/storage.service.ts:41`
- **Policy:** Section 6.1 (Confidential data handling)
- **Issue:** Employee documents (parental consent forms, work permits for minors ages 12-17) are uploaded to Vercel Blob with `access: 'public'`. The comment says "We'll use signed URLs for actual access control" but `getDownloadUrl()` returns the public URL directly — no signed URL generation occurs.
- **Fix:** Use `access: 'private'` and generate time-limited signed URLs via Vercel's API.

#### TS-H2. No AES-256-GCM Encryption for Sensitive Data at Rest
- **Policy:** Section 6.2 (encryption at rest)
- **Issue:** Zero encryption logic exists in the backend. No `encrypt`, `decrypt`, or `AES` references found. Employee date of birth and email addresses stored in plaintext. Legacy `password_hash` column still in schema at `packages/backend/src/db/schema/employee.ts:19`.
- **Fix:** Implement AES-256-GCM encryption for `dateOfBirth` at minimum. Remove unused `password_hash` column.

#### TS-H3. JWT Audience (`aud`) Not Validated
- **File:** `packages/backend/src/middleware/auth.middleware.ts:128`
- **Policy:** Section 5.1 (authentication)
- **Issue:** `jwtVerify()` validates `issuer` but not `audience`. A valid Zitadel token issued for a different application in the same Zitadel org would be accepted.
- **Fix:** Add `audience` validation matching the Zitadel project ID or client ID.

#### TS-H4. PKCE Not Explicitly Configured
- **File:** `packages/frontend/src/auth/oidc-config.ts:11-20`
- **Policy:** Section 5.1 (PKCE requirement)
- **Issue:** OIDC config uses `response_type: 'code'` but does not explicitly set `code_challenge_method: 'S256'`. While `oidc-client-ts` may default to PKCE, the policy requires explicit enforcement.
- **Fix:** Explicitly declare PKCE parameters and verify server-side enforcement in Zitadel.

#### TS-H5. Unauthenticated Test Endpoint in Production
- **File:** `api/test.ts`
- **Policy:** Section 7.2 (all routes authenticated)
- **Issue:** `/api/test` is fully unauthenticated and returns request metadata. Should not exist in production.
- **Fix:** Delete `api/test.ts` entirely.

### MEDIUM

#### TS-M1. Audit Logs Not Append-Only
- **Policy:** Section 7.3 (append-only audit logging)
- **Issue:** `compliance_check_logs` table has no database-level protection against DELETE/UPDATE. The reset script at `packages/backend/src/db/reset-task-codes.ts:35` executes `db.delete(complianceCheckLogs)`. Compliance logging is also not transactional with timesheet status updates.
- **Fix:** Add PostgreSQL `BEFORE DELETE` trigger that raises an exception. Wrap compliance logging + status updates in a database transaction.

#### TS-M2. CSRF Protection Disabled in Test Mode
- **File:** `packages/backend/src/middleware/csrf.middleware.ts:51`
- **Issue:** CSRF is disabled when `NODE_ENV=test`. If misconfigured in production or staging, protection vanishes.
- **Fix:** Use a separate `DISABLE_CSRF` flag instead of tying to `NODE_ENV`.

#### TS-M3. Error Details Leaked in Preview Deployments
- **File:** `packages/backend/src/middleware/error-handler.middleware.ts:126-133`
- **Issue:** Non-production environments include stack traces in error responses. Vercel preview deployments run with `NODE_ENV !== 'production'`, so all preview branches leak internals.
- **Fix:** Set `NODE_ENV=production` on Vercel preview environments, or use an explicit `DEBUG` flag.

#### TS-M4. Database SSL Not Explicitly Enforced
- **File:** `packages/backend/src/db/index.ts`
- **Issue:** `pg.Pool` configuration has no `ssl` setting. The Neon serverless driver handles SSL at the protocol level, but the Pool path (used in dev/test) does not enforce SSL.
- **Fix:** Add `ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : undefined`.

---

## proposal-rodeo

### CRITICAL

#### ~~PR-C1. No Authorization (RBAC) Enforcement~~ — DISREGARDED
- **Reason:** Only admin users can authenticate to the system. Zitadel sign-in callback rejects anyone without the `app:proposal-rodeo` role, and only admins have that role. The in-app roles exist for future multi-user support but are not a current vulnerability.

#### PR-C2. Cron Endpoints Bypass Auth with Fail-Open Secret Check
- **Files:** `src/lib/auth.ts:7` (`publicApiRoutes` includes `/api/cron`), `src/app/api/cron/deadline-reminders/route.ts:18-23`, `src/app/api/cron/process-jobs/route.ts:20-24`
- **Policy:** Section 7.2 (cron secret authentication)
- **Issue:** All `/api/cron/*` routes skip middleware auth. The `CRON_SECRET` check is conditional — if the env var is unset, the check is silently skipped. The `deadline-reminders` endpoint only enforces the secret in production. An attacker could trigger AI job processing (consuming Anthropic API credits) or cause data corruption.
- **Fix:** Make `CRON_SECRET` check mandatory (fail-closed). Remove the `NODE_ENV` conditional.

#### PR-C3. Debug Endpoints Exposed Without Admin Gate
- **Files:** `src/lib/auth.ts:7` (`publicApiRoutes` includes `/api/debug`), `src/app/api/debug/session/route.ts`, `src/app/api/debug/proposal/[id]/route.ts`
- **Policy:** Section 5.2 (admin functions restricted)
- **Issue:** `/api/debug` prefix is in `publicApiRoutes`, bypassing middleware auth. Debug endpoints return internal user IDs, database record lookups, and proposal details. These were dev-only and should not be in production.
- **Fix:** Delete `src/app/api/debug/` directory entirely. Remove `/api/debug` from `publicApiRoutes` in `src/lib/auth.ts`.

### HIGH

#### PR-H1. Stored XSS via dangerouslySetInnerHTML Without Sanitization
- **Files:** `src/components/writing/VersionHistoryPanel.tsx:281`, `src/components/writing/EditorPanel.tsx:63`
- **Policy:** Section 7.2 (XSS prevention)
- **Issue:** Draft content is rendered via `dangerouslySetInnerHTML={{ __html: previewContent.content }}` with no HTML sanitization. Content comes from both human editors (Tiptap) and AI-generated output. No DOMPurify or equivalent exists in the codebase.
- **Fix:** Install DOMPurify and sanitize all HTML before rendering with `dangerouslySetInnerHTML`.

#### PR-H2. No CSP (Content Security Policy) Headers
- **Files:** `next.config.mjs` (empty config), `vercel.json` (no headers)
- **Policy:** Section 7.2 (XSS prevention via CSP)
- **Issue:** Zero Content Security Policy headers configured anywhere. Combined with PR-H1, this means any XSS has maximum impact — injected scripts can exfiltrate data and hijack sessions unrestricted.
- **Fix:** Add CSP headers via `next.config.mjs` `headers()`. At minimum: `script-src 'self'`, `default-src 'self'`.

#### PR-H3. All Uploaded Files Publicly Accessible
- **Files:** `src/lib/blob.ts:73,152,229,292` — all use `access: 'public'`
- **Policy:** Section 6.1 (Confidential data handling)
- **Issue:** RFP documents, proposal drafts, CVs/resumes, and project showcase documents all stored with `access: 'public'`. URLs have a predictable path structure (`rfp/{proposalId}/{timestamp}-{filename}`). RFPs may contain proprietary solicitation content, CVs contain PII.
- **Fix:** Use `access: 'private'` and serve through authenticated API routes with proposal membership checks.

#### PR-H4. Inngest Endpoint Publicly Accessible
- **File:** `src/lib/auth.ts:7` (`publicApiRoutes` includes `/api/inngest`)
- **Policy:** Section 7.2 (authenticated routes)
- **Issue:** The Inngest endpoint serves GET/POST/PUT without middleware auth. Relies solely on Inngest signing key for verification.
- **Fix:** Verify Inngest signing key is properly configured. Consider removing from `publicApiRoutes` if possible.

#### PR-H5. No Audit Logging
- **Policy:** Section 7.3 (append-only audit logging)
- **Issue:** No audit log table, no audit logging middleware, no audit trail for any operation (proposal lifecycle, document management, AI content generation, budget changes, team changes). Only a placeholder comment in `assembly.ts:305`.
- **Fix:** Create `audit_log` table and implement transactional logging for all write operations.

### MEDIUM

#### PR-M1. AI Prompt Injection — Tool Calls Not Scoped to User Context
- **Files:** `src/app/api/proposals/[id]/sections/[sectionId]/chat/route.ts:100-105`, `src/lib/ai/chat-tools.ts`
- **Issue:** AI chat tools accept `proposalId` as input from the AI model. The tools don't validate that the AI's tool call parameters match the current user's route context. A prompt injection could trick the AI into querying other proposals' data.
- **Fix:** Pin tool call parameters to route params server-side, ignoring AI-provided values.

#### PR-M2. Cron Secret Bypass When Env Var Unset (Fail-Open)
- **Files:** `src/app/api/cron/process-jobs/route.ts:22-24`, `src/app/api/cron/cleanup-jobs/route.ts:22-24`
- **Issue:** Pattern `if (cronSecret && authHeader !== ...)` means missing env var silently skips auth.
- **Fix:** Fail-closed: if `CRON_SECRET` is not set, reject the request.

#### PR-M3. Error Messages Leak Internal Details
- **Files:** `src/app/api/proposals/[id]/sections/[sectionId]/chat/route.ts:299-305`, `src/app/api/health/route.ts:21`, `src/app/api/debug/proposal/[id]/route.ts:129`
- **Issue:** Chat endpoint streams actual error messages to clients. Health endpoint returns database error messages.
- **Fix:** Return generic error messages. Log details server-side only.

#### PR-M4. ANTHROPIC_API_KEY Not in .env.example
- **File:** `.env.example`
- **Issue:** The key is used throughout the app but not documented in `.env.example`, risking hardcoding during setup.
- **Fix:** Add `ANTHROPIC_API_KEY=your_anthropic_api_key` to `.env.example`.

#### PR-M5. Database SSL Not Enforced in Code
- **File:** `src/db/index.ts`
- **Issue:** `DATABASE_URL` passed directly to `neon()` without SSL enforcement at code level. Relies on connection string containing `?sslmode=require`.
- **Fix:** Add runtime check that `DATABASE_URL` contains `sslmode=require`.

#### PR-M6. Health Endpoint Exposes Database Status Unauthenticated
- **File:** `src/app/api/health/route.ts`
- **Issue:** In `publicApiRoutes`, returns database connectivity status and error messages without auth. Provides reconnaissance value.
- **Fix:** Return only `healthy`/`unhealthy` for unauthenticated requests.

---

## expense-reports-homegrown

### HIGH

#### ER-H1. No CSP or Security Headers
- **File:** `next.config.ts` (no `headers()` function)
- **Policy:** Section 7.2 (XSS prevention via CSP)
- **Issue:** No Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, or Referrer-Policy headers. Zero security headers configured.
- **Fix:** Add headers matching app-portal's implementation in `next.config.ts`.

#### ER-H2. Stored XSS via Email HTML Receipts
- **File:** `src/lib/blob.ts:83` (`uploadEmailHtml()`)
- **Policy:** Section 7.2 (XSS prevention)
- **Issue:** `uploadEmailHtml()` uploads raw HTML content from parsed emails to Vercel Blob as `text/html` with public access. If a malicious email contains JavaScript, it executes when anyone views the receipt URL in a browser.
- **Fix:** Sanitize HTML with DOMPurify before storage, or serve with `Content-Disposition: attachment`, or convert to image/PDF.

#### ER-H3. No Audit Logging
- **Policy:** Section 7.3 (audit logging)
- **Issue:** Zero audit log infrastructure. No logging of report approval/rejection, expense creation/deletion, mileage rate changes, or admin actions.
- **Fix:** Add audit log table following the app-portal's implementation pattern.

### MEDIUM

#### ER-M1. No Magic-Byte Validation on Receipt Uploads
- **File:** `src/lib/blob.ts:14-24`
- **Issue:** `validateFile()` checks MIME type and size but not magic bytes. MIME type is client-supplied and spoofable. The app-portal has proper magic-byte validation that could be ported.
- **Fix:** Add magic-byte validation matching app-portal's `upload-validation.ts` implementation.

---

## app-portal

### MEDIUM

#### AP-M1. Stack Trace Exposed in Error Boundary
- **File:** `src/app/admin/audit-log/error.tsx:31-40`
- **Issue:** Error boundary renders `error.message` and provides expandable `error.stack` to admin users. Stack traces reveal internal file paths, library versions, and implementation details.
- **Fix:** Remove `error.stack` display. Log full errors server-side and show generic message.

**Note:** app-portal otherwise passes all security checks. It has proper CSP headers, RBAC enforcement, audit logging with transactional guarantees, rate limiting, AES-256-GCM encryption for PII, magic-byte file validation, and Zod input validation throughout. It represents the security standard the other repos should aspire to.

---

## zitadel-mcp

### CRITICAL

#### ZM-C1. Client Secrets and Private Keys Returned to AI Model
- **Files:** `src/tools/applications.ts:136-142`, `src/tools/service-accounts.ts:88-95`
- **Issue:** When creating an OIDC app, the `clientSecret` is returned in the MCP tool response text. When creating a service user key, the full `keyDetails` (private key material) is returned. The MCP server runs entirely on the user's machine (stdio transport, no telemetry, no phone-home) — so the repo author cannot obtain other users' credentials. However, secrets in MCP tool responses are visible on screen, stored in Anthropic's conversation history, and captured in local logs. This is a concern for anyone who downloads and uses this MCP server.
- **Fix:** Write secrets to local files at `~/.zitadel-mcp/keys/` with `chmod 600` permissions. Return only the file path in the MCP response. For OIDC client secrets (retrievable from Zitadel console), can alternatively return a confirmation with no secret. For service account keys (only available at creation time), the local file approach is required.

#### ZM-C2. No Safeguards on Destructive Operations
- **Files:** `src/tools/users.ts` (`delete_user`, `deactivate_user`, `lock_user`), `src/tools/roles.ts` (`remove_user_grant`)
- **Issue:** `zitadel_delete_user` permanently deletes accounts with no confirmation step, dry-run mode, or guard rails. A prompt injection or misunderstood user intent could destroy user accounts across all federated applications.
- **Fix:** Implement confirmation pattern (preview + confirmation token). Add `ZITADEL_READ_ONLY=true` option. Consider removing `delete_user` entirely (deactivation is reversible).

### HIGH

#### ZM-H1. No Rate Limiting
- **Files:** `src/auth/client.ts`, `src/index.ts`
- **Issue:** Every tool call results in HTTP requests to Zitadel with no delay, queue, or concurrency limit. A looping AI model could create hundreds of users or exhaust the Zitadel instance.
- **Fix:** Add sliding-window rate limiter (e.g., 10 writes/min, 60 reads/min).

#### ZM-H2. Admin API Access Exceeds Minimum Privilege
- **File:** `src/tools/organizations.ts:56`
- **Issue:** `zitadel_list_orgs` calls `/admin/v1/orgs/_search`, requiring IAM-level admin. The service account has access to all organizations in the Zitadel instance, not just the configured one.
- **Fix:** Remove `zitadel_list_orgs` unless multi-org management is required. Document privilege requirements.

#### ZM-H3. OAuth Token Scope Overly Broad
- **File:** `src/auth/client.ts:67-68`
- **Issue:** Token scope `urn:zitadel:iam:org:project:id:zitadel:aud` grants full instance-level API access. No scope restriction limits the token to needed operations.
- **Fix:** Use the most restrictive scope possible for the operations exposed.

#### ZM-H4. New Database Connection Per Portal Tool Call
- **File:** `src/tools/portal.ts:69-80`
- **Issue:** `getPortalDb()` creates a new TCP connection on every call with no pooling. Rapid-fire calls could exhaust database connection limits. `PORTAL_DATABASE_URL` is also unvalidated.
- **Fix:** Create singleton/pooled database connection at startup. Add URL format validation.

### MEDIUM

#### ZM-M1. Error Messages Leak Zitadel API Details
- **File:** `src/auth/client.ts:87-88,103-105`
- **Issue:** Zitadel error responses (including internal paths, org IDs, rate limit headers) propagate to MCP tool responses visible to the AI model.
- **Fix:** Return generic error messages via MCP. Log details to stderr only.

#### ZM-M2. Access Token Cached as Plain Object
- **File:** `src/auth/client.ts:14,72-76`
- **Issue:** Bearer token stored as plain string in memory for up to an hour. Acceptable for stdio transport but becomes critical if transport changes to HTTP/SSE.
- **Fix:** Document this assumption. If transport changes, implement secure token storage.

#### ZM-M3. Private Key Not Zeroed After Use
- **File:** `src/auth/client.ts:35-50`
- **Issue:** Decoded PEM persists in V8 heap until garbage collected. Node.js cannot reliably zero string memory.
- **Fix:** Import key once at construction time as `CryptoKey` object (platform-level protections) rather than re-parsing PEM on each signing.

#### ZM-M4. Debug Log Redaction Incomplete
- **Files:** `src/index.ts:43-52`, `src/tools/users.ts:119`
- **Issue:** `redactArgs` misses `description`, `query`, `name`. Handler-level `logger.info` calls bypass redaction entirely (e.g., `createUserHandler` logs email directly).
- **Fix:** Remove direct PII logging in handlers. Add missing fields to `REDACTED_FIELDS`.

#### ZM-M5. No Input Length Limits on Free-Text Fields
- **Files:** `src/tools/users.ts`, `src/tools/service-accounts.ts`, `src/tools/portal.ts`
- **Issue:** String inputs use `z.string().min(1)` with no `.max()`. Megabyte-length strings could be forwarded to Zitadel.
- **Fix:** Add `.max()` constraints (names: 200 chars, descriptions: 2000 chars, emails: 254 chars).

#### ZM-M6. PORTAL_DATABASE_URL Not Validated as URL
- **File:** `src/utils/config.ts:13`
- **Issue:** Accepted as `z.string().optional()` with no format validation. `ZITADEL_ISSUER` is validated as `.url()` but the database URL is not.
- **Fix:** Add `z.string().url().optional()` or custom PostgreSQL connection string validation.

---

## Remediation Priority

### Immediate (this week)
1. **ZM-C1** — Stop returning secrets in MCP tool responses (write to local files instead)
2. **ZM-C2** — Add confirmation gates to destructive operations
3. **PR-C2** — Fix cron endpoint auth (fail-closed CRON_SECRET)
4. **PR-C3** — Delete debug endpoints from proposal-rodeo
5. **FS-C1** — Fix SQL injection in data retention dashboard

### Short-term (next 2 weeks)
6. **TS-H1, PR-H3, FS-H2** — Fix public blob access across all repos (especially minors' documents)
7. **PR-H1, PR-H2** — Add DOMPurify + CSP headers to proposal-rodeo
8. **ER-H1** — Add CSP/security headers to expense-reports
9. **ER-H2** — Fix stored XSS via email HTML receipts
10. **TS-H2** — Implement encryption at rest for timesheet app
11. **TS-H3** — Add JWT audience validation

### Medium-term (next month)
14. **PR-H5, ER-H3** — Add audit logging to proposal-rodeo and expense-reports
15. **ZM-H1** — Add rate limiting to zitadel-mcp
16. **ZM-H2, ZM-H3** — Reduce privilege scope
17. All MEDIUM items

---

## Repos That Pass (reference implementations)

**app-portal** is the security gold standard across the portfolio:
- CSP headers with HSTS, X-Frame-Options, X-Content-Type-Options
- RBAC with `verifyAdminAccess()` on all server actions
- Transactional audit logging (rolls back if audit insert fails)
- AES-256-GCM encryption for PII (tax IDs, addresses)
- Magic-byte file validation on uploads
- Rate limiting via Upstash Redis (3 tiers)
- Zod validation on all inputs
- E2E test mode with 3-layer production safeguards

Other repos should converge toward this standard.
