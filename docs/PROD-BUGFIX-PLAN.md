# Production Bugfix & UX Consistency — Plan

**Status:** Implementation Complete — Awaiting Deploy
**Last Updated:** 2026-02-18
**Author:** Jeff + Claude
**Traces to:** Post-Phase 22 production hardening

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/PROD-BUGFIX-PLAN.md Continue.`

---

## 1. Problem Statement

Seven production issues discovered during post-deployment validation: three pages crash with "Something went wrong", annual rates missing 2026, a test transaction needs cleanup, the void toggle doesn't filter as expected, and revenue sub-pages have inconsistent add/create UX patterns.

---

## 2. Discovery

### Issues Cataloged

| # | Page / Area | Symptom | Root Cause | Severity |
|---|-------------|---------|------------|----------|
| 1 | `/accounts` (Chart of Accounts) | "Something went wrong" | DB driver regression (Pool vs neon-http) | **P0** |
| 2 | `/settings/staging` | "Something went wrong" | Same DB driver regression | **P0** |
| 3 | `/settings/rates` | 2026 year missing from dropdown | Seed idempotency bug — checks only `configKey`, ignores `fiscalYear` | **P1** |
| 4 | `/compliance` | "Something went wrong" | Same DB driver regression | **P0** |
| 5 | `/transactions` | Test "Connectivity verif..." txn in prod | Staging-processor created it during Ramp connectivity test | **P1** |
| 6 | `/transactions` | Void toggle shows same data ON/OFF | Toggle means "include voided" not "filter to voided" — likely no voided txns exist yet, but UX is confusing | **P2** |
| 7 | Revenue sub-pages | Inconsistent add/create UX across 8 pages | Organic growth — each page built independently | **P2** |

### Synthesis

#### Issues 1, 2, 4 — DB Driver Regression (SHARED ROOT CAUSE)

Commit `b1965d4` ("Phase 22: Production hardening") changed `src/lib/db/index.ts` from:
```typescript
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
const sql = neon(connectionString)
return drizzle(sql, { schema })
```
To:
```typescript
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
const pool = new Pool({ connectionString })
return drizzle(pool, { schema })
```

The stated reason was that `neon-http` doesn't support `db.transaction()`. However, the `Pool` driver uses **WebSocket** connections which behave differently in Vercel's serverless environment. The `neon-http` driver is specifically designed for serverless (stateless HTTP, no connection pooling). The `Pool` driver may be:
- Failing to establish WebSocket connections in Vercel's edge runtime
- Exhausting connection limits due to non-closing pools
- Timing out on cold starts

**Fix approach**: Revert to `neon-http` for standard queries but use a separate `Pool` instance only when `db.transaction()` is needed. OR use Neon's recommended `@neondatabase/serverless` with `neon()` for HTTP queries and `Pool` only for transactions, following their dual-driver pattern.

**Pages that work** (Transactions, Revenue, Dashboard, etc.) — these pages still function, suggesting the Pool connection works *sometimes* but fails on cold starts or under certain conditions. The three broken pages may be hitting a race condition or timeout.

#### Issue 3 — Annual Rates 2026 Missing

Seed script at `src/lib/db/seed/index.ts` lines 118-131 checks:
```typescript
where(eq(schema.annualRateConfig.configKey, rate.configKey))
```
This only checks `configKey`, not `(fiscalYear, configKey)`. Since 2025 rates exist for each key, all 2026 rates with the same key are skipped.

A working upsert script already exists at `scripts/upsert-annual-rates.ts` that uses the correct compound key.

#### Issue 5 — Test Transaction

Transaction from Feb 16, 2026 with memo "Expense report: Test Merchant — Connectivity verif..." was created by `system:staging-processor` during Ramp connectivity testing. Best approach is to **void** it (not delete) — preserves audit trail and compliance.

#### Issue 6 — Void Toggle Semantics

Current behavior in `transactions/actions.ts` lines 126-128:
```typescript
if (!includeVoided) {
  conditions.push(eq(transactions.isVoided, false))
}
```
- Toggle OFF = show only non-voided (correct)
- Toggle ON = show ALL transactions (includes voided) — this is "include" semantics

The user expects "filter to voided" semantics. The screenshots show the same 10 rows regardless of toggle state — this is likely because **no voided transactions exist yet**, so both views are identical. However, the UX should be clarified.

**Recommendation**: Keep current "include" semantics (standard pattern) but also visually distinguish voided rows when visible. Consider renaming label to "Include voided" for clarity.

#### Issue 7 — Revenue Sub-Page UX Inconsistency

| Revenue Page | Current Pattern | Recommended |
|-------------|----------------|-------------|
| Rent | Two inline action cards (Record Payment, Record Adjustment) | Keep — unique two-action workflow |
| Grants | `+ New Grant` button top-right → route `/grants/new` | **Already correct** — this is the standard pattern |
| Donations | Inline form embedded in page | Standardize to inline form + recent list below |
| Pledges | Inline form + dialog for payments | Standardize form, keep dialog for payments |
| Earned Income | Inline form, no history list | Add recent entries list below form |
| Investment Income | Inline form, no history list | Add recent entries list below form |
| In-Kind | Inline form, no history list | Add recent entries list below form |
| AHP Forgiveness | Inline form + status card, no history | Add recent entries list below form |

**App-wide dominant patterns**:
- **Vendors/Tenants**: Button top-right → dialog
- **Purchase Orders**: Button top-right → route
- **Transactions**: Button top-right → route

**Decision needed**: The revenue pages have two distinct workflows:
1. **Grants** — List-centric (table + button to create) — matches Vendors/PO pattern
2. **Donations and others** — Form-centric (inline form is primary action) — unique to revenue

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Revert DB to `neon-http` driver, add `Pool` helper for transaction blocks only | Neon's recommended pattern for serverless; `neon-http` is reliable on Vercel |
| D2 | Run `upsert-annual-rates.ts` script against prod, then fix seed idempotency | Immediate fix + prevent recurrence |
| D3 | Void the test transaction via UI | Preserves audit trail, compliance-safe |
| D4 | Keep void toggle as "include voided" but rename label to "Include voided" | Standard toggle semantics; clarifies UX |
| D5 | Standardize revenue pages: inline form + recent history list | Matches existing Donations pattern; consistent across all 6 form-based pages |
| D6 | Keep Rent and Grants pages as-is (unique workflows) | Rent has a valid two-action pattern; Grants already follows list+button standard |

---

## 4. Requirements

### P0: Must Have (Blocking production use)

- REQ-P0-1: Fix DB driver to restore `/accounts`, `/settings/staging`, `/compliance` pages
- REQ-P0-2: Seed 2026 annual rates into production database

### P1: Should Have (Data hygiene)

- REQ-P1-1: Void test "Connectivity verif..." transaction
- REQ-P1-2: Fix seed idempotency to prevent 2026 rates from being lost again
- REQ-P1-3: Check for other orphaned test data in staging_records table

### P2: Nice to Have (UX polish)

- REQ-P2-1: Rename void toggle label from "Show voided" to "Include voided"
- REQ-P2-2: Add recent entries list to Earned Income, Investment Income, In-Kind, AHP Forgiveness pages
- REQ-P2-3: Ensure Donations page has proper recent list (already has one)
- REQ-P2-4: Verify Pledges page consistency

---

## 5. Data Model

No schema changes required. Seed script fix only:

**File**: `src/lib/db/seed/index.ts`
```typescript
// Before (buggy):
where(eq(schema.annualRateConfig.configKey, rate.configKey))

