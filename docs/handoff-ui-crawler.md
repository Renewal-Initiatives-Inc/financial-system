# Handoff: UI Crawler — Playwright Full-App Scan

## Context

We built a Playwright-based UI crawler (`e2e/ui-crawler.spec.ts`) that systematically visits every route, clicks every button, and reports all errors. The goal is to catch broken buttons, error boundaries, and dead nav in one automated sweep instead of discovering issues one at a time manually.

## Current State

### What exists
- **`e2e/ui-crawler.spec.ts`** — The crawler test (3 phases: page load, button click, link check)
- **`e2e/save-auth.ts`** — Interactive script to save Zitadel auth cookies for Playwright
- **`e2e/.auth-state.json`** — Saved auth state (may need refresh if session expired)
- **`playwright.config.ts`** — Configured with baseURL `http://localhost:3000`, chromium only
- **`ui-crawl-report.md`** — Output report from the first run (now stale — DB was fixed)

### First run results
- 230 issues found, but almost all were **DB schema mismatches** (dev DB missing columns), not actual UI bugs
- Root cause: local dev DB (`ep-winter-bar` on Neon) was missing migrations 0011–0018 that production had
- **Fixed**: Ran a catch-up migration via psql (`/tmp/dev-db-catchup.sql`) — all missing columns/tables/enums now exist
- A re-run is needed to see the real UI bug count

### Timeout issue
- The first run timed out at the 10-minute mark during Phase 2 (button clicking)
- Cause: reloading the page for every single button click is thorough but slow (~3s per button × hundreds of buttons)
- One optimization applied: Phase 2 now skips routes that already failed in Phase 1 (load errors)
- Jeff explicitly wants all UI chrome buttons tested (sidebar-trigger, user-menu, copilot-toggle, etc.) — do NOT skip those

### Known design decisions
- Destructive buttons (delete/remove/destroy) are skipped to protect real data
- Dialogs are auto-dismissed
- Console errors filtered to exclude React dev warnings
- Each button click gets a fresh page reload to ensure clean state
- Buttons identified by index + text verification (if DOM shifts, button is skipped)

## What to do next

### 1. Re-run the crawler after DB fix
```bash
# Ensure dev server is running
npm run dev

# Refresh auth if needed (interactive — log in via Zitadel, press Enter)
npx tsx e2e/save-auth.ts

# Run the crawler
npx playwright test e2e/ui-crawler.spec.ts
```
Review `ui-crawl-report.md` for remaining real UI bugs.

### 2. Fix timeout — potential approaches
The test has a 10-minute timeout (`test.setTimeout(600_000)`). Options to explore:
- **Increase timeout** to 20-30 min if the test completes within that (simplest)
- **Reduce per-click wait times** — currently 1s post-click + 1s post-reload; could try 500ms each
- **Smart reload**: only reload when previous click caused navigation (URL changed) or error boundary; otherwise click next button on same page
- **Split into multiple tests**: one test per route, run in parallel with `fullyParallel: true`
- **Phase 3 optimization**: link check re-visits every route to collect hrefs; could piggyback on Phase 1 instead

### 3. Integrate into /comprehensive-test skill
Jeff wants this crawler to become part of the `/comprehensive-test` skill. Key integration points:
- The skill currently mentions "dual E2E (Playwright/Cypress), MSW integration tests, conflict analysis, prioritized fix plan"
- The UI crawler would be a new test type: **interactive element scan**
- The skill should auto-discover routes from `src/app/**/page.tsx` instead of hardcoding them
- The report format (`ui-crawl-report.md`) should integrate with the skill's "prioritized fix plan" output
- Auth state handling needs to work for the skill's automated flow

## Architecture of the crawler

### Phase 1: Page Load Scan
- Visits all 75 static routes
- Captures: JS exceptions (`pageerror`), console errors, API 500s, HTTP status codes, error boundaries, auth redirects
- Fast (~3 min for all routes)

### Phase 2: Button Click Scan
- For each route that passed Phase 1: snapshots all visible `<button>` elements
- For each non-disabled, non-destructive button: fresh page load → find button by index → verify text match → click → check for errors
- Slow (~20-30 min for full app) — this is the timeout bottleneck

### Phase 3: Internal Link Check
- Collects all `<a href>` links across the app
- Filters to internal links not already covered by the route list
- Visits each, checks for errors
- Catches dynamic routes (e.g., `/vendors/123`) that the static route list misses

### Report output
- Markdown file at project root: `ui-crawl-report.md`
- Grouped by route, tagged by phase (load/click/link)
- Lists clean routes at the bottom for quick pass/fail assessment

## Files
- `e2e/ui-crawler.spec.ts` — the crawler
- `e2e/save-auth.ts` — auth state saver
- `e2e/.auth-state.json` — saved cookies
- `playwright.config.ts` — Playwright config
- `ui-crawl-report.md` — latest report output

## Environment notes
- Dev DB: `ep-winter-bar-aitftwjj-pooler` (Neon) — now fully migrated
- Prod DB: `ep-misty-cake-aidno1i9-pooler` (Neon) — different database
- Auth: Zitadel OIDC via Auth.js
- `AUTH_SECRET`, `AUTH_ZITADEL_ISSUER`, `AUTH_ZITADEL_CLIENT_ID` were missing from Vercel's development environment — now added (so future `vercel env pull` won't break auth)
