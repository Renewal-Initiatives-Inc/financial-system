# Revenue Classification & Funding Source Taxonomy — Plan

**Status:** In Progress — Phase 5 DONE, ready for Phase 6
**Last Updated:** 2026-02-27
**Author:** Jeff + Claude
**Traces to:** Pre-flight checklist (Heather) — revenue account hardcoding gap; funding source UX cleanup

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/revenue-classification-PLAN.md Continue.`

---

## 1. Problem Statement

### 1a. Revenue Classification (Phases 1–4, DONE)

The funding source creation flow uses AI to extract milestones/terms/covenants from uploaded contracts, but never determines whether the revenue is **Grant Revenue (4100)** or **Earned Income (4300)**. All restricted funding source revenue currently hardcodes to 4100. This needs to be a decision point at fund setup, powered by the AI contract extraction that already exists.

### 1b. Funding Source Taxonomy (Phases 5–8)

Several gaps surfaced during smoke testing:

1. **No funding category dimension.** The system has restriction (RESTRICTED/UNRESTRICTED) and revenue classification (GRANT_REVENUE/EARNED_INCOME) but no way to distinguish grants from contracts from loans. These have different accounting treatments, compliance requirements, and GL routing.

2. **Unrestricted grants aren't first-class citizens.** The creation form gates all detail fields (funder, contract upload, dates, covenants, compliance) behind `restrictionType === 'RESTRICTED'`. An unrestricted operating grant still has a funder, a contract, reporting requirements, and should credit 4100 — but the current UI treats unrestricted as "General Fund, done."

3. **AHP loan is a hardcoded singleton.** The AHP loan is implemented as a separate `ahp_loan_config` table with its own schema, GL logic, UI pages, and reports (~20 files). This should be a regular funding source created through the standard flow.

4. **"Fund" vs "Funding Source" confusion.** The revenue section uses "Funding Sources" consistently but ~30 labels elsewhere say "Fund." Users think in terms of "funding sources" (grants, contracts, loans) not "funds" (GL accounting concept).

---

## 2. Discovery

### Questions (Phases 1–4)

1. Are there any existing restricted funds that should be classified as Earned Income (4300) rather than Grant Revenue (4100)?
2. Should the classification be editable after initial setup, or locked once transactions have posted against the fund?
3. Does the AR invoicing path in `actions.ts` also need revenue account routing, or is it only the two GL functions in `funding-sources.ts`?
4. Should the migration backfill default `GRANT_REVENUE` for all existing restricted funds, or leave them `NULL` and prompt reclassification?
5. For Form 990 purposes — does the classification rationale text need to follow a specific format, or is free-text sufficient?

### Responses (Phases 1–4)

1. **All current restricted funds are grants** — backfill to `GRANT_REVENUE` is correct.
2. **TBD** — suggest: editable until first revenue transaction posts, then read-only with warning.
3. Confirmed: two GL functions (`recordUnconditionalFunding` at line 18, `recognizeConditionalRevenue` at line 169) credit 4100. Cash receipt functions (lines 68, 119) only touch Cash/AR/Refundable Advance — no revenue account, so no change needed.
4. Backfill `GRANT_REVENUE` — all current funds are grants per bookkeeper confirmation.
5. Free-text is fine — the AI generates 2-3 sentences, user can override/append.

### Questions (Phases 5–8)

6. Can grants be unrestricted? → **Yes.** General operating grants, capacity-building grants, unrestricted foundation grants are common. An unrestricted grant still has a funder, may have a contract, and credits 4100 (Grant Revenue).
7. Should "Grant" and "Contract" be collapsed into one category? → **No.** Per Jeff: grants (no direct value returned to funder, ASC 958) and contracts (value exchanged, ASC 606) have different core meanings. Keep separate.
8. Where does the user change interest rates on loans? → **No UI exists.** AHP rate is seeded. `annualRateConfig` table has rate history infrastructure but is AHP-specific and has no user-facing interface.
9. Should loans route through Funding Sources? → **Yes.** Every external financial instrument (grant, contract, loan) enters through Revenue > Funding Sources. Loans differ in GL routing (asset+liability, not revenue).

### Synthesis (Phases 5–8)

Add a `fundingCategory` dimension (GRANT, CONTRACT, LOAN) orthogonal to restriction. Restructure the creation form so all categories get the full treatment (funder, contract upload, covenants, compliance calendar) regardless of restriction. Tear down AHP singleton so it can be recreated as a proper funding source. Standardize UI labels on "Funding Source."

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add `revenueClassificationEnum` as Postgres enum (`GRANT_REVENUE`, `EARNED_INCOME`) | Matches existing enum pattern in `enums.ts`; DB-level constraint prevents invalid values |
| D2 | Revenue columns nullable — only relevant for GRANT and CONTRACT categories | LOAN sources don't generate revenue; null signals "not applicable" |
| D3 | AI recommends classification, user confirms in same form | No extra step — appears after contract extraction completes, pre-selected with rationale |
| D4 | Store `classificationRationale` as text (not JSON) | Simple audit trail; no structured queries needed on this field |
| D5 | Backfill existing funds with `GRANT_REVENUE` in migration | All current restricted funds are grants per bookkeeper; avoids null-handling edge cases in existing GL logic |
| D6 | Revenue account lookup by classification, not hardcoded | `GRANT_REVENUE` → `4100`, `EARNED_INCOME` → `4300`; both accounts exist in seed data (confirmed) |
| D7 | Manual selection when no contract uploaded | User picks from two radio buttons; no AI recommendation shown |
| D8 | Add `fundingCategoryEnum` (GRANT, CONTRACT, LOAN) — orthogonal to restriction | Grants can be restricted or unrestricted. Contracts are typically restricted. Loans create liability, not revenue. Each has different GL routing and compliance needs |
| D9 | Show funder, contract upload, amount, dates, reporting for ALL categories | Unrestricted grants still have a funder and may have contracts. Decouples rich funding source features from restriction-only gating |
| D10 | Funder required for all funding sources (not just restricted) | Every funding source has a counterparty — funder for grants, contracting party for contracts, lender for loans |
| D11 | Revenue classification auto-defaults from category | GRANT → GRANT_REVENUE, CONTRACT → EARNED_INCOME. AI or user can override. LOAN → null (not revenue) |
| D12 | List page filters to non-system-locked funds | General Fund is the only system-locked fund. It's a default bucket, not a user-created funding source |
| D13 | AHP singleton teardown — remove `ahp_loan_config` and all AHP-specific code | AHP will be recreated as a proper funding source through the standard flow. Keeps account 2500 (AHP Loan Payable) |
| D14 | Standardize UI labels on "Funding Source" | Keep accounting terms (General Fund, Fund Balance, Fund Accounting) unchanged. Update ~30 form labels/column headers across 23 files |

---

## 4. Requirements

### P0: Must Have (Phases 1–4 — DONE)

- REQ-RC-1: New `revenueClassificationEnum` in `enums.ts` ✅
- REQ-RC-2: `revenueClassification` + `classificationRationale` columns on `funds` table ✅
- REQ-RC-3: AI extraction returns classification + rationale alongside existing terms ✅
- REQ-RC-4: Funding source creation form shows classification section (AI-recommended or manual) ✅
- REQ-RC-5: Revenue GL functions use fund classification to select credit account (4100 or 4300) ✅
- REQ-RC-6: Server action persists classification and rationale ✅
- REQ-RC-7: Detail page displays classification and rationale (read-only) ✅
- REQ-RC-8: Drizzle migration with backfill ✅

### P0: Must Have (Phases 5–6)

- REQ-FS-1: New `fundingCategoryEnum` in `enums.ts` (GRANT, CONTRACT, LOAN)
- REQ-FS-2: `fundingCategory` column on `funds` table (nullable)
- REQ-FS-3: Form restructure — category selector shown for all sources, detail fields gated by category not restriction
- REQ-FS-4: Funder required for all funding sources regardless of restriction
- REQ-FS-5: Revenue classification auto-defaults from category (overridable)
- REQ-FS-6: List page excludes system-locked funds, shows category badge
- REQ-FS-7: List page status display fix — `isActive` as primary, `status` as secondary badge
- REQ-FS-8: Migration with backfill (existing restricted → GRANT)
- REQ-FS-9: AI extraction recommends category alongside classification
- REQ-FS-10: AHP singleton teardown — remove ahp_loan_config table and ~20 associated files
- REQ-FS-11: Migration to DROP TABLE ahp_loan_config

### P1: Nice to Have (Phases 7)

- REQ-FS-12: UI terminology — "Fund" → "Funding Source" across ~23 files (~30 labels)
- REQ-FS-13: Help terms glossary update — add "funding-source" entry, clarify "fund"
- REQ-FS-14: Copilot context updates for terminology consistency
- REQ-RC-9: Override note capture when user changes AI recommendation ✅ (done in Phase 3)
- REQ-RC-10: Validator refinement — require classification when category is GRANT or CONTRACT

### P2: Future (Phase 8)

- REQ-FS-15: Loan GL routing — DR Cash, CR Loan Payable (not revenue accounts)
- REQ-FS-16: Interest rate tracking on funding sources (extend `annualRateConfig` pattern)
- REQ-FS-17: Rate change UI — history timeline, "as of" date, reason, audit log
- REQ-FS-18: Amortization schedule generator
- REQ-RC-11: Reclassification workflow (change classification after setup, with journal entry adjustment)
- REQ-RC-12: Form 990 report integration pulling classification rationale

---

## 5. Data Model

### Existing (Phases 1–4)

```ts
// enums.ts
export const revenueClassificationEnum = pgEnum('revenue_classification', [
  'GRANT_REVENUE',
  'EARNED_INCOME',
])