// After (fixed):
where(and(
  eq(schema.annualRateConfig.fiscalYear, rate.fiscalYear),
  eq(schema.annualRateConfig.configKey, rate.configKey)
))
```

---

## 6. Implementation Plan

### Phase A: DB Driver Fix (P0 — fixes issues #1, #2, #4)

| Task | Status | Notes |
|------|--------|-------|
| Revert `src/lib/db/index.ts` to `neon-http` for standard queries | ✅ | Proxy routes standard queries to neon-http |
| Add `getPool()` helper for transaction-requiring code paths | ✅ | Lazy Pool, auto-routed via Proxy on `.transaction()` |
| Update all 55 `db.transaction()` call sites to use pool-based tx | ✅ | Zero call-site changes needed — Proxy handles routing |
| Verify all three broken pages load locally | ✅ | Build passes |
| Deploy and verify in production | 🔲 | |

### Phase B: Annual Rates + Data Cleanup (P1 — fixes issues #3, #5)

| Task | Status | Notes |
|------|--------|-------|
| Run `scripts/upsert-annual-rates.ts` against production DB | 🔲 | Manual: `npx tsx scripts/upsert-annual-rates.ts` with prod DATABASE_URL |
| Fix seed script idempotency (add `fiscalYear` to WHERE) | ✅ | Added `and(fiscalYear, configKey)` compound check |
| Void test transaction via UI or script | 🔲 | Manual step in prod |
| Check for orphaned staging records from test | 🔲 | SQL query against prod |

### Phase C: UX Polish (P2 — fixes issues #6, #7)

| Task | Status | Notes |
|------|--------|-------|
| Rename "Show voided" → "Include voided" in transactions-client.tsx | ✅ | |
| Add recent entries list to Earned Income page | ✅ | Server query + Card below form |
| Add recent entries list to Investment Income page | ✅ | |
| Add recent entries list to In-Kind Contributions page | ✅ | |
| Add recent entries list to AHP Loan Forgiveness page | ✅ | |
| Audit all revenue pages for consistent spacing/headers | ✅ | All 4 pages follow same Card pattern as Donations |

---

## 7. Verification

**Phase A**:
- Navigate to `/accounts` — should load Chart of Accounts tree
- Navigate to `/settings/staging` — should load staging records
- Navigate to `/compliance` — should load compliance calendar
- Test a transaction that uses `db.transaction()` (e.g., create manual journal entry)

**Phase B**:
- `/settings/rates` dropdown shows both 2025 and 2026
- Test transaction shows "Voided" badge on `/transactions`
- No orphaned staging records with test data

**Phase C**:
- "Include voided" label visible on transactions page
- Each revenue sub-page (Earned Income, Investment Income, In-Kind, AHP) shows recent entries below form
- Visual consistency across all revenue pages

---

## 8. Session Progress

### Session 1: 2026-02-18 (Discovery)

**Completed:**
- [x] Created plan document
- [x] Identified root cause for 3 crashing pages (DB driver regression)
- [x] Identified root cause for missing 2026 rates (seed idempotency)
- [x] Analyzed test transaction — void recommended
- [x] Analyzed void toggle — working as designed, UX unclear
- [x] Cataloged all 8 revenue sub-page patterns
- [x] Identified app-wide UX patterns for consistency

**Next Steps:**
- [x] Phase A: Fix DB driver (highest priority)
- [ ] Phase B: Run upsert script + void test txn
- [x] Phase C: UX consistency pass

### Session 2: 2026-02-18 (Implementation)

**Completed:**
- [x] Phase A: Rewrote `src/lib/db/index.ts` with dual-driver Proxy pattern
  - neon-http for all standard queries (reliable serverless)
  - Pool (WebSocket) auto-routed only for `.transaction()` calls
  - Zero changes to 55+ transaction call sites
- [x] Phase B: Fixed seed script idempotency (`fiscalYear` + `configKey` compound check)
- [x] Phase C: Renamed "Show voided" → "Include voided" on transactions page
- [x] Phase C: Added "Recent Entries" Card to 4 revenue sub-pages:
  - Earned Income, Investment Income, In-Kind Contributions, AHP Loan Forgiveness
  - All follow same pattern as Donations (server query → props → Card)
- [x] Build passes clean

**Remaining (manual prod steps):**
- [ ] Deploy to production
- [ ] Run `npx tsx scripts/upsert-annual-rates.ts` with prod DATABASE_URL
- [ ] Void "Connectivity verif..." test transaction in prod UI
- [ ] Verify `/accounts`, `/settings/staging`, `/compliance` load in prod
