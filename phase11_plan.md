# Phase 11 Execution Plan: Fixed Assets, Depreciation & CIP

**Phase:** 11 of 22
**Dependencies:** Phase 5 (Journal Entry & Transaction List) — must be verified
**Branch:** `phase-11-implementation` (from `main`)
**Estimated scope:** 3 DB tables + 3 cron jobs + 5 pages + CIP conversion wizard + prepaid amortization + developer fee view + tests

---

## Prerequisites Verification

Before starting, confirm these deliverables from prior phases are working:

- [ ] GL engine operational — `createTransaction()` with source_type=SYSTEM, is_system_generated=true
- [ ] Audit logger operational — `logAudit()` appends to audit_log table
- [ ] Core schema in DB: accounts, funds, transactions, transaction_lines, cip_cost_codes, audit_log
- [ ] Seed data loaded: CIP accounts (1500-1550), Building accounts (1600-1620), Accum Depr accounts (1800-1830), Depreciation Expense (5200), Interest Expense (5100), CIP - Construction Interest (1550), Accrued Interest Payable (2520), General Fund
- [ ] TanStack Table `DataTable` component working
- [ ] Account/Fund selector components available
- [ ] Server action pattern established (Phases 4-5)
- [ ] Help tooltip system working

---

## Overview

Phase 11 builds four major capabilities:

1. **Fixed asset register** — CRUD for fixed assets with component depreciation
2. **Monthly depreciation automation** — cron job generating straight-line depreciation JEs
3. **CIP-to-fixed-asset conversion wizard** — 5-step workflow reclassifying CIP to building accounts
4. **AHP interest accrual automation** — cron job with construction/post-construction mode switching
5. **Prepaid expense amortization** — cron job for monthly prepaid expense entries

---

## Step 1: New Enums

**File:** `src/lib/db/schema/enums.ts`

Add one new enum:

```
depreciationMethodEnum: 'STRAIGHT_LINE'
```

Only straight-line is supported (D-127), but enum leaves room for future methods if ever needed. Single-value enum makes the constraint explicit in the schema.

**Acceptance criteria:** Enum created in DB via migration.

---

## Step 2: Database Schema — `fixed_assets` Table

**File:** `src/lib/db/schema/fixed-assets.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| name | varchar(255) | NOT NULL | DM-P0-019 |
| description | text | nullable | DM-P0-019 |
| acquisitionDate | date(string) | NOT NULL | DM-P0-019 |
| cost | numeric(15,2) | NOT NULL | DM-P0-019 |
| salvageValue | numeric(15,2) | NOT NULL, default '0' | DM-P0-019 |
| usefulLifeMonths | integer | NOT NULL | DM-P0-019 |
| depreciationMethod | depreciationMethodEnum | NOT NULL, default 'STRAIGHT_LINE' | D-127 |
| datePlacedInService | date(string) | nullable (null until PIS) | DM-P0-019 |
| glAssetAccountId | integer | NOT NULL, FK → accounts | DM-P0-019 |
| glAccumDeprAccountId | integer | NOT NULL, FK → accounts | DM-P0-019 |
| glExpenseAccountId | integer | NOT NULL, FK → accounts | DM-P0-019 |
| cipConversionId | integer | nullable, FK → cip_conversions | DM-P0-030 |
| parentAssetId | integer | nullable, self-ref FK | DM-P0-020 |
| isActive | boolean | NOT NULL, default true | INV-013 |
| createdAt | timestamp | NOT NULL, defaultNow | — |
| updatedAt | timestamp | NOT NULL, defaultNow | — |

**Indexes:** `fixed_assets_gl_asset_account_id_idx`, `fixed_assets_parent_asset_id_idx`, `fixed_assets_is_active_idx`

**Notes:**
- `datePlacedInService` is null for assets not yet in service (e.g., during construction). Depreciation only runs when this is set.
- The GL account triplet (asset / accum depr / expense) maps each asset to its balance sheet and P&L accounts.
- `cipConversionId` links back to the conversion record when asset was created via CIP conversion wizard.
- `parentAssetId` enables building → component hierarchy (Lodging → structure, roof, HVAC, etc.)

---

## Step 3: Database Schema — `cip_conversions` Table

**File:** `src/lib/db/schema/cip-conversions.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| structureName | varchar(100) | NOT NULL (e.g., "Lodging", "Barn", "Garage") | DM-P0-030 |
| placedInServiceDate | date(string) | NOT NULL | DM-P0-030 |
| totalAmountConverted | numeric(15,2) | NOT NULL | DM-P0-030 |
| glTransactionId | integer | NOT NULL, FK → transactions | DM-P0-030 |
| createdBy | varchar(255) | NOT NULL | — |
| createdAt | timestamp | NOT NULL, defaultNow | — |

**Index:** `cip_conversions_structure_name_idx`

---

## Step 4: Database Schema — `cip_conversion_lines` Table

**File:** `src/lib/db/schema/cip-conversion-lines.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| conversionId | integer | NOT NULL, FK → cip_conversions, cascade delete | DM-P0-030 |
| sourceCipAccountId | integer | NOT NULL, FK → accounts | DM-P0-030 |
| sourceCostCodeId | integer | nullable, FK → cip_cost_codes | DM-P0-030 |
| targetFixedAssetId | integer | NOT NULL, FK → fixed_assets | DM-P0-030 |
| amount | numeric(15,2) | NOT NULL | DM-P0-030 |
| createdAt | timestamp | NOT NULL, defaultNow | — |

**Index:** `cip_conversion_lines_conversion_id_idx`

---

## Step 5: Database Schema — `ahp_loan_config` Table

**File:** `src/lib/db/schema/ahp-loan-config.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| creditLimit | numeric(15,2) | NOT NULL (default 3500000) | DM-P0-025 |
| currentDrawnAmount | numeric(15,2) | NOT NULL, default '0' | DM-P0-025 |
| currentInterestRate | numeric(7,5) | NOT NULL | DM-P0-025 |
| rateEffectiveDate | date(string) | NOT NULL | DM-P0-025 |
| annualPaymentDate | varchar(5) | NOT NULL, default '12-31' | DM-P0-025 |
| lastPaymentDate | date(string) | nullable | DM-P0-025 |
| updatedAt | timestamp | NOT NULL, defaultNow | — |