// funds.ts columns
revenueClassification: revenueClassificationEnum('revenue_classification'),
classificationRationale: text('classification_rationale'),
```

### New (Phase 5)

```ts
// enums.ts
export const fundingCategoryEnum = pgEnum('funding_category', [
  'GRANT',
  'CONTRACT',
  'LOAN',
])

// funds.ts — new column
fundingCategory: fundingCategoryEnum('funding_category'),
```

### Migration (`drizzle/0017_funding_category.sql`)

```sql
CREATE TYPE "funding_category" AS ENUM ('GRANT', 'CONTRACT', 'LOAN');
ALTER TABLE "funds" ADD COLUMN "funding_category" "funding_category";
-- Backfill: all existing restricted funds are grants
UPDATE "funds" SET "funding_category" = 'GRANT'
  WHERE "restriction_type" = 'RESTRICTED';
```

### AI extraction return type addition

```ts
export type ExtractedTerms = {
  milestones: ExtractedMilestone[]
  paymentTerms: ExtractedPaymentTerm[]
  deliverables: string[]
  covenants: ExtractedCovenant[]
  revenueClassification: 'GRANT_REVENUE' | 'EARNED_INCOME'
  classificationRationale: string
  // NEW
  fundingCategory: 'GRANT' | 'CONTRACT' | 'LOAN'
}
```

---

## 6. Implementation Plan

### Phase 1: Schema + Migration ✅

| Task | Status | Notes |
|------|--------|-------|
| Add `revenueClassificationEnum` to `src/lib/db/schema/enums.ts` | ✅ | |
| Add two columns to `funds` table in `src/lib/db/schema/funds.ts` | ✅ | |
| Update `src/lib/validators/funds.ts` — add fields to `insertFundingSourceSchema` | ✅ | |
| Write migration SQL `drizzle/0016_revenue_classification.sql` | ✅ | Manual — drizzle-kit generate was interactive |
| Add backfill SQL to migration (existing restricted funds → `GRANT_REVENUE`) | ✅ | |
| Update `src/lib/db/schema/schema.test.ts` — test new columns | ✅ | 33/33 pass |
| Update seed data in `src/lib/db/seed/funds.ts` | ✅ | All restricted funds → `GRANT_REVENUE` |

### Phase 2: AI Extraction Enhancement ✅

| Task | Status | Notes |
|------|--------|-------|
| Extend `EXTRACTION_PROMPT` in `src/lib/ai/contract-extraction.ts` | ✅ | ASC 958-605 vs ASC 606 assessment added |
| Update `ExtractedTerms` type with `revenueClassification` + `classificationRationale` | ✅ | |
| Update JSON parse to extract new fields with safe defaults | ✅ | Default `GRANT_REVENUE` if AI doesn't return a value |
| Update `src/components/shared/contract-upload-extract.tsx` — emit classification data | ✅ | Also updated `ContractExtractionData` interface |

### Phase 3: UI + Server Action ✅

| Task | Status | Notes |
|------|--------|-------|
| Add classification section to `create-funding-source-client.tsx` | ✅ | RadioGroup with AI pre-selection |
| Wire classification into form state + submission | ✅ | Override appends `[User override]` to rationale |
| Update `createFundingSource()` in `actions.ts` (~line 678) | ✅ | |
| Update `funding-source-detail-client.tsx` — read-only display | ✅ | Card above contract terms |

### Phase 4: Revenue GL Logic ✅

| Task | Status | Notes |
|------|--------|-------|
| Create helper: `getRevenueAccountCode(fundId)` in `src/lib/revenue/funding-sources.ts` | ✅ | Lookup fund → return `'4100'` or `'4300'` |
| Update `recordUnconditionalFunding()` — use helper instead of hardcoded `'4100'` | ✅ | |
| Update `recognizeConditionalRevenue()` — use helper instead of hardcoded `'4100'` | ✅ | |
| Update `createArInvoice()` in `actions.ts` — use classification instead of hardcoded `'4100'` | ✅ | Discovered 3rd hardcoded reference |
| Fallback: if classification is null, default to `'4100'` (backwards compat) | ✅ | Built into helper |

### Phase 5: Funding Category + Form Restructure ✅

| Task | Status | Notes |
|------|--------|-------|
| Add `fundingCategoryEnum` to `src/lib/db/schema/enums.ts` | ✅ | GRANT, CONTRACT, LOAN |
| Add `fundingCategory` column to `src/lib/db/schema/funds.ts` | ✅ | Nullable — null for General Fund |
| Update `src/lib/validators/funds.ts` — add `fundingCategory`, make funder required for all | ✅ | Remove restriction-only gating on `funderId` |
| Write migration SQL `drizzle/0017_funding_category.sql` | ✅ | Backfill existing restricted → GRANT |
| Update seed data in `src/lib/db/seed/funds.ts` — add `fundingCategory` | ✅ | All restricted seeds → GRANT |
| Restructure `create-funding-source-client.tsx` — category selector, decouple detail fields | ✅ | Category + restriction always shown; detail fields gated by category |
| Revenue classification auto-default from category (GRANT→GRANT_REVENUE, CONTRACT→EARNED_INCOME) | ✅ | LOAN hides classification entirely |
| Update `createFundingSource()` in `actions.ts` — persist category | ✅ | |
| Update `getFundingSources()` in `actions.ts` — exclude system-locked funds | ✅ | `WHERE isSystemLocked = false` |
| Update list page — add category badge, fix status display | ✅ | `isActive` primary; `status` secondary badge; inactive dimmed |
| Update detail page — show category | ✅ | |
| Update AI extraction — recommend category alongside classification | ✅ | Extend prompt + types + parser |
| Update `contract-upload-extract.tsx` — emit category data | ✅ | |
| Update `src/lib/db/schema/schema.test.ts` — test new column | ✅ | 35/35 pass |
| Update copilot context `src/lib/copilot/contexts/revenue.ts` | ✅ | Mention category dimension |
| Enforce unrestricted fund GL posting rule across all fund selectors | ✅ | 7 locations: transactions, revenue, expenses, ramp, vendors, bank-rec, assets |

### Phase 6: AHP Singleton Teardown

| Task | Status | Notes |
|------|--------|-------|
| Delete `src/lib/db/schema/ahp-loan-config.ts` | | Remove from schema index too |
| Delete `src/lib/db/seed/ahp-loan-config.ts` | | Remove from seed index too |
| Delete `src/lib/revenue/ahp-loan.ts` | | Has bug: debits 2100 instead of 2500 |
| Remove AHP imports + actions from `src/app/(protected)/revenue/actions.ts` | | `getAhpLoanStatus`, `getRecentAhpForgiveness` |
| Delete `src/app/(protected)/revenue/ahp-forgiveness/` directory | | 2 files |
| Delete `src/app/(protected)/reports/ahp-loan-summary/` directory | | 2 files |
| Delete `src/app/(protected)/reports/ahp-annual-package/` directory | | 2 files |
| Delete `src/lib/reports/ahp-loan-summary.ts` | | |
| Delete `src/lib/reports/ahp-annual-package.ts` | | |
| Remove AHP references from `src/lib/reports/cash-position.ts` | | Imports ahpLoanConfig |
| Remove AHP help terms from `src/lib/help/terms.ts` | | Lines 191-236 |
| Update `src/lib/copilot/contexts/revenue.ts` — remove AHP mention | | |
| Remove AHP test cases from `src/lib/reports/__tests__/phase16-reports.test.ts` | | Lines 52, 91 |
| Remove `ahpLoanForgivenessSchema` from `src/lib/validators/revenue.ts` | | |
| Update `src/lib/assets/interest-accrual.ts` — remove AHP-specific logic | | Keep generic interest accrual if possible |
| Update `src/lib/bank-rec/gl-only-categories.ts` — remove AHP entries | | If present |
| Write migration: `DROP TABLE ahp_loan_config` | | Keep account 2500 (AHP Loan Payable) |
| Update copilot knowledge files — remove AHP references | | `restricted-funds.txt`, `net-asset-releases.txt` |
| TypeScript: 0 errors after teardown | | |
| All existing tests pass after teardown | | |

### Phase 7: UI Terminology Standardization (P1)

| Task | Status | Notes |
|------|--------|-------|
| Transaction forms — "Fund" → "Funding Source" | | journal-entry-form.tsx, edit-transaction-form.tsx, inline-gl-entry-dialog.tsx |
| Expense/PO forms — "Fund" → "Funding Source" | | create-po-form.tsx, columns.tsx, po-detail-client.tsx, po-list-client.tsx |
| Ramp categorization — "Fund" → "Funding Source" | | categorize-dialog.tsx, bulk-categorize-dialog.tsx, rules dialogs, columns |
| Revenue entry forms — "Fund" → "Funding Source" | | donations, earned-income, pledges, in-kind, rent payment/adjustment |
| Budget forms — "Fund" → "Funding Source" | | budget-edit-client.tsx, budget-review-client.tsx |
| Prepaid form — "Fund" → "Funding Source" | | prepaid-client.tsx |
| Report filters — "Fund" → "Funding Source" | | ~8 report pages with fund filter/badge |
| Vendor forms — "Default Fund" → "Default Funding Source" | | create-vendor-dialog.tsx, vendor-detail-client.tsx |
| Settings/staging — "Fund" → "Funding Source" | | staging columns.tsx |
| Help terms — add "funding-source" glossary entry | | src/lib/help/terms.ts |
| Copilot contexts — update terminology | | revenue.ts, funds.ts |
| **DO NOT change:** General Fund, Fund Balance, Fund Accounting, Fund Allocation, Fund-Level P&L | | Correct accounting terms |

### Phase 8: Loan GL Logic + Interest Rate Tracking (P2 — Future)

| Task | Status | Notes |
|------|--------|-------|
| Loan GL routing — DR Cash, CR Loan Payable (not revenue) | | New GL function in funding-sources.ts |
| Loan repayment GL — DR Loan Payable, CR Cash | | |
| Extend `annualRateConfig` with `fundId` column | | Or create `fundingSourceRateHistory` table |
| Rate change UI — modal with effective date + reason | | On funding source detail page |
| Rate history timeline on detail page | | Reuse AHP loan summary pattern |
| Interest accrual generalization — use fund-specific rate | | Extend existing interest-accrual.ts |
| Amortization schedule generator | | |

---

## 7. Verification

### Phases 1–4 (DONE)

| Check | Method |
|-------|--------|
| Schema columns exist after migration | `npx drizzle-kit push` or `generate` + apply; verify in DB |
| AI extraction returns classification | Upload a sample contract, inspect extraction response |
| UI shows classification section | Create a new funding source with contract upload; verify radio pre-selected |
| UI manual path works | Create funding source without contract; verify manual radio selection |
| GL routes to 4100 for grants | Create GRANT_REVENUE fund, record unconditional funding, verify journal entry credits 4100 |
| GL routes to 4300 for earned income | Create EARNED_INCOME fund, record unconditional funding, verify journal entry credits 4300 |
| Conditional revenue recognition uses classification | Record conditional cash, then recognize revenue — verify credit account matches classification |
| Detail page shows classification | View funding source detail, confirm classification + rationale displayed |
| Existing funds backfilled | After migration, check existing restricted funds have `GRANT_REVENUE` |
| Schema tests pass | `npm test -- schema.test.ts` |

### Phases 5–6

| Check | Method |
|-------|--------|
| Category column exists after migration | Apply `drizzle/0017_funding_category.sql`; verify in DB |
| Existing restricted funds backfilled to GRANT | `SELECT funding_category FROM funds WHERE restriction_type = 'RESTRICTED'` |
| General Fund has no category | `SELECT funding_category FROM funds WHERE name = 'General Fund'` → null |
| Create unrestricted GRANT funding source | Full treatment: funder, contract upload, covenants, revenue classification |
| Create restricted CONTRACT funding source | AI recommends EARNED_INCOME; category = CONTRACT |
| List page excludes General Fund | Navigate to Funding Sources list; General Fund not shown |
| List page shows category badges | Each row shows GRANT/CONTRACT/LOAN badge |
| Status display uses isActive primary | Active/Inactive indicator; status as secondary badge |
| AI extraction recommends category | Upload contract; verify category recommendation |
| AHP table dropped | `SELECT * FROM ahp_loan_config` → table does not exist |
| No AHP UI pages accessible | Navigate to /revenue/ahp-forgiveness → 404 |
| No AHP report pages accessible | Navigate to /reports/ahp-loan-summary → 404 |
| TypeScript: 0 errors | `npx tsc --noEmit` |
| All existing tests pass | `npm test` |

---

## 8. Files to Touch

### Phases 1–4 (DONE)

| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add `revenueClassificationEnum` ✅ |
| `src/lib/db/schema/funds.ts` | Add `revenueClassification` + `classificationRationale` columns ✅ |
| `src/lib/ai/contract-extraction.ts` | Extend prompt, return type, and parser ✅ |
| `src/lib/validators/funds.ts` | Add fields to `insertFundingSourceSchema` ✅ |
| `src/components/shared/contract-upload-extract.tsx` | Emit classification data to parent ✅ |
| `src/app/(protected)/revenue/funding-sources/new/create-funding-source-client.tsx` | Classification UI section ✅ |
| `src/app/(protected)/revenue/actions.ts` | Persist classification in `createFundingSource()` ✅ |
| `src/lib/revenue/funding-sources.ts` | Revenue account routing helper; update two GL functions ✅ |
| `src/app/(protected)/revenue/funding-sources/[id]/funding-source-detail-client.tsx` | Read-only classification display ✅ |
| `src/lib/db/schema/schema.test.ts` | Test new columns ✅ |
| `src/app/(protected)/expenses/purchase-orders/new/create-po-form.tsx` | Added new `ContractExtractionData` fields to initial state ✅ |
| `drizzle/0016_revenue_classification.sql` | Migration with backfill ✅ |

### Phase 5: Funding Category + Form Restructure ✅

| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add `fundingCategoryEnum` ✅ |
| `src/lib/db/schema/funds.ts` | Add `fundingCategory` column ✅ |
| `src/lib/validators/funds.ts` | Add `fundingCategory`; make funder required for all ✅ |
| `drizzle/0017_funding_category.sql` | Migration with backfill ✅ |
| `src/lib/db/seed/funds.ts` | Add `fundingCategory: 'GRANT'` to restricted seeds ✅ |
| `src/app/(protected)/revenue/funding-sources/new/create-funding-source-client.tsx` | Restructure form — category selector, decouple from restriction ✅ |
| `src/app/(protected)/revenue/actions.ts` | Persist category; filter getFundingSources(); GL posting rule ✅ |
| `src/app/(protected)/revenue/funding-sources/page.tsx` | Category badge, status fix, inactive dimming ✅ |
| `src/app/(protected)/revenue/funding-sources/[id]/funding-source-detail-client.tsx` | Show category; ungate sections from restriction-only ✅ |
| `src/lib/ai/contract-extraction.ts` | Add category to extraction prompt + types + parser ✅ |
| `src/components/shared/contract-upload-extract.tsx` | Emit category data ✅ |
| `src/app/(protected)/expenses/purchase-orders/new/create-po-form.tsx` | Add `fundingCategory: null` to initial state ✅ |
| `src/lib/db/schema/schema.test.ts` | Test new column (35/35) ✅ |
| `src/lib/copilot/contexts/revenue.ts` | Update context with category dimension ✅ |
| `src/app/(protected)/transactions/actions.ts` | Fund selector: filter to General Fund + restricted only ✅ |
| `src/app/(protected)/expenses/actions.ts` | Fund selector: filter to General Fund + restricted only ✅ |
| `src/app/(protected)/expenses/ramp/actions.ts` | Fund selector: filter to General Fund + restricted only ✅ |
| `src/app/(protected)/vendors/actions.ts` | Fund selector: filter to General Fund + restricted only ✅ |
| `src/app/(protected)/bank-rec/page.tsx` | Fund selector: filter to General Fund + restricted only ✅ |
| `src/app/(protected)/assets/actions.ts` | Fund selector: filter to General Fund + restricted only ✅ |

### Phase 6: AHP Singleton Teardown

| File | Change |
|------|--------|
| `src/lib/db/schema/ahp-loan-config.ts` | DELETE |
| `src/lib/db/schema/index.ts` | Remove ahp-loan-config export |
| `src/lib/db/seed/ahp-loan-config.ts` | DELETE |
| `src/lib/db/seed/index.ts` | Remove ahp-loan-config seed |
| `src/lib/revenue/ahp-loan.ts` | DELETE |
| `src/app/(protected)/revenue/actions.ts` | Remove AHP imports + actions |
| `src/app/(protected)/revenue/ahp-forgiveness/` | DELETE directory |
| `src/app/(protected)/reports/ahp-loan-summary/` | DELETE directory |
| `src/app/(protected)/reports/ahp-annual-package/` | DELETE directory |
| `src/lib/reports/ahp-loan-summary.ts` | DELETE |
| `src/lib/reports/ahp-annual-package.ts` | DELETE |
| `src/lib/reports/cash-position.ts` | Remove AHP references |
| `src/lib/help/terms.ts` | Remove AHP terms |
| `src/lib/copilot/contexts/revenue.ts` | Remove AHP mention |
| `src/lib/reports/__tests__/phase16-reports.test.ts` | Remove AHP test cases |
| `src/lib/validators/revenue.ts` | Remove ahpLoanForgivenessSchema |
| `src/lib/assets/interest-accrual.ts` | Remove AHP-specific logic |
| `src/lib/bank-rec/gl-only-categories.ts` | Remove AHP entries (if present) |
| `drizzle/0018_drop_ahp_loan_config.sql` | DROP TABLE |

---

## 9. Session Progress

### Session 1: 2026-02-26 (Discovery + Planning)

**Completed:**
- [x] Created plan document
- [x] Verified current state of all key files
- [x] Confirmed 4100 (Grant Revenue) and 4300 (Earned Income) exist in seed accounts
- [x] Confirmed two GL functions hardcode 4100 (lines 31 and 183 of `funding-sources.ts`)
- [x] Confirmed cash receipt functions don't touch revenue accounts (no change needed)
- [x] Populated design decisions, requirements, and phased implementation plan

**Next Steps:**
- [x] Begin Phase 1: Schema + Migration

### Session 2: 2026-02-27 (Implementation — Phases 1–4)

**Completed:**
- [x] Phase 1: Schema + Migration — enum, columns, validator, seed data, migration, tests (33/33 pass)
- [x] Phase 2: AI Extraction Enhancement — prompt with ASC 958-605/606, types, parser with safe defaults
- [x] Phase 3: UI + Server Action — RadioGroup classification UI, server action persistence, detail page display
- [x] Phase 4: Revenue GL Logic — helper function, 3 GL functions updated (recordUnconditionalFunding, recognizeConditionalRevenue, createArInvoice)
- [x] Fixed PO form TypeScript error from updated ContractExtractionData interface
- [x] TypeScript: 0 errors
- [x] Schema tests: 33/33 pass
- [x] Restricted fund release tests: 10/10 pass

**Next Steps:**
- [ ] Run migration on staging: `drizzle/0016_revenue_classification.sql`
- [ ] Smoke test: create new funding source with contract upload, verify AI classification

### Session 3: 2026-02-27 (Phases 5–6 — Funding Category + AHP Teardown)

**Completed:**
- [x] Full codebase audit of AHP footprint (~20 files across schema, GL, UI, reports, tests)
- [x] Assessed terminology standardization viability (23 files, ~30 labels — low risk)
- [x] Confirmed unrestricted grants need first-class support
- [x] Confirmed loans-as-funding-sources approach (future Phase 8)
- [x] Confirmed interest rate infrastructure exists in `annualRateConfig` (AHP-only, no UI)
- [x] Updated plan with Phases 5–8

**Next Steps:**
- [x] Begin Phase 5: Funding Category + Form Restructure

### Session 4: 2026-02-27 (Phase 5 — Funding Category + Form Restructure)

**Completed:**
- [x] Phase 5 full implementation — all 16 tasks
- [x] `fundingCategoryEnum` (GRANT, CONTRACT, LOAN) + column + migration with backfill
- [x] Validator: `fundingCategory` required, `funderId` required for all categories
- [x] Form restructure: category selector, auto-default revenue classification, LOAN hides classification
- [x] Form labels: "Lender" for LOAN, "Principal Amount" for LOAN, detail fields gated by category not restriction
- [x] AI extraction: prompt + types + parser now recommend category
- [x] List page: category badges (purple=GRANT, blue=CONTRACT, orange=LOAN), fixed status display
- [x] Detail page: category badge, ungated sections from restriction-only to category-based
- [x] **Unrestricted fund GL posting rule** (user directive): 7 fund selectors updated to filter `WHERE isActive AND (isSystemLocked OR restrictionType = 'RESTRICTED')` — unrestricted funding sources exist for tracking, not GL posting
- [x] TypeScript: 0 errors
- [x] Schema tests: 35/35 pass

**Design rule established:** Unrestricted funding sources (grants, loans) are first-class objects for contract tracking, covenants, compliance, and reporting — but all unrestricted GL posting goes through General Fund. Only restricted funds appear in expense/GL fund selectors.

**Next Steps:**
- [ ] Run migration on staging: `drizzle/0017_funding_category.sql`
- [ ] Smoke test: create new funding source with category selector
- [ ] Begin Phase 6: AHP Singleton Teardown
