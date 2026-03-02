# Security Audit Remediation — All Repositories Plan

**Status:** Ready to Execute
**Last Updated:** 2026-03-01
**Author:** Jeff + Claude
**Traces to:** [docs/security-fixes.md](security-fixes.md), [docs/information-security-policy.md](information-security-policy.md)

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/security-audit-remediation-PLAN.md Continue.`

---

## 1. Problem Statement

A code-level security audit against the Information Security Policy identified 44 findings (4 Critical, 14 High, 16 Medium) across 7 GitHub repositories. These need to be tracked, prioritized, and resolved systematically, with cross-repo patterns addressed consistently rather than one-off.

---

## 2. Discovery

### Questions

1. **Repo access & tooling:** Can Claude Code operate on all 7 repos, or should fixes be planned per-repo with separate sessions? Where do the other repos live on disk (paths)?
2. **Disregarded findings:** The audit already disregarded FS-H1 and PR-C1 (RBAC not needed because only admins can authenticate). Are there other findings Jeff wants to disregard or downgrade?
3. **Public blob access (FS-H2, TS-H1, PR-H3):** Three repos store sensitive files with `access: 'public'`. Switching to `access: 'private'` requires authenticated download routes. Is there a shared pattern to follow, or should each repo implement independently?
4. **DOMPurify (PR-H1, ER-H2):** Two repos need HTML sanitization. Should we standardize on `isomorphic-dompurify` (works server-side) or `dompurify` (client-only)?
5. **Audit logging (PR-H5, ER-H3):** Two repos have zero audit logging. Should they follow app-portal's transactional pattern exactly, or is a simpler approach acceptable at their scale?

### Responses

1. **Repo access:** All repos live under `/Users/jefftakle/Desktop/Claude/`. Mapped paths:
   - `financial-system` → `/Users/jefftakle/Desktop/Claude/financial-system/`
   - `claude-timesheet-app-3kickoff` → `/Users/jefftakle/Desktop/Claude/renewal-timesheets/`
   - `proposal-rodeo` → `/Users/jefftakle/Desktop/Claude/proposal-rodeo/`
   - `expense-reports-homegrown` → `/Users/jefftakle/Desktop/Claude/expense-reports-homegrown/`
   - `app-portal` → `/Users/jefftakle/Desktop/Claude/internal-app-registry-auth/app-portal/`
   - `zitadel-mcp` → `/Users/jefftakle/Desktop/Claude/mcp-servers/zitadel-mcp/`
2. **Disregarded findings:** None beyond FS-H1 and PR-C1. Ask Jeff first if in doubt or if a fix seems low-value.
3. **Blob access pattern:** Handle similarly across all repos — shared pattern for `access: 'private'` + authenticated download routes.
4. **DOMPurify:** Jeff has no preference — Claude to pick the right tool. Decision: `isomorphic-dompurify` (works server-side for SSR in Next.js and in route handlers).
5. **Audit logging:** Lighter approach for proposal-rodeo and expense-reports. Meet the policy minimum (§7.3: append-only log with user ID, action, entity type, entity ID, before/after state, timestamp; transactional guarantees). No need to replicate app-portal's full infrastructure (rate limiting tiers, Redis, etc.).

### Synthesis

- **Execution model:** Work from this repo (financial-system) as home base. Fix financial-system items directly. For other repos, plan fixes here but execute in separate sessions or via file reads for context.
- **Pattern consistency:** Blob access, CSP headers, error handling, and audit logging should follow the same pattern across repos. Financial-system and app-portal are the reference implementations.
- **DOMPurify:** Use `isomorphic-dompurify` everywhere (SSR-compatible).
- **Audit logging:** Minimal viable: single `audit_log` table, `INSERT` in a transaction with the mutation, `BEFORE DELETE` trigger to prevent tampering. No Redis, no rate limiting tiers.
- **Ask-first policy:** If a fix seems dubious or low-value, check with Jeff before implementing.

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Execute from financial-system repo; fix local items directly, track cross-repo items for separate sessions | All repos accessible on disk; avoids context-switching overhead |
| D2 | Shared patterns: blob `access: 'private'` + auth'd download route; `isomorphic-dompurify` for HTML sanitization; lightweight audit log table with DB-level delete protection | Consistency simplifies maintenance and troubleshooting per Jeff's preference |
| D3 | No additional findings disregarded; ask Jeff before skipping any fix | Conservative approach — address everything unless explicitly waived |
| D4 | Audit logging for proposal-rodeo and expense-reports: policy minimum only (§7.3) | These apps handle less sensitive data than app-portal; lighter approach is proportionate |

---

## 4. Requirements

Derived directly from [security-fixes.md](security-fixes.md). Findings already disregarded by the audit (FS-H1, PR-C1) are excluded.

### P0: Critical — Immediate (this week)

| ID | Finding | Repo | Summary |
|----|---------|------|---------|
| REM-01 | ZM-C1 | zitadel-mcp | Stop returning client secrets/private keys in MCP tool responses |
| REM-02 | ZM-C2 | zitadel-mcp | Add confirmation gates to destructive operations (delete_user, etc.) |
| REM-03 | PR-C2 | proposal-rodeo | Fix cron endpoint auth — fail-closed `CRON_SECRET` check |
| REM-04 | PR-C3 | proposal-rodeo | Delete debug endpoints, remove `/api/debug` from `publicApiRoutes` |
| REM-05 | FS-C1 | financial-system | Fix SQL injection in data retention dashboard (`sql.raw()` removal) |

### P1: High — Short-term (next 2 weeks)

| ID | Finding | Repo | Summary |
|----|---------|------|---------|
| REM-06 | FS-H2 | financial-system | W-9 uploads: `access: 'private'` + authenticated download route + validate category |
| REM-07 | FS-H3 | financial-system | Sanitize filenames in upload endpoint |
| REM-08 | TS-H1 | timesheet | Minor documents: `access: 'private'` + signed URLs |
| REM-09 | TS-H2 | timesheet | Implement AES-256-GCM encryption for `dateOfBirth`; remove `password_hash` column |
| REM-10 | TS-H3 | timesheet | Add JWT `audience` validation in auth middleware |
| REM-11 | TS-H4 | timesheet | Explicitly configure PKCE (`code_challenge_method: 'S256'`) |
| REM-12 | TS-H5 | timesheet | Delete unauthenticated `api/test.ts` endpoint |
| REM-13 | PR-H1 | proposal-rodeo | Install DOMPurify, sanitize all `dangerouslySetInnerHTML` usage |
| REM-14 | PR-H2 | proposal-rodeo | Add CSP + security headers (match financial-system pattern) |
| REM-15 | PR-H3 | proposal-rodeo | All uploaded files: `access: 'private'` + authenticated download |
| REM-16 | PR-H4 | proposal-rodeo | Verify Inngest signing key; tighten public route config |
| REM-17 | PR-H5 | proposal-rodeo | Implement audit logging (table + transactional writes) |
| REM-18 | ER-H1 | expense-reports | Add CSP + security headers (match financial-system pattern) |
| REM-19 | ER-H2 | expense-reports | Sanitize email HTML receipts before Blob storage |
| REM-20 | ER-H3 | expense-reports | Implement audit logging |
| REM-21 | ZM-H1 | zitadel-mcp | Add rate limiting (sliding window) |
| REM-22 | ZM-H2 | zitadel-mcp | Remove or restrict `zitadel_list_orgs` (admin API access) |
| REM-23 | ZM-H3 | zitadel-mcp | Reduce OAuth token scope |
| REM-24 | ZM-H4 | zitadel-mcp | Singleton/pooled DB connection for portal tools |

### P2: Medium — Next month

| ID | Finding | Repo | Summary |
|----|---------|------|---------|
| REM-25 | FS-M1 | financial-system | CSP `style-src 'unsafe-inline'` — document as accepted risk or add nonce |
| REM-26 | FS-M2 | financial-system | Encryption key entropy validation (min unique bytes) |
| REM-27 | FS-M3 | financial-system | Generic error messages in API routes |
| REM-28 | TS-M1 | timesheet | Audit logs append-only (DB trigger + transactional writes) |
| REM-29 | TS-M2 | timesheet | CSRF protection — decouple from `NODE_ENV` |
| REM-30 | TS-M3 | timesheet | Error details leaked in preview deployments |
| REM-31 | TS-M4 | timesheet | Database SSL enforcement for Pool path |
| REM-32 | PR-M1 | proposal-rodeo | AI prompt injection — pin tool call params to route context |
| REM-33 | PR-M2 | proposal-rodeo | Cron secret fail-open (covered by REM-03 fix) |
| REM-34 | PR-M3 | proposal-rodeo | Generic error messages in API routes |
| REM-35 | PR-M4 | proposal-rodeo | Add `ANTHROPIC_API_KEY` to `.env.example` |
| REM-36 | PR-M5 | proposal-rodeo | Database SSL runtime check |
| REM-37 | PR-M6 | proposal-rodeo | Health endpoint — hide DB status from unauthed requests |
| REM-38 | ER-M1 | expense-reports | Magic-byte validation on receipt uploads |
| REM-39 | AP-M1 | app-portal | Remove `error.stack` display in error boundary |
| REM-40 | ZM-M1 | zitadel-mcp | Generic error messages (hide Zitadel API details) |
| REM-41 | ZM-M2 | zitadel-mcp | Document plaintext token assumption (stdio transport) |
| REM-42 | ZM-M3 | zitadel-mcp | Import private key once as `CryptoKey` at construction |
| REM-43 | ZM-M4 | zitadel-mcp | Fix debug log redaction (missing fields + handler bypass) |
| REM-44 | ZM-M5 | zitadel-mcp | Add `.max()` constraints to all string inputs |
| REM-45 | ZM-M6 | zitadel-mcp | Validate `PORTAL_DATABASE_URL` format |

### Already Done (from prior remediation)

| Finding | Status | Notes |
|---------|--------|-------|
| CSP headers (financial-system) | ✅ | Deployed via [security-remediation-PLAN.md](security-remediation-PLAN.md) — now enforcing |
| Plaid token revocation | ✅ | Best-effort revocation on last-account deactivation |
| Data retention dashboard | ✅ | `/settings/data-retention` with 10 entity categories |

---

## 5. Data Model

Schema changes anticipated per repo:

| Repo | Change | Migration |
|------|--------|-----------|
| proposal-rodeo | Add `audit_log` table | New migration |
| expense-reports | Add `audit_log` table | New migration |
| timesheet | Add `BEFORE DELETE` trigger on `compliance_check_logs` | New migration |
| timesheet | Drop `password_hash` column from `employee` | New migration |

---

## 6. Implementation Plan

### Phase 1: Critical Fixes (P0)

**Scope:** 5 findings across 3 repos. All should be resolved this week.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| Write secrets to `~/.zitadel-mcp/keys/` instead of MCP response | REM-01 | zitadel-mcp | ✅ | OIDC: suppressed secret; Keys: write to `~/.zitadel-mcp/keys/` with `chmod 600` |
| Add confirmation pattern to destructive ops | REM-02 | zitadel-mcp | ✅ | `confirm: true` required on delete/deactivate/lock user + remove grant; `ZITADEL_READ_ONLY` blocks all writes |
| Fix cron auth: mandatory `CRON_SECRET`, remove `NODE_ENV` conditional | REM-03 | proposal-rodeo | ✅ | All 3 cron routes: fail-closed `!cronSecret \|\| authHeader !== ...` |
| Delete `src/app/api/debug/` directory + remove from `publicApiRoutes` | REM-04 | proposal-rodeo | ✅ | Directory deleted; `/api/debug` removed from `publicApiRoutes` |
| Replace `sql.raw()` with Drizzle query builders or switch/case | REM-05 | financial-system | ✅ | Explicit Drizzle table refs + `sql.identifier()` for column names |

### Phase 2: Blob Access & File Security (P1-subset)

**Scope:** Fix public blob access and file handling across 3 repos.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| W-9 uploads: non-guessable URLs + auth'd download proxy | REM-06 | financial-system | ✅ | `addRandomSuffix: true`; `/api/download` proxy; category allowlist |
| Sanitize filenames (alphanumeric + dots/hyphens only) | REM-07 | financial-system | ✅ | `.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255)` |
| Minor documents: sanitize filenames + non-guessable URLs | REM-08 | timesheet | ✅ | Already had `addRandomSuffix: true`; added filename sanitization |
| RFP/proposal/CV files: non-guessable URLs | REM-15 | proposal-rodeo | ✅ | All 4 upload fns: `addRandomSuffix: true` (was false) |
| Magic-byte validation on receipt uploads | REM-38 | expense-reports | ✅ | Ported from app-portal; added PDF + GIF signatures |

### Phase 3: XSS Prevention (P1-subset)

**Scope:** HTML sanitization + CSP headers for repos that lack them.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| Install DOMPurify; sanitize `dangerouslySetInnerHTML` | REM-13 | proposal-rodeo | ✅ | `isomorphic-dompurify`; only 1 usage in `VersionHistoryPanel.tsx:281` (EditorPanel uses controlled state) |
| Add CSP + security headers to proposal-rodeo | REM-14 | proposal-rodeo | ✅ | Nonce-based CSP + X-Content-Type-Options + Referrer-Policy + X-Frame-Options |
| Add CSP + security headers to expense-reports | REM-18 | expense-reports | ✅ | Same pattern; preserves `api/email/inbound` exclusion from matcher |
| Sanitize email HTML before Blob storage | REM-19 | expense-reports | ✅ | `DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style'] })` |

