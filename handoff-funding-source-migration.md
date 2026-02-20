# Handoff: Collapse Grant + Fund into Unified "Funding Source" Schema

## Context & Decision

The application currently has two separate concepts — `grants` (contractual relationship with a funder, terms, conditions, milestones) and `funds` (GL accounting bucket with restriction type). In practice these are 1:1. Every grant creates a fund. The fund exists only to tag transaction lines for financial statement purposes, but the grant already contains all the same restriction and spending-rule information.

**Decision**: Collapse these into a single entity. The `funds` table absorbs all `grants` columns. The `grants` table is deleted. All 10 existing `fundId` FK references across the codebase remain unchanged — field names stay as-is. The enriched fund becomes the single source of truth for: who gave us the money, what the contract says, how it's restricted, how to invoice, what milestones exist, and which GL bucket transactions land in.

**Terminology**: The schema table stays `funds`. The UI can call these "Funding Sources" where appropriate. There is NO sourceType dropdown to distinguish grant vs. contract vs. restricted donation — the restriction toggle (RESTRICTED/UNRESTRICTED) is the only classification that drives accounting behavior. The `type` field (CONDITIONAL/UNCONDITIONAL) remains because it drives GL behavior (immediate revenue recognition vs. refundable advance).

---

## Phase 1: Schema Migration

### 1.1 Enrich the `funds` table

