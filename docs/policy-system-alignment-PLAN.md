# Policy-System Alignment — Plan

**Status:** Complete
**Last Updated:** 2026-03-01
**Author:** Jeff + Claude
**Traces to:** `docs/financial-policies-procedures.docx` (Board policy document, not yet adopted)

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/policy-system-alignment-PLAN.md Continue.`

---

## 1. Problem Statement

The board-level Financial Policies & Procedures document and the financial system have several gaps and misalignments that need to be resolved before board adoption. Four areas require system changes: audit log append-only enforcement, missing compliance deadlines, asset creation guardrails (capitalization threshold + category-based useful life suggestions), and a prepaid amortization engine.

---

## 2. Discovery

### Questions

1. **Audit log protection**: Should we use a Postgres trigger to block UPDATE/DELETE, or revoke those privileges from the application role? (Trigger is more portable and self-documenting; role-based requires knowing the DB user.)
2. **Prepaid amortization**: Should the amortization engine run on the same monthly cron as depreciation, or be a separate scheduled task? Should it share the same UI pattern (admin action button)?
3. **Prepaid schema**: Do we need a new `prepaid_expenses` table (parallel to `fixed_assets`), or can we extend the existing schema? Prepaids have different fields (benefit period, vendor, renewal date) vs fixed assets (salvage value, PIS date, component parent).
4. **Asset categories for 75 Oliver**: The policy defines component depreciation with specific lives for the Easthampton property. Should these building components be their own asset category entries, or handled separately since they're one-time CIP conversions?
5. **UBIT review deadline**: The policy says ED reviews annually but doesn't specify a date. What month should this deadline fall in — align with Form 990 prep (March/April) or fiscal year-end (December)?

### Responses

1. **Trigger approach** — use a Postgres trigger. Self-documenting, works regardless of which DB role connects, and visible in migrations. The trigger should raise an exception on UPDATE or DELETE of `audit_log`.
2. **Same cron pattern as depreciation** — monthly run via admin action + future cron. Prepaids amortize monthly on straight-line just like depreciation. Share the UI pattern (button on the assets page, "Run Monthly Amortization").
3. **New `prepaid_expenses` table** — the fields are different enough (benefit start/end, monthly amortization amount, vendor, remaining balance) that sharing `fixed_assets` would be awkward. Parallel table with its own engine.
4. **Building components as asset categories** — include them in the category config. When assets come from CIP conversion, the wizard already sets useful life; the category config provides a second validation layer and covers any manually-created building component assets.
5. **UBIT review in December** — align with annual grant compliance review (Dec 31) so all year-end compliance reviews cluster together.

### Synthesis

Four independent workstreams, no cross-dependencies. All are additive (no breaking changes to existing data or APIs). The prepaid engine is the largest piece; the others are small targeted changes.

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Postgres trigger to enforce append-only audit log | Self-documenting, role-agnostic, visible in migration history |
| D2 | New `prepaid_expenses` table (not extending `fixed_assets`) | Different field set: benefit period, vendor, remaining balance vs salvage value, PIS, component parent |
| D3 | Asset category config as a TypeScript constant (not DB table) | Categories come from board policy — rarely change, don't need admin UI. Code constant is simpler and version-controlled. |
| D4 | Soft enforcement (Option B) for useful life | Auto-fill from category + amber warning on deviation. Allows override for edge cases (equipment 7-10 year range). |
| D5 | $2,500 capitalization threshold as named constant | Referenced by both fixed asset and prepaid validators. Single source of truth. |
| D6 | Prepaid amortization engine mirrors depreciation engine pattern | Same monthly straight-line calculation, same idempotency check, same admin action UI |

---

## 4. Requirements

### P0: Must Have

- REQ-01: Audit log table protected by DB trigger — UPDATE and DELETE raise exceptions
- REQ-02: MA Secretary of State Annual Report deadline (Nov 1) added to deadline generator
- REQ-03: UBIT annual review deadline (Dec 31) added to deadline generator
- REQ-04: Asset category dropdown on create-asset dialog with policy-defined useful lives
- REQ-05: Auto-fill useful life months + GL accounts when category selected
- REQ-06: Amber warning when useful life deviates from policy default
- REQ-07: $2,500 capitalization threshold warning when cost < threshold
- REQ-08: `prepaid_expenses` table with benefit period, amortization tracking
- REQ-09: Monthly amortization engine (straight-line, idempotent)
- REQ-10: Amortization GL entries: debit expense account, credit prepaid asset (1200)

### P1: Nice to Have

- REQ-11: Category-based GL account suggestions (e.g., "Computer" → 1700 Equipment + 1830 Accum Depr)
- REQ-12: Prepaid list view on `/assets/prepaid` page (currently exists but may need updates)

### P2: Future

- REQ-13: Prepaid renewal reminders (notify before benefit period expires)
- REQ-14: Asset category stored on fixed_assets record for reporting

---

## 5. Data Model

### Migration: Audit log trigger

```sql
-- Prevent modification or deletion of audit log records
CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only: % operations are not permitted', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
  BEFORE UPDATE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
  BEFORE DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_mutation();
