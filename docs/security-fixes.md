# Security Fixes — GitHub Repository Audit

Audit performed: 2026-03-01

These items were identified during a security scan of all Renewal Initiatives GitHub repositories prior to making them public. None are critical (no real secrets were found committed), but they reduce attack surface and improve hygiene.

## Priority: Medium

### 1. Timesheet App — Hardcoded Zitadel Project ID
- **Repo:** `Renewal-Initiatives-Inc/claude-timesheet-app-3kickoff`
- **File:** `packages/frontend/src/auth/oidc-config.ts:8`
- **Issue:** Zitadel Project ID (`358210659915177779`) is hardcoded in source code instead of being environment-driven
- **Fix:** Move to `VITE_ZITADEL_PROJECT_ID` environment variable
- **Risk:** Low-medium. Public OIDC project IDs aren't secrets, but hardcoding makes rotation impossible without a code change

### 2. Timesheet App — Real Zitadel Instance URL in .env.example
- **Repo:** `Renewal-Initiatives-Inc/claude-timesheet-app-3kickoff`
- **Files:** `packages/frontend/.env.example`, `packages/backend/.env.example`
- **Issue:** Real Zitadel instance URL (`renewal-initiatives-hgo6bh.us1.zitadel.cloud`) and Client ID (`358330659137156892`) in example files
- **Fix:** Replace with placeholder values (`https://your-instance.zitadel.cloud`, `your-client-id`)
- **Risk:** Low-medium. Reveals the exact identity provider endpoint, enabling targeted reconnaissance

## Priority: Low

### 3. Timesheet App — Real Vercel Deployment URLs in Docs
- **Repo:** `Renewal-Initiatives-Inc/claude-timesheet-app-3kickoff`
- **File:** `docs/troubleshooting/VERCEL_FIXES.md`
- **Issue:** Contains real deployment URLs (`renewal-timesheet.vercel.app`, Vercel project slug)
- **Fix:** Replace with generic examples or redact
- **Risk:** Low. URLs are publicly accessible anyway

### 4. Timesheet App — Real Email Domains in Seed Scripts
- **Repo:** `Renewal-Initiatives-Inc/claude-timesheet-app-3kickoff`
- **Files:** `packages/backend/src/db/seed.ts`, `.env.example`, `docs/LAUNCH_CHECKLIST.md`
- **Issue:** Real org email domains (`@renewal.org`, `@renewalinitiatives.org`) in seed data and docs
- **Fix:** Replace with `@example.org` in seed scripts and documentation examples
- **Risk:** Low. Confirms organization identity, minor phishing vector

### 5. Timesheet App — Bcrypt Hash in Test Seeds
- **Repo:** `Renewal-Initiatives-Inc/claude-timesheet-app-3kickoff`
- **Files:** `packages/backend/src/db/seed.ts:23`, `packages/backend/src/db/load-test-seed.ts:37`
- **Issue:** Bcrypt password hash for test accounts is committed
- **Fix:** Ensure the hashed password is not reused anywhere in production. Consider generating at seed time instead of hardcoding
- **Risk:** Low. Bcrypt is slow to crack, and this is test-only data

### 6. Zitadel MCP — Organization Name in Example URL
- **Repo:** `takleb3rry/zitadel-mcp`
- **File:** `src/tools/portal.ts:28`
- **Issue:** Example URL uses `renewalinitiatives.org` instead of a generic domain
- **Fix:** Replace with `https://my-app.example.com`
- **Risk:** Low. Ties the public repo to the organization name

### 7. All Repos — Git Commit Author Emails
- **Repos:** All
- **Issue:** Git commit metadata exposes author email (`jeff@takle.me`) and local hostname
- **Fix:** Configure GitHub no-reply email (`takleb3rry@users.noreply.github.com`) for future commits via `git config user.email`
- **Risk:** Low. Standard for public repos, but worth being intentional about

## Items Confirmed Clean

- No `.env`, `.env.local`, or `.env.production` files committed in any repo
- No Anthropic API keys (`sk-ant-*`) in any repo or git history
- No AWS access keys (`AKIA*`) in any repo or git history
- No real database connection strings (Neon, Postgres) in any repo or git history
- No real Postmark API keys committed anywhere
- No private keys, PEM files, or certificates in any repo