**Notes:** Singleton table — only one row expected. The implementation plan (Phase 7, item 13) specifies this table. Phase 11 needs it for interest accrual calculations, so we create it here. Seed with initial AHP loan parameters.

---

## Step 6: Database Schema — `prepaid_schedules` Table

**File:** `src/lib/db/schema/prepaid-schedules.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| description | varchar(255) | NOT NULL | TXN-P0-054 |
| totalAmount | numeric(15,2) | NOT NULL | TXN-P0-054 |
| startDate | date(string) | NOT NULL | TXN-P0-054 |
| endDate | date(string) | NOT NULL | TXN-P0-054 |
| glExpenseAccountId | integer | NOT NULL, FK → accounts | TXN-P0-054 |
| glPrepaidAccountId | integer | NOT NULL, FK → accounts (defaults to Prepaid Expenses 1200) | TXN-P0-054 |
| fundId | integer | NOT NULL, FK → funds | TXN-P0-054 |
| monthlyAmount | numeric(15,2) | NOT NULL (calculated: totalAmount / months) | TXN-P0-054 |
| amountAmortized | numeric(15,2) | NOT NULL, default '0' | TXN-P0-054 |
| isActive | boolean | NOT NULL, default true | TXN-P0-054 |
| sourceTransactionId | integer | nullable, FK → transactions | — |
| createdBy | varchar(255) | NOT NULL | — |
| createdAt | timestamp | NOT NULL, defaultNow | — |

**Notes:** Tracks each prepaid expense with its amortization schedule. `monthlyAmount` is pre-calculated (total ÷ months in range). `amountAmortized` tracks cumulative amortization for true-up support.

---

## Step 7: Run Migrations

**Command:** `npx drizzle-kit generate && npx drizzle-kit push`

**Files to update:**
- `src/lib/db/schema/index.ts` — add exports for all new tables + relations

**New relations to define in `src/lib/db/schema/index.ts`:**

```
fixedAssetsRelations:
  - parent: one(fixedAssets) via parentAssetId (self-ref, "assetHierarchy")
  - children: many(fixedAssets, "assetHierarchy")
  - glAssetAccount: one(accounts) via glAssetAccountId
  - glAccumDeprAccount: one(accounts) via glAccumDeprAccountId
  - glExpenseAccount: one(accounts) via glExpenseAccountId
  - cipConversion: one(cipConversions) via cipConversionId

cipConversionsRelations:
  - lines: many(cipConversionLines)
  - glTransaction: one(transactions) via glTransactionId

cipConversionLinesRelations:
  - conversion: one(cipConversions) via conversionId
  - sourceCipAccount: one(accounts) via sourceCipAccountId
  - sourceCostCode: one(cipCostCodes) via sourceCostCodeId
  - targetFixedAsset: one(fixedAssets) via targetFixedAssetId
```

**Acceptance criteria:** All 5 new tables created in dev DB. Relations defined. `drizzle-kit push` succeeds.

---

## Step 8: Seed Data — AHP Loan Config

**File:** `src/lib/db/seed/ahp-loan-config.ts` (new)

Seed the singleton AHP loan config row:

```
creditLimit: 3500000.00
currentDrawnAmount: 0.00
currentInterestRate: 0.00 (placeholder — set to actual rate when known)
rateEffectiveDate: '2025-01-01' (placeholder)
annualPaymentDate: '12-31'
lastPaymentDate: null
```

**Update:** `src/lib/db/seed/index.ts` to include AHP loan config seeding.

---

## Step 9: Zod Validators

**File:** `src/lib/validators/fixed-assets.ts` (new)

```
insertFixedAssetSchema:
  - name: string, min 1, max 255
  - description: string, nullable, optional
  - acquisitionDate: string, date format
  - cost: number, positive, 2 decimal places
  - salvageValue: number, >= 0, default 0, 2 decimal places
  - usefulLifeMonths: integer, > 0
  - depreciationMethod: enum ['STRAIGHT_LINE'], default 'STRAIGHT_LINE'
  - datePlacedInService: string date, nullable, optional
  - glAssetAccountId: integer, positive
  - glAccumDeprAccountId: integer, positive
  - glExpenseAccountId: integer, positive
  - cipConversionId: integer, positive, nullable, optional
  - parentAssetId: integer, positive, nullable, optional
  - Refinement: salvageValue < cost

updateFixedAssetSchema:
  - name: string, optional
  - description: string, nullable, optional
  - datePlacedInService: string date, nullable, optional
  - isActive: boolean, optional
```

**File:** `src/lib/validators/cip-conversions.ts` (new)

```
cipConversionInputSchema:
  - structureName: string, min 1 (e.g., "Lodging", "Barn", "Garage")
  - placedInServiceDate: string, date format
  - allocations: array of:
    - sourceCipAccountId: integer, positive
    - sourceCostCodeId: integer, nullable, optional
    - targetAssetName: string, min 1
    - targetUsefulLifeMonths: integer, > 0
    - targetGlAssetAccountId: integer, positive
    - targetGlAccumDeprAccountId: integer, positive
    - targetGlExpenseAccountId: integer, positive
    - amount: number, positive, 2 decimal places
  - Refinement: sum(allocations.amount) > 0