```

### Migration: `prepaid_expenses` table

```sql
CREATE TABLE prepaid_expenses (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  vendor VARCHAR(255),
  payment_date DATE NOT NULL,
  total_amount NUMERIC(15,2) NOT NULL,
  benefit_start_date DATE NOT NULL,
  benefit_end_date DATE NOT NULL,
  monthly_amount NUMERIC(15,2) NOT NULL,    -- total / months
  amortized_to_date NUMERIC(15,2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(15,2) NOT NULL, -- total - amortized
  gl_prepaid_account_id INTEGER NOT NULL REFERENCES accounts(id),
  gl_expense_account_id INTEGER NOT NULL REFERENCES accounts(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);
```

### Asset category config (TypeScript constant)

```typescript
// src/lib/assets/asset-categories.ts
export const CAPITALIZATION_THRESHOLD = 2500

export const ASSET_CATEGORIES = [
  // 75 Oliver Street — component depreciation
  { key: 'building_structure', label: 'Building - Structural Elements', usefulLifeMonths: 540, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_roof', label: 'Building - Roof', usefulLifeMonths: 360, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_hvac', label: 'Building - HVAC', usefulLifeMonths: 240, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_electrical', label: 'Building - Electrical', usefulLifeMonths: 240, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_plumbing', label: 'Building - Plumbing', usefulLifeMonths: 240, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_windows', label: 'Building - Windows', usefulLifeMonths: 300, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_flooring_hard', label: 'Building - Flooring (Hard Surface)', usefulLifeMonths: 180, glAssetCode: '1600', glAccumDeprCode: '1800' },
  { key: 'building_flooring_soft', label: 'Building - Flooring (Carpet/Soft)', usefulLifeMonths: 84, glAssetCode: '1600', glAccumDeprCode: '1800' },
  // General assets
  { key: 'computer', label: 'Computer / Technology Equipment', usefulLifeMonths: 60, glAssetCode: '1700', glAccumDeprCode: '1830' },
  { key: 'vehicle', label: 'Vehicle', usefulLifeMonths: 84, glAssetCode: '1700', glAccumDeprCode: '1830' },
  { key: 'equipment', label: 'Equipment / Machinery', usefulLifeMonths: 84, usefulLifeMaxMonths: 120, glAssetCode: '1700', glAccumDeprCode: '1830' },
  { key: 'furniture', label: 'Furniture & Fixtures', usefulLifeMonths: 120, glAssetCode: '1700', glAccumDeprCode: '1830' },
  { key: 'intangible', label: 'Intangible (Software License)', usefulLifeMonths: 36, usefulLifeMaxMonths: 60, glAssetCode: '1700', glAccumDeprCode: '1830' },
  { key: 'other', label: 'Other', usefulLifeMonths: null, glAssetCode: null, glAccumDeprCode: null },
] as const
```

---

## 6. Implementation Plan

### Phase 1: Audit Log Protection + Compliance Deadlines

| Task | Status | Notes |
|------|--------|-------|
| Create migration for audit_log triggers (prevent UPDATE/DELETE) | ✅ | REQ-01 — `0022_audit_log_append_only.sql` |
| Add MA SOS Annual Report (Nov 1) to `ANNUAL_DEADLINES` | ✅ | REQ-02 |
| Add UBIT annual review (Dec 31) to `ANNUAL_DEADLINES` | ✅ | REQ-03 |

### Phase 2: Asset Category Config + Capitalization Threshold

| Task | Status | Notes |
|------|--------|-------|
| Create `src/lib/assets/asset-categories.ts` with category config + threshold constant | ✅ | D3, D5 |
| Add asset category `<Select>` to `create-asset-dialog.tsx` | ✅ | REQ-04 — grouped by building component / general |
| Wire auto-fill: category → useful life months + GL account suggestions | ✅ | REQ-05, REQ-11 |
| Add amber warning when useful life deviates from category default | ✅ | REQ-06 |
| Add capitalization threshold warning when cost < $2,500 | ✅ | REQ-07 — on both fixed asset + prepaid dialogs |
| Add threshold validation to `insertFixedAssetSchema` (warning, not block) | ✅ | REQ-07 — client-side warning (not server block) |

### Phase 3: Prepaid Amortization Engine

| Task | Status | Notes |
|------|--------|-------|
| Create migration for `prepaid_expenses` table | ✅ | REQ-08 — already existed (prior phase) |
| Create Drizzle schema `src/lib/db/schema/prepaid-expenses.ts` | ✅ | REQ-08 — already existed as `prepaid-schedules.ts` |
| Create validator `src/lib/validators/prepaid-expenses.ts` | ✅ | Already existed in validators barrel |
| Create amortization engine `src/lib/assets/prepaid-amortization.ts` | ✅ | REQ-09, REQ-10 — already existed with full engine |
| Create server action for running monthly amortization | ✅ | `runPrepaidAmortization` in `prepaid-actions.ts` |
| Update `/assets/prepaid` page with list view + "Run Amortization" button | ✅ | REQ-12 — button + threshold warning added |
| Create "Add Prepaid Expense" dialog | ✅ | Already existed in `prepaid-client.tsx` |

---

## 7. Verification

| Check | Method |
|-------|--------|
| Audit log append-only | Attempt `DELETE FROM audit_log` and `UPDATE audit_log SET ...` in psql — both should raise exceptions |
| New compliance deadlines | Run `generateAnnualDeadlines(2026)` and verify MA SOS (Nov 1) and UBIT (Dec 31) appear |
| Asset category auto-fill | Create asset, select "Computer" → verify useful life auto-fills to 60 months |
| Useful life warning | Select "Computer", change useful life to 48 → verify amber warning appears |
| Capitalization warning | Enter cost of $1,500 → verify amber warning about $2,500 threshold |
| Prepaid creation | Create a $6,000 prepaid with 12-month benefit → verify monthly amount = $500 |
| Prepaid amortization | Run monthly amortization → verify GL entry: debit expense, credit 1200, $500 |
| Idempotency | Run amortization twice for same month → verify no duplicate entries |

---

## 8. Session Progress

### Session 1: 2026-03-01 (Discovery + Planning)

**Completed:**
- [x] Read and compared `financial-policies-procedures.docx` against system config
- [x] Identified 6 discrepancies (2 conflicts, 4 gaps)
- [x] User decisions: skip half-year convention (update policy instead), skip bad debt workflow
- [x] User selected Option B (suggest + warn) for asset category useful lives
- [x] Created plan document

**Next Steps:**
- [x] Phase 1: Audit log trigger + compliance deadlines
- [x] Phase 2: Asset category config + capitalization threshold
- [x] Phase 3: Prepaid amortization engine

### Session 2: 2026-03-01 (Build — All Phases)

**Completed:**
- [x] Phase 1: Created `0022_audit_log_append_only.sql` — Postgres trigger blocks UPDATE/DELETE on `audit_log`
- [x] Phase 1: Added MA SOS Annual Report (Nov 1) and UBIT annual review (Dec 31) to `deadline-generator.ts`
- [x] Phase 2: Created `src/lib/assets/asset-categories.ts` — 14 categories, $2,500 threshold, deviation checker
- [x] Phase 2: Added asset category `<Select>` to `create-asset-dialog.tsx` with grouped building/general categories
- [x] Phase 2: Wired auto-fill: category → useful life months + GL asset/accum-depr accounts
- [x] Phase 2: Added amber warnings for useful life deviation and capitalization threshold
- [x] Phase 3: Discovered prepaid engine already exists (schema, engine, actions, UI)
- [x] Phase 3: Added `runPrepaidAmortization` server action wrapping `generateAmortizationEntries`
- [x] Phase 3: Added "Run Amortization" button to prepaid page
- [x] Phase 3: Added $2,500 capitalization threshold warning to prepaid create dialog
- [x] TypeScript compiles clean — no errors

**Files Created:**
- `src/lib/db/migrations/0022_audit_log_append_only.sql`
- `src/lib/assets/asset-categories.ts`

**Files Modified:**
- `src/lib/compliance/deadline-generator.ts` — +2 deadlines
- `src/app/(protected)/assets/create-asset-dialog.tsx` — category dropdown + auto-fill + warnings
- `src/app/(protected)/assets/prepaid-actions.ts` — `runPrepaidAmortization` action
- `src/app/(protected)/assets/prepaid/prepaid-client.tsx` — Run Amortization button + threshold warning

**Verification Needed:**
- Apply migration 0022 and test `DELETE FROM audit_log` raises exception
- Test asset category auto-fill in browser
- Test useful life warning in browser
- Test capitalization warning on both fixed asset and prepaid dialogs
- Test Run Amortization button