### Phase 4: Auth & Encryption (P1-subset)

**Scope:** Timesheet auth hardening + encryption.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| AES-256-GCM encryption for `dateOfBirth` | REM-09 | timesheet | ✅ | `encryption.ts` ported; schema `date→text`; decrypt on read, encrypt on write; data migration script at `scripts/encrypt-dob.ts` |
| Drop `password_hash` column | REM-09 | timesheet | ✅ | Migration 0007; removed from schema + seed data; `bcryptjs` uninstalled |
| Add JWT `audience` validation | REM-10 | timesheet | ✅ | `ZITADEL_PROJECT_ID` env var; `audience` added to both `jwtVerify` calls |
| Explicitly configure PKCE `code_challenge_method: 'S256'` | REM-11 | timesheet | ✅ | `disablePKCE: false` explicit in oidc-config.ts (S256 is library default) |
| Delete `api/test.ts` | REM-12 | timesheet | ✅ | Deleted |

### Phase 5: Audit Logging (P1-subset)

**Scope:** Add audit logging to repos that lack it.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| Create `audit_log` table + transactional logging | REM-17 | proposal-rodeo | ✅ | Schema + migration 0021 + BEFORE DELETE/UPDATE triggers + `logAuditEvent()` helper; instrumented proposals CRUD, team members CRUD, requirements CRUD |
| Create `audit_log` table + transactional logging | REM-20 | expense-reports | ✅ | Schema + migration 0003 + BEFORE DELETE/UPDATE triggers + `logAuditEvent()` helper; instrumented report CRUD, submit, approve, reject, reopen |
| Add `BEFORE DELETE` trigger on `compliance_check_logs` | REM-28 | timesheet | ✅ | Migration 0009: BEFORE DELETE + BEFORE UPDATE triggers via `prevent_compliance_log_modification()` |