```

**File:** `src/lib/validators/prepaid-schedules.ts` (new)

```
insertPrepaidScheduleSchema:
  - description: string, min 1, max 255
  - totalAmount: number, positive, 2 decimal places
  - startDate: string, date format
  - endDate: string, date format
  - glExpenseAccountId: integer, positive
  - glPrepaidAccountId: integer, positive (default: Prepaid Expenses account ID)
  - fundId: integer, positive
  - Refinement: endDate > startDate
  - Refinement: period must be at least 1 full month
```

**Update:** `src/lib/validators/index.ts` — export all new schemas.

---

## Step 10: Depreciation Calculation Engine

**File:** `src/lib/assets/depreciation.ts` (new)

**Functions:**

```
calculateMonthlyDepreciation(asset: FixedAsset): number
  - Formula: (cost - salvageValue) / usefulLifeMonths
  - Returns monthly depreciation amount (2 decimal places)

calculateAccumulatedDepreciation(asset: FixedAsset, asOfDate: string): number
  - Months elapsed = months from datePlacedInService to asOfDate
  - Accumulated = min(monthlyAmount * monthsElapsed, cost - salvageValue)
  - Cap at depreciable basis (never exceed cost - salvage)

calculateNetBookValue(asset: FixedAsset, asOfDate: string): number
  - Returns: cost - calculateAccumulatedDepreciation(asset, asOfDate)

isFullyDepreciated(asset: FixedAsset, asOfDate: string): boolean
  - True when accumulated depreciation >= (cost - salvageValue)

getDepreciableAssets(): Promise<FixedAsset[]>
  - Query: active=true, datePlacedInService IS NOT NULL, NOT fully depreciated
  - Returns list of assets needing depreciation entries