Add these columns to `src/lib/db/schema/funds.ts` (all nullable — unrestricted funds won't use them):

```
funderId        integer     FK → vendors.id    (who gives us the money)
amount          numeric(15,2)                   (award/contract amount)
type            grantTypeEnum                   (CONDITIONAL / UNCONDITIONAL)
conditions      text                            (conditions text, required when type=CONDITIONAL)
startDate       date                            (contract/grant start)
endDate         date                            (contract/grant end)
status          grantStatusEnum    default 'ACTIVE'   (ACTIVE / COMPLETED / CANCELLED)
isUnusualGrant  boolean            default false       (FASB disclosure flag for 2% threshold)
contractPdfUrl  text                            (uploaded contract PDF path)
extractedMilestones   jsonb                     (AI-extracted milestones)
extractedTerms        jsonb                     (AI-extracted payment terms)
extractedCovenants    jsonb                     (AI-extracted covenants)
matchRequirementPercent  numeric(5,2)           (nullable — cost-share %, e.g. 25.00)
retainagePercent         numeric(5,2)           (nullable — holdback %, e.g. 10.00)
reportingFrequency       varchar(50)            (nullable — MONTHLY/QUARTERLY/ANNUALLY/AT_MILESTONES)
```

Keep existing columns: id, name, restrictionType, isActive, description, isSystemLocked, createdAt, updatedAt.

### 1.2 Data migration

Write a SQL migration that:
1. Adds all new columns to `funds`
2. Copies data from `grants` into `funds` by joining on `grants.fundId = funds.id`
3. Drops the `grants` table
4. Drops the `grantTypeEnum` and `grantStatusEnum` IF they're not referenced elsewhere — actually, keep them; the funds table now uses them directly

```sql
-- Step 1: Add columns
ALTER TABLE funds
  ADD COLUMN funder_id integer REFERENCES vendors(id),
  ADD COLUMN amount numeric(15,2),
  ADD COLUMN type grant_type,
  ADD COLUMN conditions text,
  ADD COLUMN start_date date,
  ADD COLUMN end_date date,
  ADD COLUMN status grant_status DEFAULT 'ACTIVE',
  ADD COLUMN is_unusual_grant boolean NOT NULL DEFAULT false,
  ADD COLUMN contract_pdf_url text,
  ADD COLUMN extracted_milestones jsonb,
  ADD COLUMN extracted_terms jsonb,
  ADD COLUMN extracted_covenants jsonb,
  ADD COLUMN match_requirement_percent numeric(5,2),
  ADD COLUMN retainage_percent numeric(5,2),
  ADD COLUMN reporting_frequency varchar(50);

-- Step 2: Copy grant data into funds
UPDATE funds SET
  funder_id = g.funder_id,
  amount = g.amount,
  type = g.type,
  conditions = g.conditions,
  start_date = g.start_date,
  end_date = g.end_date,
  status = g.status,
  is_unusual_grant = g.is_unusual_grant
FROM grants g WHERE g.fund_id = funds.id;

-- Step 3: Add index on funder_id
CREATE INDEX funds_funder_id_idx ON funds(funder_id);
CREATE INDEX funds_status_idx ON funds(status);

-- Step 4: Drop grants table (after all code references updated)
DROP TABLE grants;
```

Generate this via Drizzle migration tooling.

### 1.3 Delete `src/lib/db/schema/grants.ts`

### 1.4 Update `src/lib/db/schema/index.ts`
- Remove grants import and export
- Remove grantsRelations
- Add new fields to funds relations (funder → vendors)
- Update fundsRelations to include the vendor (funder) relationship

---

## Phase 2: Code Migration (47 files affected)

### 2.1 Schema & Types Layer

| File | Change |
|------|--------|
| `src/lib/db/schema/funds.ts` | Add all new columns, import grantTypeEnum/grantStatusEnum from enums |
| `src/lib/db/schema/grants.ts` | DELETE this file |
| `src/lib/db/schema/index.ts` | Remove grants export/import/relations; add funder relation to funds |
| `src/lib/db/schema/enums.ts` | Keep grantTypeEnum and grantStatusEnum (now used by funds) |
| `src/lib/db/schema/schema.test.ts` | Update tests: remove grant schema tests, add fund enrichment tests |

### 2.2 Validators

| File | Change |
|------|--------|
| `src/lib/validators/grants.ts` | DELETE or merge into funds validator |
| `src/lib/validators/index.ts` | Remove grants validator export |
| `src/lib/validators/revenue.ts` | Update grantCashReceiptSchema and grantConditionMetSchema to reference fundId instead of grantId |
| `src/lib/validators/__tests__/grants.test.ts` | Move tests to fund validator tests |
| `src/lib/validators/__tests__/revenue.test.ts` | Update references |

The `insertGrantSchema` fields merge into a new `insertFundingSourceSchema` (or extend the existing fund creation validator):

```typescript
// New: extends existing fund creation with optional grant/contract fields
export const insertFundingSourceSchema = z.object({
  name: z.string().min(1),
  restrictionType: z.enum(['RESTRICTED', 'UNRESTRICTED']),
  description: z.string().nullable().optional(),
  // Funding source fields (all optional for unrestricted funds)
  funderId: z.number().int().positive().nullable().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  type: z.enum(['CONDITIONAL', 'UNCONDITIONAL']).nullable().optional(),
  conditions: z.string().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  isUnusualGrant: z.boolean().optional().default(false),
  matchRequirementPercent: z.number().min(0).max(100).nullable().optional(),
  retainagePercent: z.number().min(0).max(100).nullable().optional(),
  reportingFrequency: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUALLY', 'AT_MILESTONES']).nullable().optional(),
}).refine(data => {
  if (data.type === 'CONDITIONAL' && !data.conditions) return false
  return true
}, { message: 'Conditions required for conditional funding sources', path: ['conditions'] })
```

### 2.3 GL Operations

| File | Change |
|------|--------|
| `src/lib/revenue/grants.ts` | Rename to `src/lib/revenue/funding-sources.ts`. All 4 functions take `fundId` instead of `grantId`. Update memo strings from "Grant #X" to "Fund #X". The GL logic is identical — same account codes, same debit/credit patterns. |
| `src/lib/revenue/index.ts` | Update export path |

Function signature changes:
- `recordUnconditionalGrant(grantId, ...)` → `recordUnconditionalGrant(fundId, ...)`
- `recordGrantCashReceipt(grantId, ...)` → `recordGrantCashReceipt(fundId, ...)`
- `recordConditionalGrantCash(grantId, ...)` → `recordConditionalGrantCash(fundId, ...)`
- `recognizeConditionalGrant(grantId, ...)` → `recognizeConditionalGrant(fundId, ...)`

The `sourceReferenceId` values change from `grant:X` to `fund:X`, `grant-receipt:X` to `fund-receipt:X`, etc.

### 2.4 Server Actions

| File | Change |
|------|--------|
| `src/app/(protected)/revenue/actions.ts` | Major changes — see below |

Current actions to update:
- `getGrants()` → query `funds` with `WHERE funder_id IS NOT NULL` (or just return all funds with enriched data)
- `getGrantById(id)` → `getFundById(id)` — same query but from funds
- `getGrantTransactions(grantId)` → `getFundTransactions(fundId)` — already queries by fundId under the hood
- `createGrant(data, userId)` → becomes `createFundingSource(data, userId)` — inserts into funds table instead of grants + fund
- `recordGrantCashReceiptAction` → update to pass fundId directly
- `recognizeConditionalGrantRevenue` → update to pass fundId directly

Remove types: `GrantRow`, `GrantWithFunder` → replace with enriched fund types
Update revalidation paths: `/revenue/grants` → `/revenue/funding-sources` (or keep `/revenue/grants` as URL and just change the data layer)

### 2.5 UI Pages

| File | Change |
|------|--------|
| `src/app/(protected)/revenue/grants/page.tsx` | Update to query funds table. Column "Funder" comes from fund.funderId join. "Fund" column is no longer needed (it IS the fund). |
| `src/app/(protected)/revenue/grants/new/page.tsx` | No longer needs fund dropdown — creating a funding source IS creating a fund. Still needs vendor/funder dropdown. |
| `src/app/(protected)/revenue/grants/new/create-grant-client.tsx` | Remove "Fund" select field. Add name field (fund name). Add contract upload + AI extraction (mirror PO creation form). Add matchRequirementPercent, retainagePercent, reportingFrequency fields. |
| `src/app/(protected)/revenue/grants/[id]/page.tsx` | Update data loading to query enriched fund |
| `src/app/(protected)/revenue/grants/[id]/grant-detail-client.tsx` | Add contract terms display (extracted milestones/terms/covenants in collapsible cards, same pattern as PO detail). Add "Create Invoice" action button (Phase 4). Show match requirement soft warning if applicable. |
| `src/app/(protected)/revenue/page.tsx` | Update card description |

### 2.6 Reports

| File | Change |
|------|--------|
| `src/lib/reports/grant-compliance.ts` | Query `funds` instead of `grants`. Join simplifies — no longer needs to join grants→funds, just query funds directly. Pull `extractedMilestones` from the fund itself (not just from POs). |
| `src/app/(protected)/reports/grant-compliance/grant-compliance-client.tsx` | Update types. May rename to "Funding Source Compliance" in UI. |
| `src/lib/reports/fund-drawdown.ts` | Simplifies — `relatedGrants` concept goes away. The fund IS the grant. |
| `src/app/(protected)/reports/fund-drawdown/fund-drawdown-client.tsx` | Remove "related grants" display, show contract terms directly on fund rows |
| `src/lib/reports/ar-aging.ts` | Update `grantAR` to reference funds instead of grants |
| `src/app/(protected)/reports/ar-aging/ar-aging-client.tsx` | Update labels |
| `src/app/(protected)/reports/compliance-calendar/compliance-calendar-client.tsx` | Update category filter label if needed |
| `src/lib/reports/types.ts` | Update report definitions |
| `src/app/api/reports/pdf/route.ts` | Update grant-compliance PDF export |
| `src/lib/pdf/board-pack.ts` | Update references |

### 2.7 Compliance & Deadlines

| File | Change |
|------|--------|
| `src/lib/compliance/deadline-generator.ts` | Keep 'grant' category for now. See Phase 3 for dynamic deadline generation. |
| `src/app/(protected)/compliance/columns.tsx` | No change needed if category stays 'grant' |

### 2.8 Copilot

| File | Change |
|------|--------|
| `src/lib/copilot/contexts/revenue.ts` | Update context description |
| `src/lib/copilot/contexts/compliance.ts` | Update unusual grant references |

### 2.9 Help & Navigation

| File | Change |
|------|--------|
| `src/lib/help/terms.ts` | Update tooltip text for grant-related terms |
| `src/components/shared/breadcrumbs.tsx` | Update breadcrumb labels |

### 2.10 Other

| File | Change |
|------|--------|
| `src/app/(protected)/budgets/[id]/page.tsx` | Update grantBudgetContext |
| `src/app/(protected)/budgets/[id]/budget-review-client.tsx` | Update types |
| `src/app/(protected)/revenue/donations/donations-client.tsx` | Update references |
| `src/lib/integrations/ramp.ts` | Update references |
| `src/lib/db/seed/funds.ts` | Update seed data to include funder/amount/terms on seeded funds |
| `src/lib/migration/__tests__/import-engine.test.ts` | Update test data |
| `src/lib/reports/__tests__/phase16-reports.test.ts` | Update grant compliance tests |

---

## Phase 3: Contract Upload + AI Extraction on Fund Creation

### 3.1 Add contract upload to funding source creation form

Mirror the PO creation form pattern in `create-po-form.tsx`:
- File input for PDF upload
- "Extract Terms" button that calls `/api/extract-contract`
- Results populate editable JSON textareas in collapsible cards (milestones, terms, covenants)
- Extracted data saves to fund's jsonb columns

The existing `/api/extract-contract` endpoint and `src/lib/ai/contract-extraction.ts` work as-is — they take a base64 PDF and return structured JSON. No changes needed to the extraction pipeline.

The existing `/api/upload` endpoint handles file storage. No changes needed.

### 3.2 Tune extraction prompt (optional, can defer)

The current extraction prompt in `contract-extraction.ts` is optimized for vendor contracts/POs. Grant agreements emphasize different things: reporting requirements, match provisions, drawdown schedules, allowable cost categories, close-out requirements. Consider adding a `context` parameter to the extraction function that adjusts the prompt based on whether it's a PO contract or a funding source contract. But this is an optimization — the current prompt will extract milestones and terms from any contract.

---

## Phase 4: Compliance Calendar + Nudge System

### 4.1 Dynamic deadline generation from funding sources

Currently `deadline-generator.ts` only has one hardcoded grant deadline ("Annual grant compliance review" on 12/31). Enhance this to generate deadlines dynamically from enriched fund data.

Add a new function `generateFundingSourceDeadlines(fundId)` that reads the fund and creates compliance deadlines for:

**From reportingFrequency:**
- MONTHLY → 12 deadlines: "Monthly report — [Fund Name]" on the last day of each month
- QUARTERLY → 4 deadlines: "Quarterly report — [Fund Name]"
- ANNUALLY → 1 deadline: "Annual report — [Fund Name]"

**From extractedMilestones:**
- Each milestone with a date → deadline: "Milestone: [name] — [Fund Name]"

**From endDate:**
- 90 days before: "Grant close-out approaching — [Fund Name]" (yellow)
- 30 days before: "Grant close-out imminent — [Fund Name]" (red)

**Invoice nudges (computed, not stored):**
For funds with reportingFrequency set, compute time since last AR invoice was submitted against this fund. If approaching the next reporting period boundary with no invoice:
- "Quarterly invoice due soon — [Fund Name]. Last invoice: [date]. Billable expenses since: $[amount]."

This requires the AR invoice schema (Phase 5) to exist first.

### 4.2 Cost-share / match soft warning

On the funding source detail page and invoice creation screen, when `matchRequirementPercent` is populated:

1. Query total expenses charged to this fund (sum of debit transaction lines where fundId = this fund and account is an expense account)
2. Query total org-funded expenses (expenses in the same categories but charged to the unrestricted general fund — this is an approximation; exact match tracking is a future enhancement)
3. Compute ratio and display:

```
⚠️ This funding source requires 25% cost-share. Current estimated match ratio: 18%.
```

Keep it soft — yellow warning, no blocking. The word "estimated" is important because precise match tracking would require tagging individual transactions as match-eligible.

---

## Phase 5: AR Invoice Schema + Creation UI

(This is a subsequent body of work — including here for context on how it connects to the funding source migration.)

### 5.1 Schema changes

Make `purchaseOrderId` nullable on the `invoices` table. Add:
```
fundId          integer     FK → funds.id      (for AR invoices — the funding source being invoiced)
direction       varchar(2)  NOT NULL default 'AP'   ('AP' or 'AR')
```

Add check constraint: exactly one of `purchaseOrderId` or `fundId` must be non-null.

### 5.2 Invoice creation UI

Revenue → Funding Sources → [detail] → "Create Invoice" button → Invoice creation form that:
- Pre-fills funder name, fund name, contract terms
- Shows extracted milestones/conditions as read-only reference sidebar
- Lets user enter invoice number, amount, date, due date
- Shows cost-share warning if applicable
- Shows retainage note if applicable ("Note: [retainage%] holdback applies per contract terms")

### 5.3 Revenue recognition on AR invoice payment

When an AR invoice is marked PAID, the GL entry is:
- DR Cash (1000), CR Grant Revenue (4100) — coded to the funding source's fund

This is the inverse of the AP flow (DR Expense, CR Cash).

---

## File Inventory (47 files total)

### DELETE (2 files)
- `src/lib/db/schema/grants.ts`
- `src/lib/validators/grants.ts`

### RENAME (1 file)
- `src/lib/revenue/grants.ts` → `src/lib/revenue/funding-sources.ts`

### MAJOR CHANGES (10 files)
- `src/lib/db/schema/funds.ts` — add 14 new columns
- `src/lib/db/schema/index.ts` — remove grants, update fund relations
- `src/app/(protected)/revenue/actions.ts` — rewrite grant queries/mutations to use funds
- `src/app/(protected)/revenue/grants/new/create-grant-client.tsx` — new form with contract upload
- `src/app/(protected)/revenue/grants/[id]/grant-detail-client.tsx` — add contract terms display
- `src/lib/reports/grant-compliance.ts` — simplify queries
- `src/lib/reports/fund-drawdown.ts` — simplify queries
- `src/lib/validators/revenue.ts` — update schemas
- `src/lib/compliance/deadline-generator.ts` — add dynamic deadline generation
- `src/lib/revenue/funding-sources.ts` (renamed) — update function signatures

### MODERATE CHANGES (12 files)
- `src/lib/db/schema/enums.ts` — keep enums, no changes needed
- `src/app/(protected)/revenue/grants/page.tsx`
- `src/app/(protected)/revenue/grants/new/page.tsx`
- `src/app/(protected)/revenue/grants/[id]/page.tsx`
- `src/app/(protected)/revenue/page.tsx`
- `src/lib/reports/ar-aging.ts`
- `src/app/(protected)/reports/grant-compliance/grant-compliance-client.tsx`
- `src/app/(protected)/reports/fund-drawdown/fund-drawdown-client.tsx`
- `src/app/(protected)/reports/ar-aging/ar-aging-client.tsx`
- `src/lib/copilot/contexts/revenue.ts`
- `src/lib/help/terms.ts`
- `src/lib/db/seed/funds.ts`

### MINOR CHANGES (label/reference updates — ~23 files)
- `src/lib/validators/index.ts`
- `src/lib/revenue/index.ts`
- `src/components/shared/breadcrumbs.tsx`
- `src/app/(protected)/budgets/[id]/page.tsx`
- `src/app/(protected)/budgets/[id]/budget-review-client.tsx`
- `src/app/(protected)/revenue/donations/donations-client.tsx`
- `src/app/(protected)/compliance/columns.tsx`
- `src/app/(protected)/reports/compliance-calendar/compliance-calendar-client.tsx`
- `src/lib/reports/types.ts`
- `src/app/api/reports/pdf/route.ts`
- `src/lib/pdf/board-pack.ts`
- `src/lib/integrations/ramp.ts`
- `src/lib/copilot/contexts/compliance.ts`
- `src/lib/copilot/propublica-client.ts`
- Test files (6): schema.test.ts, grants.test.ts (delete), revenue.test.ts, phase16-reports.test.ts, import-engine.test.ts, validators tests

---

## Execution Order

1. **Schema migration** (Phase 1) — add columns to funds, migrate data, drop grants table
2. **Code migration** (Phase 2) — update all 47 files, run tests
3. **Contract upload** (Phase 3) — add upload + extraction to funding source creation
4. **Compliance calendar** (Phase 4) — dynamic deadlines + nudges + match warnings
5. **AR invoices** (Phase 5) — schema + UI + GL integration

Phases 1-2 are one atomic change. Phases 3-5 can be done incrementally.

---

## Important: What NOT to Change

- **`fundId` field names** — stay exactly as-is across all 10 referencing tables
- **Fund restriction enum** — RESTRICTED/UNRESTRICTED stays, drives financial statement classification
- **GL account codes** — 1000, 1110, 2050, 4100 all stay the same
- **Transaction line structure** — fundId FK on transactionLines stays unchanged
- **Existing PO contract extraction** — the PO still has its own extractedMilestones/Terms/Covenants on the purchase_orders table; this is separate from the fund-level extraction
- **`dismissedWarnings` on purchase_orders** — recently added jsonb column, leave as-is