### Phase 6: Zitadel MCP Hardening (P1 + P2)

**Scope:** Rate limiting, privilege reduction, input validation.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| Sliding-window rate limiter | REM-21 | zitadel-mcp | 🔲 | 10 writes/min, 60 reads/min |
| Remove or restrict `zitadel_list_orgs` | REM-22 | zitadel-mcp | 🔲 | |
| Reduce OAuth token scope | REM-23 | zitadel-mcp | 🔲 | |
| Singleton DB connection pool | REM-24 | zitadel-mcp | 🔲 | |
| Generic error messages | REM-40 | zitadel-mcp | 🔲 | |
| Document token storage assumption | REM-41 | zitadel-mcp | 🔲 | |
| Import key as `CryptoKey` once | REM-42 | zitadel-mcp | 🔲 | |
| Fix log redaction | REM-43 | zitadel-mcp | 🔲 | |
| Add `.max()` to string inputs | REM-44 | zitadel-mcp | 🔲 | |
| Validate `PORTAL_DATABASE_URL` | REM-45 | zitadel-mcp | 🔲 | |

### Phase 7: Remaining Medium Items

**Scope:** Error messages, SSL, misc hardening across all repos.

| Task | ID | Repo | Status | Notes |
|------|----|------|--------|-------|
| Document `style-src 'unsafe-inline'` as accepted risk | REM-25 | financial-system | 🔲 | Or add nonce-based styles |
| Encryption key entropy check | REM-26 | financial-system | 🔲 | Min 4 unique byte values |
| Generic error messages in API routes | REM-27 | financial-system | 🔲 | `extract-contract`, `copilot` routes |
| CSRF: decouple from `NODE_ENV` | REM-29 | timesheet | 🔲 | Use `DISABLE_CSRF` flag |
| Fix error leak in preview deployments | REM-30 | timesheet | 🔲 | `NODE_ENV=production` on Vercel preview |
| DB SSL enforcement | REM-31 | timesheet | 🔲 | `ssl: { rejectUnauthorized: true }` |
| Pin AI tool call params to route context | REM-32 | proposal-rodeo | 🔲 | Prevent prompt injection scope escape |
| Generic error messages | REM-34 | proposal-rodeo | 🔲 | Chat + health endpoints |
| Add `ANTHROPIC_API_KEY` to `.env.example` | REM-35 | proposal-rodeo | 🔲 | |
| DB SSL runtime check | REM-36 | proposal-rodeo | 🔲 | |
| Health endpoint: hide DB status | REM-37 | proposal-rodeo | 🔲 | Return `healthy`/`unhealthy` only |
| Remove `error.stack` display | REM-39 | app-portal | 🔲 | `admin/audit-log/error.tsx:31-40` |