generateDepreciationEntries(asOfDate: string, userId: string): Promise<DepreciationResult>
  - For each depreciable asset:
    - Skip if already deprecated for this month (check existing SYSTEM transactions)
    - Calculate monthly amount
    - For final month: use remaining depreciable basis (avoid over-depreciation from rounding)
    - Create GL entry via createTransaction():
      - sourceType: 'SYSTEM'
      - isSystemGenerated: true
      - memo: "Monthly depreciation - [asset name] - [month/year]"
      - Line 1: DR Depreciation Expense (5200), CR null — fund: General Fund
      - Line 2: CR Accumulated Depreciation ([asset's glAccumDeprAccountId]), DR null — fund: General Fund
    - Audit log entry
  - Return: { entriesCreated: number, totalAmount: number, details: AssetDepreciationDetail[] }
```

**Key business rules:**
- Straight-line only (D-127)
- Posts to General Fund regardless of acquisition fund (TXN-P0-034)
- No depreciation on CIP (TXN-P0-038)
- is_system_generated = true (INV-008)
- Skip fully depreciated assets
- Handle month-end rounding by adjusting final month entry

---

## Step 11: AHP Interest Accrual Engine

**File:** `src/lib/assets/interest-accrual.ts` (new)

**Functions:**

```
getConstructionStatus(): Promise<{ isConstructionComplete: boolean; structuresConverted: string[] }>
  - Query cip_conversions table
  - Construction complete when all 3 structures have conversion records
  - Currently: Lodging, Barn, Garage are the 3 structures
  - Return list of converted structure names for audit

calculateMonthlyInterest(loanConfig: AhpLoanConfig): number
  - Monthly interest = currentDrawnAmount * (currentInterestRate / 12)
  - Returns monthly interest amount (2 decimal places)
  - Returns 0 if drawnAmount is 0

generateInterestAccrualEntry(asOfDate: string, userId: string): Promise<InterestAccrualResult>
  - Read AHP loan config
  - If drawnAmount = 0, skip (no interest to accrue)
  - Check construction status
  - Calculate monthly interest
  - Skip if already accrued for this month (check existing SYSTEM transactions)
  - Create GL entry via createTransaction():
    - sourceType: 'SYSTEM'
    - isSystemGenerated: true
    - During construction (any structure not PIS):
      - memo: "AHP interest accrual (construction) - [month/year]"
      - DR CIP - Construction Interest (1550), fund: General Fund
      - CR Accrued Interest Payable (2520), fund: General Fund
    - Post-construction (all structures PIS):
      - memo: "AHP interest accrual - [month/year]"
      - DR Interest Expense (5100), fund: General Fund
      - CR Accrued Interest Payable (2520), fund: General Fund
  - Audit log entry
  - Return: { mode: 'construction' | 'post-construction', amount: number, transactionId: number }
```

**Key business rules:**
- 100% capitalized during construction per ASC 835-20 (TXN-P0-039)
- Mode switches automatically when last CIP conversion completed
- Posts to General Fund
- Rate from ahp_loan_config singleton
- Annual payment (Dec 31) clears accrued interest (DR Accrued Interest Payable, CR Cash) — this is a manual JE, not automated

---

## Step 12: Prepaid Amortization Engine

**File:** `src/lib/assets/prepaid-amortization.ts` (new)

**Functions:**

```
calculateMonthlyAmortization(schedule: PrepaidSchedule): number
  - Monthly = totalAmount / months in range
  - Handle partial months at start/end

getActiveSchedules(asOfDate: string): Promise<PrepaidSchedule[]>
  - Query: isActive=true, startDate <= asOfDate, amountAmortized < totalAmount

generateAmortizationEntries(asOfDate: string, userId: string): Promise<AmortizationResult>
  - For each active schedule:
    - Skip if month already processed (check SYSTEM transactions)
    - Calculate monthly amount
    - For final month: use remaining balance (totalAmount - amountAmortized)
    - Create GL entry via createTransaction():
      - sourceType: 'SYSTEM'
      - isSystemGenerated: true
      - memo: "Prepaid amortization - [description] - [month/year]"
      - DR [glExpenseAccountId], fund: [schedule.fundId]
      - CR Prepaid Expenses (1200), fund: [schedule.fundId]
    - Update amountAmortized on schedule
    - Audit log entry
  - Return: { entriesCreated: number, totalAmount: number }

handleRefundTrueUp(scheduleId: number, refundAmount: number, userId: string): Promise<void>
  - Reduce totalAmount by refund amount
  - Recalculate monthlyAmount for remaining months
  - Adjust amountAmortized if needed
  - Audit log the true-up
```

**Key business rules (TXN-P0-054):**
- Pro-rated across coverage period
- Auto-generates monthly via cron
- Refund true-up: reduces remaining unamortized balance, recalculates future entries

---

## Step 13: CIP Conversion Logic

**File:** `src/lib/assets/cip-conversion.ts` (new)

**Functions:**

```
getCipBalances(): Promise<CipBalanceSummary>
  - Query transaction_lines joined to accounts
  - Group by CIP sub-account (1510-1550)
  - Within each sub-account, group by cip_cost_code_id
  - Return: { subAccounts: Array<{ accountId, accountName, balance, costCodeBreakdown: Array<{ costCodeId, costCodeName, balance }> }> }

getConvertedStructures(): Promise<CipConversion[]>
  - Query cip_conversions with lines
  - Used to check which structures already converted

executeCipConversion(input: CipConversionInput, userId: string): Promise<CipConversionResult>
  Where CipConversionInput = {
    structureName: string
    placedInServiceDate: string
    allocations: Array<{
      sourceCipAccountId: number
      sourceCostCodeId: number | null
      targetAssetName: string
      targetUsefulLifeMonths: number
      targetGlAssetAccountId: number
      targetGlAccumDeprAccountId: number
      targetGlExpenseAccountId: number
      amount: number
    }>
  }

  Steps (all within a single DB transaction):
  1. Validate: sum of allocations > 0
  2. Validate: each sourceCipAccountId has sufficient balance for allocated amount
  3. Create fixed_asset records for each allocation:
     - name: targetAssetName
     - cost: amount
     - acquisitionDate: placedInServiceDate
     - datePlacedInService: placedInServiceDate
     - usefulLifeMonths: targetUsefulLifeMonths
     - GL accounts from allocation
     - parentAssetId: set for components (Lodging components → Lodging parent)
  4. Generate reclassification JE via createTransaction():
     - sourceType: 'SYSTEM'
     - isSystemGenerated: true
     - memo: "CIP to fixed asset reclassification - [structureName]"
     - For each allocation:
       - DR [targetGlAssetAccountId] (Building account), fund: General Fund
       - CR [sourceCipAccountId] (CIP sub-account), fund: General Fund
  5. Create cip_conversions record with glTransactionId
  6. Create cip_conversion_lines records linking source CIP → target fixed asset
  7. Audit log everything
  8. Return: { conversionId, transactionId, assetsCreated: FixedAsset[] }
```

**Key business rules:**
- Partial conversion supported (DM-P0-031) — only allocated amounts reclassified
- Each structure independent (Lodging, Barn, Garage)
- Lodging gets component depreciation (structure, roof, HVAC, etc.)
- Barn and Garage are single-item (27.5yr)
- Reclassification JE: DR Building accounts, CR CIP sub-accounts
- Fixed assets created with depreciation schedules starting next month
- Conversion checked by interest accrual engine for mode switching

---

## Step 14: Cron Job — Monthly Depreciation

**File:** `src/app/api/cron/depreciation/route.ts` (new)

```
POST handler (Vercel cron):
  - Verify cron authorization header
  - Determine current month/year
  - Call generateDepreciationEntries()
  - Log result summary
  - Return { success: true, entriesCreated, totalAmount }
```

**Vercel cron config** (add to `vercel.json`):
```json
{
  "crons": [{
    "path": "/api/cron/depreciation",
    "schedule": "0 6 1 * *"
  }]
}
```

Runs monthly on the 1st at 6:00 AM UTC.

**Idempotency:** Check for existing SYSTEM depreciation entries for the target month before generating. Skip if already processed.

---

## Step 15: Cron Job — AHP Interest Accrual

**File:** `src/app/api/cron/interest-accrual/route.ts` (new)

```
POST handler (Vercel cron):
  - Verify cron authorization header
  - Determine current month/year
  - Call generateInterestAccrualEntry()
  - Log result summary
  - Return { success: true, mode, amount }
```

**Vercel cron config:**
```json
{
  "path": "/api/cron/interest-accrual",
  "schedule": "0 6 28 * *"
}
```

Runs monthly on the 28th at 6:00 AM UTC (last business day of most months).

**Idempotency:** Check for existing SYSTEM interest accrual entries for the target month.

---

## Step 16: Cron Job — Prepaid Amortization

**File:** `src/app/api/cron/prepaid-amortization/route.ts` (new)

```
POST handler (Vercel cron):
  - Verify cron authorization header
  - Determine current month/year
  - Call generateAmortizationEntries()
  - Log result summary
  - Return { success: true, entriesCreated, totalAmount }
```

**Vercel cron config:**
```json
{
  "path": "/api/cron/prepaid-amortization",
  "schedule": "0 6 1 * *"
}
```

Runs monthly on the 1st at 6:00 AM UTC (same day as depreciation).

---

## Step 17: Server Actions — Fixed Assets

**File:** `src/app/(protected)/assets/actions.ts` (new)

**Read functions:**

```
getFixedAssets(filters?: { isActive?: boolean; parentId?: number }): Promise<FixedAssetRow[]>
  - Join with accounts for GL account names
  - Calculate: monthlyDepreciation, accumulatedDepreciation, netBookValue (as of today)
  - Include parent/child info

getFixedAssetById(id: number): Promise<FixedAssetDetail | null>
  - Full asset detail with GL account names
  - Children (components) if parent
  - Parent info if component
  - Depreciation schedule summary
  - CIP conversion info if applicable
  - Audit trail

getCipBalances(): Promise<CipBalanceSummary>
  - Delegate to lib/assets/cip-conversion.ts

getConvertedStructures(): Promise<CipConversion[]>
  - Delegate to lib/assets/cip-conversion.ts
```

**Write functions:**

```
createFixedAsset(data: InsertFixedAsset, userId: string): Promise<{ id: number }>
  - Validate via Zod schema
  - Insert fixed_asset record
  - Audit log
  - revalidatePath('/assets')

updateFixedAsset(id: number, data: UpdateFixedAsset, userId: string): Promise<void>
  - Validate via Zod schema
  - Update record
  - Audit log with before/after
  - revalidatePath('/assets', '/assets/[id]')

toggleFixedAssetActive(id: number, active: boolean, userId: string): Promise<void>
  - Guard: cannot deactivate if not fully depreciated (warn, soft block)
  - Update isActive
  - Audit log

executeCipConversionAction(input: CipConversionInput, userId: string): Promise<{ conversionId: number }>
  - Delegate to executeCipConversion()
  - revalidatePath('/assets', '/assets/cip')
```

**Type exports:**

```
FixedAssetRow = {
  id, name, description, acquisitionDate, cost, salvageValue, usefulLifeMonths,
  depreciationMethod, datePlacedInService,
  glAssetAccountName, glAccumDeprAccountName, glExpenseAccountName,
  cipConversionId, parentAssetId, parentAssetName,
  isActive, createdAt,
  // Calculated fields:
  monthlyDepreciation: string
  accumulatedDepreciation: string
  netBookValue: string
  isFullyDepreciated: boolean
}

FixedAssetDetail = FixedAssetRow & {
  children: FixedAssetRow[]
  parent: FixedAssetRow | null
  cipConversion: CipConversion | null
  auditEntries: AuditEntry[]
}
```

---

## Step 18: Server Actions — Prepaid Schedules

**File:** `src/app/(protected)/assets/prepaid-actions.ts` (new)

```
getPrepaidSchedules(filters?: { isActive?: boolean }): Promise<PrepaidScheduleRow[]>
  - Join with accounts and funds for names
  - Calculate remaining balance

createPrepaidSchedule(data: InsertPrepaidSchedule, userId: string): Promise<{ id: number }>
  - Validate via Zod
  - Calculate monthlyAmount
  - Insert record
  - Audit log

handlePrepaidRefund(scheduleId: number, refundAmount: number, userId: string): Promise<void>
  - Delegate to handleRefundTrueUp()
  - Audit log
```

---

## Step 19: Fixed Asset List Page

**File:** `src/app/(protected)/assets/page.tsx` — replace stub

Server component that fetches all assets and renders the client component.

**File:** `src/app/(protected)/assets/asset-list-client.tsx` (new)

TanStack Table with columns:
- Name (with indentation for components)
- Acquisition Date
- Cost (formatted currency)
- Useful Life (years display)
- Monthly Depreciation (calculated)
- Accumulated Depreciation (calculated)
- Net Book Value (calculated)
- Status badge (Active / Inactive / Fully Depreciated)
- Date Placed in Service

**Features:**
- Filterable by: type (building/equipment), active status
- Sortable by all columns
- Parent/child grouping: building parents show as expandable rows with component children indented
- "Create Asset" button → opens create dialog
- Row click → navigates to detail page
- Summary row at bottom: total cost, total accumulated depreciation, total net book value

**Help tooltips:** "Depreciation", "Useful Life", "Net Book Value", "Salvage Value", "Date Placed in Service"

---

## Step 20: Fixed Asset Create/Edit Form

**File:** `src/app/(protected)/assets/create-asset-dialog.tsx` (new)

Dialog form with fields:
- Name (text)
- Description (textarea, optional)
- Acquisition Date (date picker)
- Cost (currency input)
- Salvage Value (currency input, default $0)
- Useful Life (integer + "months" label, with years helper display)
- Date Placed in Service (date picker, optional)
- GL Asset Account (searchable dropdown — filtered to Asset type accounts)
- GL Accumulated Depreciation Account (searchable dropdown — filtered to Contra-Asset accounts)
- GL Depreciation Expense Account (searchable dropdown — defaults to Depreciation Expense 5200)
- Parent Asset (optional dropdown — filtered to existing building-level assets)

**Validation:** Real-time Zod validation. Salvage < cost check. All 3 GL accounts required.

**On submit:** Call createFixedAsset server action.

---

## Step 21: Fixed Asset Detail Page

**File:** `src/app/(protected)/assets/[id]/page.tsx` (new)

Server component — fetch asset by ID, render detail client.

**File:** `src/app/(protected)/assets/[id]/asset-detail-client.tsx` (new)

Sections:
1. **Asset header:** Name, status badge, edit button
2. **Asset details card:** All fields in read-only display (editable inline or via edit dialog)
3. **Depreciation summary:**
   - Monthly depreciation amount
   - Total accumulated depreciation
   - Net book value
   - Remaining months
   - Progress bar (accumulated / depreciable basis)
4. **Component breakdown** (only for parent building assets):
   - Table of child components: name, useful life, monthly depr, accum depr, NBV
   - Total row
5. **CIP conversion info** (only for assets created via conversion):
   - Conversion date, structure name, amounts from which CIP sub-accounts
   - Link to reclassification JE
6. **Depreciation history:**
   - List of recent depreciation JEs for this asset (filtered by GL accounts)
7. **Audit trail** for this asset

---

## Step 22: CIP Balance Viewer Page

**File:** `src/app/(protected)/assets/cip/page.tsx` (new)

Server component — fetch CIP balances.

**File:** `src/app/(protected)/assets/cip/cip-balance-client.tsx` (new)

Display:
1. **CIP Summary card:** Total CIP balance across all sub-accounts
2. **Sub-account breakdown table:**
   - CIP - Hard Costs (1510): balance
   - CIP - Soft Costs (1520): balance
   - CIP - Reserves & Contingency (1530): balance
   - CIP - Developer Fee (1540): balance
   - CIP - Construction Interest (1550): balance
3. **Drill-down:** Clicking a sub-account shows cost code breakdown:
   - Each cost code with its balance within that sub-account
   - Expandable/collapsible sections
4. **Conversion history:** List of completed CIP conversions with dates and amounts
5. **Action button:** "Convert to Fixed Asset →" navigates to conversion wizard

**Help tooltips:** "CIP", "Hard Costs", "Soft Costs", "Cost Code"

---

## Step 23: CIP-to-Fixed-Asset Conversion Wizard

**File:** `src/app/(protected)/assets/cip/convert/page.tsx` (new)

Server component — fetch CIP balances, accounts, converted structures.

**File:** `src/app/(protected)/assets/cip/convert/conversion-wizard-client.tsx` (new)

5-step wizard (per DM-P0-030):

### Step 1: Select Structure
- Radio group: Lodging / Barn / Garage
- Show which structures are already converted (disabled, with conversion date)
- Cannot convert an already-converted structure

### Step 2: Select CIP Sources
- For selected structure, show checkboxes for CIP sub-accounts with balances
- Within each checked sub-account, optional cost code selection
- Show amount for each selected source
- Running total of selected amount
- Support partial allocation (can select less than full balance per DM-P0-031)

### Step 3: Allocate to Components
- **If Lodging:** Show allocation table with predefined component rows:
  - Structure (default 27.5yr / 330 months)
  - Roof (default 20yr / 240 months)
  - HVAC (default 15yr / 180 months)
  - Electrical (default 17.5yr / 210 months)
  - Plumbing (default 17.5yr / 210 months)
  - Windows (default 17.5yr / 210 months)
  - Flooring (default 7.5yr / 90 months)
  - User can add/remove component rows
  - Each row: component name, amount (editable), useful life months (editable)
  - GL accounts pre-filled: Asset → Building - Lodging (1600), Accum Depr → 1800, Expense → 5200
  - Validation: sum of component amounts = total from Step 2
- **If Barn or Garage:** Single row, single-item allocation:
  - Name: "Barn" / "Garage"
  - Amount: total from Step 2
  - Useful life: 330 months (27.5yr)
  - GL accounts: Building - Barn (1610) / Building - Garage (1620), Accum Depr → 1810/1820, Expense → 5200

### Step 4: Review
- Show the reclassification JE that will be generated:
  - DR lines: Building accounts per component
  - CR lines: CIP sub-accounts per source
  - Total debits = total credits
- Show the fixed asset records that will be created
- Show depreciation schedule summary (monthly amount per component)
- "This action will create [N] fixed asset records and 1 reclassification journal entry."

### Step 5: Confirm & Execute
- "Confirm Conversion" button
- On click: call executeCipConversionAction
- On success: redirect to newly created asset detail page
- Show success message with links to:
  - Created assets
  - Reclassification JE
  - CIP balance viewer (to verify remaining balance)

**State management:** React state for wizard steps. No server persistence until Step 5 commit.

---

## Step 24: Developer Fee Tracking View

**File:** `src/app/(protected)/assets/developer-fee/page.tsx` (new)

Display based on CIP - Developer Fee (1540) account and Deferred Developer Fee Payable (2510) account:

1. **Total Developer Fee:** $827,000 (from implementation plan)
2. **Cash Paid:** sum of debits to CIP - Developer Fee funded from Cash
3. **Deferred Amount:** balance of Deferred Developer Fee Payable (2510)
4. **Paydown History:** transactions that debit Deferred Developer Fee Payable
5. **GL entries:** Recent transactions involving accounts 1540 and 2510

This is a read-only summary view — actual JEs for developer fee are manual entries.

---

## Step 25: Prepaid Expense Management

**File:** `src/app/(protected)/assets/prepaid/page.tsx` (new)

List of active and completed prepaid schedules:

**TanStack Table columns:**
- Description
- Total Amount
- Start Date — End Date
- Monthly Amount
- Amount Amortized / Remaining
- Progress bar
- Status (Active / Completed)

**Actions:**
- "Create Prepaid Schedule" button → form dialog
- Row click → detail view
- "Record Refund" action for active schedules

**Create dialog fields:**
- Description
- Total Amount
- Start Date (date picker)
- End Date (date picker)
- GL Expense Account (searchable dropdown, filtered to Expense type)
- GL Prepaid Account (defaults to Prepaid Expenses 1200)
- Fund (searchable fund selector)
- Auto-calculated: monthly amount, number of months

---

## Step 26: Help Tooltip Terms

**File:** `src/lib/help/terms.ts` — add new terms

New terms to add:

| Term | Content |
|------|---------|
| depreciation | Systematic allocation of a fixed asset's cost over its useful life. RI uses straight-line method per D-127: (cost - salvage) ÷ useful life months. Per IRS Pub 946 and IRC § 168. |
| useful-life | The estimated number of months an asset will provide economic benefit. Building structures: 27.5yr (330mo), Roof: 20yr, HVAC/MEP: 15-20yr, Flooring: 5-10yr, Equipment: 5-7yr. Per IRS Pub 946. |
| net-book-value | An asset's cost minus accumulated depreciation. Represents the remaining undepreciated balance on the books. |
| salvage-value | Estimated residual value of an asset at the end of its useful life. RI defaults to $0 for all fixed assets per D-127. |
| date-placed-in-service | The date an asset begins being used for its intended purpose. Depreciation starts the month following PIS date. For CIP conversions, this is the date the structure is ready for occupancy. |
| cip-conversion | The process of reclassifying Construction in Progress costs to fixed asset accounts when a structure is placed in service. Generates a reclassification JE: DR Building, CR CIP. Per DM-P0-030. |
| component-depreciation | Depreciating a building's major components (structure, roof, HVAC, etc.) separately, each with its own useful life. Required for the Lodging building per DM-P0-020. |
| interest-capitalization | During construction, AHP loan interest is capitalized to CIP - Construction Interest rather than expensed. Per ASC 835-20. Switches to expense mode when all structures are placed in service. |
| prepaid-amortization | Monthly recognition of a prepaid expense over its coverage period. DR Expense, CR Prepaid. Auto-generated via cron. Per TXN-P0-054. |
| developer-fee | RI's development fee ($827K) — partially paid in cash during construction, remainder deferred as a long-term liability (Deferred Developer Fee Payable). Related-party transaction. Per DM-P0-033. |
| ahp-loan | Affordable Housing Program loan from FHLBB. $3.5M credit facility. Interest accrues monthly, paid annually Dec 31. Available credit = limit - drawn. Per DM-P0-025. |

---

## Step 27: Navigation Updates

**File:** `src/components/layout/nav-items.ts` — update

Add sub-navigation under Assets:
```
Assets (parent)
  ├─ Fixed Assets (/assets)
  ├─ CIP Balances (/assets/cip)
  ├─ CIP Conversion (/assets/cip/convert)
  ├─ Developer Fee (/assets/developer-fee)
  └─ Prepaid Expenses (/assets/prepaid)
```

---

## Step 28: Unit Tests

**File:** `src/lib/assets/depreciation.test.ts` (new)

Tests:
1. **Straight-line calculation:** asset with $120,000 cost, $0 salvage, 330 months → $363.64/month
2. **Salvage value:** asset with $10,000 cost, $1,000 salvage, 60 months → $150.00/month
3. **Accumulated depreciation:** 12 months elapsed → 12 × monthly amount
4. **Fully depreciated:** accumulated = depreciable basis → skip
5. **Net book value:** cost - accumulated = NBV
6. **Final month rounding:** ensure no over-depreciation (accumulated never exceeds cost - salvage)
7. **Component depreciation:** parent with 3 children, each depreciates independently
8. **No depreciation before PIS:** asset without datePlacedInService → skip

**File:** `src/lib/assets/interest-accrual.test.ts` (new)

Tests:
1. **Construction mode:** no conversions → DR CIP - Construction Interest
2. **Post-construction mode:** all 3 structures converted → DR Interest Expense
3. **Partial conversion:** 2 of 3 converted → still construction mode
4. **Zero drawn amount:** skip, no entry generated
5. **Monthly calculation:** $100,000 drawn at 3% → $250/month
6. **Idempotency:** already accrued for month → skip

**File:** `src/lib/assets/cip-conversion.test.ts` (new)

Tests:
1. **Lodging conversion with components:** 7 components created, JE balances
2. **Barn conversion single-item:** 1 asset created
3. **Partial conversion:** remaining CIP balance preserved
4. **JE correctness:** DR Building accounts = CR CIP sub-accounts
5. **Duplicate conversion rejected:** cannot convert same structure twice
6. **Insufficient CIP balance:** rejected with error
7. **Fixed asset records:** correct GL accounts, useful life, PIS date set

**File:** `src/lib/assets/prepaid-amortization.test.ts` (new)

Tests:
1. **Monthly pro-ration:** $12,000 over 12 months → $1,000/month
2. **Final month remainder:** handles rounding correctly
3. **Refund true-up:** reduces remaining balance, recalculates monthly
4. **Completed schedule:** skips fully amortized schedules
5. **Idempotency:** already processed for month → skip

---

## Step 29: E2E Tests

**File:** `e2e/assets.spec.ts` (new)

Test flows:
1. **Create a fixed asset:** Navigate to /assets → click Create → fill form → submit → verify in list with calculated depreciation amounts
2. **View component hierarchy:** Create parent building asset + 2 components → verify detail page shows component breakdown
3. **CIP conversion wizard:** Seed CIP balance via manual JE → navigate to /assets/cip/convert → step through wizard → verify:
   - Fixed asset records created
   - Reclassification JE generated (balances)
   - CIP balance reduced
   - Asset appears in fixed assets list
4. **Depreciation cron (manual trigger):** Create asset with PIS date → trigger depreciation endpoint → verify GL entry created with correct DR/CR accounts and amounts

---

## Step 30: Vercel Configuration

**File:** `vercel.json` — create or update

```json
{
  "crons": [
    {
      "path": "/api/cron/depreciation",
      "schedule": "0 6 1 * *"
    },
    {
      "path": "/api/cron/interest-accrual",
      "schedule": "0 6 28 * *"
    },
    {
      "path": "/api/cron/prepaid-amortization",
      "schedule": "0 6 1 * *"
    }
  ]
}
```

---

## File Summary

### New Files (24)

| File | Purpose |
|------|---------|
| `src/lib/db/schema/fixed-assets.ts` | Fixed assets table definition |
| `src/lib/db/schema/cip-conversions.ts` | CIP conversions table |
| `src/lib/db/schema/cip-conversion-lines.ts` | CIP conversion line items |
| `src/lib/db/schema/ahp-loan-config.ts` | AHP loan singleton config |
| `src/lib/db/schema/prepaid-schedules.ts` | Prepaid amortization schedules |
| `src/lib/db/seed/ahp-loan-config.ts` | AHP loan config seed data |
| `src/lib/validators/fixed-assets.ts` | Fixed asset Zod schemas |
| `src/lib/validators/cip-conversions.ts` | CIP conversion Zod schemas |
| `src/lib/validators/prepaid-schedules.ts` | Prepaid schedule Zod schemas |
| `src/lib/assets/depreciation.ts` | Depreciation calculation engine |
| `src/lib/assets/interest-accrual.ts` | AHP interest accrual engine |
| `src/lib/assets/cip-conversion.ts` | CIP conversion logic |
| `src/lib/assets/prepaid-amortization.ts` | Prepaid amortization engine |
| `src/app/api/cron/depreciation/route.ts` | Monthly depreciation cron |
| `src/app/api/cron/interest-accrual/route.ts` | Monthly interest accrual cron |
| `src/app/api/cron/prepaid-amortization/route.ts` | Monthly prepaid amort cron |
| `src/app/(protected)/assets/actions.ts` | Fixed asset server actions |
| `src/app/(protected)/assets/prepaid-actions.ts` | Prepaid schedule server actions |
| `src/app/(protected)/assets/asset-list-client.tsx` | Asset list with TanStack Table |
| `src/app/(protected)/assets/create-asset-dialog.tsx` | Asset creation form |
| `src/app/(protected)/assets/[id]/page.tsx` | Asset detail page (server) |
| `src/app/(protected)/assets/[id]/asset-detail-client.tsx` | Asset detail (client) |
| `src/app/(protected)/assets/cip/page.tsx` | CIP balance viewer |
| `src/app/(protected)/assets/cip/cip-balance-client.tsx` | CIP balance display |
| `src/app/(protected)/assets/cip/convert/page.tsx` | CIP conversion wizard (server) |
| `src/app/(protected)/assets/cip/convert/conversion-wizard-client.tsx` | 5-step wizard (client) |
| `src/app/(protected)/assets/developer-fee/page.tsx` | Developer fee tracking |
| `src/app/(protected)/assets/prepaid/page.tsx` | Prepaid expense management |
| `src/lib/assets/depreciation.test.ts` | Depreciation unit tests |
| `src/lib/assets/interest-accrual.test.ts` | Interest accrual unit tests |
| `src/lib/assets/cip-conversion.test.ts` | CIP conversion unit tests |
| `src/lib/assets/prepaid-amortization.test.ts` | Prepaid amortization tests |
| `e2e/assets.spec.ts` | E2E tests |
| `vercel.json` | Cron job configuration |

### Modified Files (5)

| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add depreciationMethodEnum |
| `src/lib/db/schema/index.ts` | Export new tables, add relations |
| `src/lib/db/seed/index.ts` | Include AHP loan config seed |
| `src/lib/validators/index.ts` | Export new validators |
| `src/lib/help/terms.ts` | Add 11 new help tooltip terms |
| `src/components/layout/nav-items.ts` | Add assets sub-navigation |
| `src/app/(protected)/assets/page.tsx` | Replace stub with real page |

---

## Requirements Satisfied

| Requirement | Description | Step |
|------------|-------------|------|
| DM-P0-019 | Fixed asset entity with all fields | 2, 9 |
| DM-P0-020 | Component depreciation for Lodging | 10, 21, 23 |
| DM-P0-030 | CIP-to-fixed-asset conversion wizard | 13, 23 |
| DM-P0-031 | Partial CIP conversion supported | 13, 23 |
| DM-P0-033 | Developer fee tracking | 24 |
| DM-P0-025 | AHP loan metadata config | 5, 8 |
| TXN-P0-038 | Monthly depreciation (straight-line, General Fund) | 10, 14 |
| TXN-P0-039 | Monthly AHP interest accrual (construction/post-construction) | 11, 15 |
| TXN-P0-054 | Prepaid expense amortization | 12, 16, 25 |
| INV-008 | System-generated entries non-editable | 10, 11, 12 |
| D-127 | Straight-line only depreciation | 10 |
| D-080 | Component depreciation for building | 10, 23 |

---

## Execution Order

Recommended build sequence (dependencies shown):

```
1. Enums (Step 1)
2. Schema tables (Steps 2-6) → depends on 1
3. Migrations (Step 7) → depends on 2
4. Seed data (Step 8) → depends on 3
5. Validators (Step 9) → depends on 1
6. Help terms (Step 26) → independent
7. Navigation (Step 27) → independent
│
├── Depreciation engine (Step 10) → depends on 3, 5
│   ├── Depreciation cron (Step 14) → depends on 10
│   └── Depreciation tests (Step 28a) → depends on 10
│
├── Interest accrual engine (Step 11) → depends on 3, 5
│   ├── Interest cron (Step 15) → depends on 11
│   └── Interest tests (Step 28b) → depends on 11
│
├── Prepaid engine (Step 12) → depends on 3, 5
│   ├── Prepaid cron (Step 16) → depends on 12
│   └── Prepaid tests (Step 28c) → depends on 12
│
├── CIP conversion logic (Step 13) → depends on 3, 5, 10
│   └── CIP conversion tests (Step 28d) → depends on 13
│
├── Server actions (Steps 17-18) → depends on 10, 11, 12, 13
│
├── Fixed asset list page (Step 19) → depends on 17
├── Create asset form (Step 20) → depends on 17
├── Asset detail page (Step 21) → depends on 17
├── CIP balance viewer (Step 22) → depends on 17
├── CIP conversion wizard (Step 23) → depends on 13, 17
├── Developer fee view (Step 24) → depends on 17
├── Prepaid management (Step 25) → depends on 18
│
└── E2E tests (Step 29) → depends on all pages
    Vercel config (Step 30) → independent
```

**Parallelization opportunities:**
- Steps 10, 11, 12 (depreciation, interest, prepaid engines) are independent — can be built in parallel
- Steps 19-25 (UI pages) are independent once server actions are ready
- Unit tests can be written alongside their corresponding engines