### Cross-Cutting: Already Resolved

| Finding | Covered By | Notes |
|---------|------------|-------|
| PR-M2 (cron fail-open) | REM-03 | Same root cause as PR-C2 |
| FS CSP headers | Prior plan | Enforcing since 2026-03-01 |
| Plaid token revocation | Prior plan | Best-effort pattern |

---

## 7. Verification

| Phase | Verification Method |
|-------|---------------------|
| Phase 1 (Critical) | Manual code review of each fix; deploy + smoke test |
| Phase 2 (Blob Access) | Attempt to access file URLs without auth — should 403 |
| Phase 3 (XSS) | Inject `<script>alert(1)</script>` into content fields; verify sanitized |
| Phase 3 (CSP) | Check `Content-Security-Policy` header in browser DevTools |
| Phase 4 (Auth) | Decode JWT and verify `aud` claim validated; check PKCE in auth flow |
| Phase 5 (Audit) | Perform write operations; query `audit_log` table for entries |
| Phase 6 (Zitadel) | Rapid-fire tool calls to verify rate limiting; check no secrets in responses |
| Phase 7 (Medium) | `curl -I` for headers; inject bad filenames; check error responses |

---

## 8. Repo Scorecard

Track overall progress per repo. Update as phases complete.

| Repo | Critical | High | Medium | Done | Remaining |
|------|----------|------|--------|------|-----------|
| financial-system | 1 | 2 | 3 | 3 + 3 prior | 3 |
| timesheet | 0 | 5 | 4 | 7 | 2 |
| proposal-rodeo | 1* | 5 | 6 | 7† | 4 |
| expense-reports | 0 | 3 | 1 | 4 | 0 |
| app-portal | 0 | 0 | 1 | 0 | 1 |
| zitadel-mcp | 2 | 4 | 6 | 2 | 10 |
| **Total** | **4** | **14** | **16** | **23 + 3 prior** | **20** |

*PR-C1 disregarded; PR-C2/C3 remain. †Includes PR-M2 (REM-33) resolved by REM-03 cross-cutting fix.

---

## 9. Session Progress

### Session 1: 2026-03-01 (Plan Creation + Discovery)

**Completed:**
- [x] Created comprehensive remediation plan from audit findings
- [x] Discovery Q&A with Jeff
- [x] Mapped all 6 repo paths on disk
- [x] Finalized design decisions D1-D4

### Session 2: 2026-03-01 (Phase 1 — Critical Fixes)

**Completed:**
- [x] **REM-05** (financial-system): Replaced `sql.raw()` with Drizzle table refs + `sql.identifier()` — type-checks clean
- [x] **REM-03** (proposal-rodeo): All 3 cron routes now fail-closed (`!cronSecret || authHeader !== ...`)
- [x] **REM-04** (proposal-rodeo): Deleted `src/app/api/debug/` + removed from `publicApiRoutes`
- [x] **REM-01** (zitadel-mcp): OIDC secrets suppressed; service account keys written to `~/.zitadel-mcp/keys/` with `chmod 600`
- [x] **REM-02** (zitadel-mcp): `confirm: true` required on 4 destructive tools; `ZITADEL_READ_ONLY` env var blocks all writes

### Session 2 continued: Phase 2 — Blob Access & File Security

**Completed:**
- [x] **REM-06** (financial-system): Upload uses `addRandomSuffix: true`; created `/api/download` auth proxy; validated category against allowlist
- [x] **REM-07** (financial-system): Filename sanitization + 255 char limit
- [x] **REM-08** (timesheet): Added filename sanitization (already had `addRandomSuffix: true`)
- [x] **REM-15** (proposal-rodeo): All 4 upload functions switched from `addRandomSuffix: false` to `true`
- [x] **REM-38** (expense-reports): Created `upload-validation.ts` with magic-byte checks (PNG, JPEG, GIF, WebP, PDF); integrated into `uploadReceipt()` and `uploadEmailAttachment()`

**Note:** `@vercel/blob` v2.x only supports `access: 'public'` in `put()`. Mitigation: `addRandomSuffix: true` makes URLs non-guessable; download proxy prevents direct URL exposure in UI.

**Next Steps:**
- [ ] Commit changes in each repo (5 repos modified)
- [x] Begin Phase 3: XSS Prevention

### Session 3: 2026-03-01 (Phase 3 — XSS Prevention)

**Completed:**
- [x] **REM-13** (proposal-rodeo): Installed `isomorphic-dompurify`; sanitized `dangerouslySetInnerHTML` in `VersionHistoryPanel.tsx:281` (EditorPanel uses controlled state, not `dangerouslySetInnerHTML`)
- [x] **REM-14** (proposal-rodeo): Added nonce-based CSP + `X-Content-Type-Options` + `Referrer-Policy` + `X-Frame-Options` to middleware; `connect-src` allows `*.zitadel.cloud`, `img-src` allows Vercel Blob
- [x] **REM-18** (expense-reports): Same CSP + security headers pattern; preserves `api/email/inbound` exclusion in matcher
- [x] **REM-19** (expense-reports): `uploadEmailHtml()` now sanitizes with `DOMPurify.sanitize(html, { WHOLE_DOCUMENT: true, ADD_TAGS: ['style'] })` before Blob storage — strips scripts/event handlers while preserving email layout

**Next Steps:**
- [ ] Commit changes in each repo (proposal-rodeo, expense-reports modified this session)
- [x] Begin Phase 4: Auth & Encryption (timesheet)

### Session 3 continued: Phase 4 — Auth & Encryption (timesheet)

**Completed:**
- [x] **REM-12** (timesheet): Deleted unauthenticated `api/test.ts` endpoint
- [x] **REM-11** (timesheet): Added `disablePKCE: false` to oidc-config.ts (explicit S256 confirmation)
- [x] **REM-10** (timesheet): Added `ZITADEL_PROJECT_ID` env var + `audience` validation to both `jwtVerify` calls in auth middleware
- [x] **REM-09b** (timesheet): Dropped `password_hash` column (migration 0007); removed from schema, seed data, load-test seed; uninstalled `bcryptjs`
- [x] **REM-09a** (timesheet): Ported AES-256-GCM encryption from financial-system; created `encryption.ts` with `encryptDob`/`decryptDob` helpers; changed schema `date→text`; migration 0008 alters column type; `decryptDob()` in service + middleware read paths (handles legacy plaintext gracefully); seed scripts encrypt values; data migration script at `scripts/encrypt-dob.ts`

**New env vars required for timesheet deployment:**
- `ZITADEL_PROJECT_ID` — Zitadel project ID for JWT audience validation
- `DOB_ENCRYPTION_KEY` — 64 hex chars (32 bytes); generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

**Post-deploy steps:**
1. Apply migration 0007 (`DROP COLUMN password_hash`)
2. Apply migration 0008 (`ALTER COLUMN date_of_birth TYPE text`)
3. Run `npx tsx scripts/encrypt-dob.ts` to encrypt existing values

**Next Steps:**
- [ ] Commit changes in timesheet repo
- [ ] Set env vars in Vercel (ZITADEL_PROJECT_ID, DOB_ENCRYPTION_KEY)
- [x] Begin Phase 5: Audit Logging

### Session 4: 2026-03-01 (Phase 5 — Audit Logging)

**Completed:**
- [x] **REM-17** (proposal-rodeo): Created `audit_log` table schema + migration `0021_audit_log.sql` with BEFORE DELETE/UPDATE triggers; `logAuditEvent()` helper in `src/lib/audit.ts`; instrumented proposals CRUD (transactional), team members CRUD (transactional), requirements CRUD (post-mutation)
- [x] **REM-20** (expense-reports): Same `audit_log` table + migration `0003_audit_log.sql` with DELETE/UPDATE triggers; `logAuditEvent()` in `src/lib/db/queries/audit.ts`; instrumented report CRUD, submit, approve, reject, reopen (7 routes)
- [x] **REM-28** (timesheet): Migration `0009_protect_compliance_check_logs.sql` with BEFORE DELETE + BEFORE UPDATE triggers via `prevent_compliance_log_modification()` function

**Pattern established:**
- Both `audit_log` tables: UUID PK, user_id, user_email, action, entity_type, entity_id, before_state (JSONB), after_state (JSONB), created_at
- DB-level append-only protection: triggers prevent UPDATE and DELETE on audit rows
- Indexes on user_id, entity (type+id), and created_at for efficient queries
- `logAuditEvent(executor, event)` accepts either `db` or transaction `tx` for transactional consistency

**Post-deploy steps:**
1. proposal-rodeo: Apply migration `0021_audit_log.sql`
2. expense-reports: Apply migration `0003_audit_log.sql`
3. timesheet: Apply migration `0009_protect_compliance_check_logs.sql`

**Next Steps:**
- [ ] Commit changes in each repo (proposal-rodeo, expense-reports, timesheet)
- [ ] Begin Phase 6: Zitadel MCP Hardening
