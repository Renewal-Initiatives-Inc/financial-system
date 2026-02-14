# Phase 14: Budgeting & Cash Projection — Execution Plan

**Phase dependency:** Phase 4 (Chart of Accounts & Fund Management UI)
**Parallel with:** Phases 7-13 (independent domain)
**Source:** implementation_plan.md Section 16, design.md Section 2.4, requirements.md Section 6

---

## Pre-Flight Checks

Before starting, verify Phase 3 deliverables are working:

- [ ] GL engine creates transactions successfully (`src/lib/gl/engine.ts`)
- [ ] Accounts and funds tables are seeded with all 69 accounts and 6 funds
- [ ] Audit logger is operational (`src/lib/audit/logger.ts`)
- [ ] Transaction lines with fund coding work correctly
- [ ] Database migrations run cleanly (`npx drizzle-kit push`)

---

## Step 1: Database Schema — Budget Tables

**Files to create:**
- `src/lib/db/schema/budgets.ts`
- `src/lib/db/schema/budget-lines.ts`
- `src/lib/db/schema/cash-projections.ts`
- `src/lib/db/schema/cash-projection-lines.ts`

**Files to modify:**
- `src/lib/db/schema/enums.ts` — add `budgetStatusEnum`, `spreadMethodEnum`, `projectionLineTypeEnum`
- `src/lib/db/schema/index.ts` — export new tables + relations

### 1a. New Enums (`enums.ts`)

```
budgetStatusEnum: 'DRAFT' | 'APPROVED'
spreadMethodEnum: 'EVEN' | 'SEASONAL' | 'ONE_TIME' | 'CUSTOM'
projectionLineTypeEnum: 'INFLOW' | 'OUTFLOW'
```

### 1b. `budgets` Table

Per design.md Section 2.4:

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| fiscalYear | integer | e.g. 2026. UNIQUE — one active budget per FY (BDG-P0-005) |
| status | budgetStatusEnum | DRAFT or APPROVED |
| createdBy | varchar(255) | User who created |
| createdAt | timestamp | |
| updatedAt | timestamp | |

Index on `fiscalYear` (unique).

### 1c. `budget_lines` Table

Per design.md Section 2.4 and BDG-P0-001:

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| budgetId | integer FK → budgets | |
| accountId | integer FK → accounts | GL account |
| fundId | integer FK → funds | Fund dimension |
| annualAmount | numeric(15,2) | Total annual budget for this account×fund |
| spreadMethod | spreadMethodEnum | EVEN, SEASONAL, ONE_TIME, CUSTOM |
| monthlyAmounts | jsonb | 12-element array [Jan..Dec], each a number |
| createdAt | timestamp | |
| updatedAt | timestamp | |

UNIQUE constraint on `(budgetId, accountId, fundId)` — one line per account per fund per budget.
Index on `budgetId`.

**Design note:** `monthlyAmounts` is a JSON array of 12 numbers. For EVEN spread, each = annualAmount/12. For SEASONAL, user sets weights. For ONE_TIME, one month has the full amount. For CUSTOM, user sets each month directly. The application layer calculates monthly amounts from the spread method + annual amount.

### 1d. `cash_projections` Table

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| fiscalYear | integer | |
| asOfDate | date | When projection was created/updated |
| createdBy | varchar(255) | |
| createdAt | timestamp | |
| updatedAt | timestamp | |

### 1e. `cash_projection_lines` Table

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| projectionId | integer FK → cash_projections | |
| month | integer | 1-12 |
| sourceLabel | varchar(255) | e.g. "Rent Income", "Grant Draws", "AHP Interest" |
| autoAmount | numeric(15,2) | System-calculated from budget or 3-month avg |
| overrideAmount | numeric(15,2) nullable | User manual override |
| overrideNote | text nullable | Explanation for override |
| lineType | projectionLineTypeEnum | INFLOW or OUTFLOW |
| sortOrder | integer | Display ordering |
| createdAt | timestamp | |

Index on `projectionId`.

### 1f. Relations (add to `index.ts`)

- budget → many budget_lines
- budget_line → one account, one fund, one budget
- cash_projection → many cash_projection_lines

### 1g. Migration

Run `npx drizzle-kit generate` then `npx drizzle-kit push` to deploy schema.

**Acceptance criteria:**
- All 4 tables created in dev DB
- UNIQUE constraint on budgets.fiscalYear enforced
- UNIQUE constraint on budget_lines.(budgetId, accountId, fundId) enforced
- FK constraints to accounts and funds work correctly

---

## Step 2: Zod Validators

**Files to create:**
- `src/lib/validators/budgets.ts`
- `src/lib/validators/cash-projections.ts`

**Files to modify:**
- `src/lib/validators/index.ts` — re-export new validators

### 2a. Budget Validators (`budgets.ts`)

```typescript
// insertBudgetSchema
- fiscalYear: z.number().int().min(2025).max(2100)
- status: z.enum(['DRAFT', 'APPROVED']).default('DRAFT')
- createdBy: z.string().min(1)

// insertBudgetLineSchema
- budgetId: z.number().int().positive()
- accountId: z.number().int().positive()
- fundId: z.number().int().positive()
- annualAmount: z.number().multipleOf(0.01)  // can be negative for contra accounts
- spreadMethod: z.enum(['EVEN', 'SEASONAL', 'ONE_TIME', 'CUSTOM'])
- monthlyAmounts: z.array(z.number()).length(12)
  .refine(arr => arr matches spread method rules)

// updateBudgetLineSchema
- annualAmount: optional
- spreadMethod: optional
- monthlyAmounts: optional (with recalc validation)

// Spread validation refinements:
// - EVEN: each month ≈ annualAmount / 12 (within rounding)
// - SEASONAL: sum of months = annualAmount
// - ONE_TIME: exactly one month non-zero, equals annualAmount
// - CUSTOM: sum of months = annualAmount
```

### 2b. Cash Projection Validators (`cash-projections.ts`)

```typescript
// insertCashProjectionSchema
- fiscalYear: z.number().int()
- asOfDate: z.string().date()
- createdBy: z.string().min(1)

// insertCashProjectionLineSchema
- projectionId: z.number().int().positive()
- month: z.number().int().min(1).max(12)
- sourceLabel: z.string().min(1).max(255)
- autoAmount: z.number().multipleOf(0.01)
- overrideAmount: z.number().multipleOf(0.01).nullable().optional()
- overrideNote: z.string().nullable().optional()
  .refine: if overrideAmount set, overrideNote required
- lineType: z.enum(['INFLOW', 'OUTFLOW'])
- sortOrder: z.number().int()
```

**Acceptance criteria:**
- Spread method validation enforces sum = annualAmount
- ONE_TIME validates exactly one non-zero month
- Override note required when override amount provided

---

## Step 3: Budget Business Logic

**Files to create:**
- `src/lib/budget/spread.ts` — spread calculation functions
- `src/lib/budget/variance.ts` — variance calculation against GL actuals
- `src/lib/budget/projection.ts` — cash projection auto-fill logic
- `src/lib/budget/queries.ts` — budget data access queries
- `src/lib/budget/index.ts` — re-exports

### 3a. Spread Calculator (`spread.ts`)

Functions:
- `calculateEvenSpread(annualAmount: number): number[]` — divide by 12, handle rounding (last month absorbs remainder)
- `calculateSeasonalSpread(annualAmount: number, weights: number[]): number[]` — distribute by weight proportions, must sum to annualAmount
- `calculateOneTimeSpread(annualAmount: number, targetMonth: number): number[]` — full amount in one month, zeros elsewhere
- `validateCustomSpread(monthlyAmounts: number[], annualAmount: number): boolean` — verify sum matches
- `recalculateSpread(method: SpreadMethod, annualAmount: number, params?: { weights?: number[], targetMonth?: number }): number[]` — dispatcher

### 3b. Variance Calculator (`variance.ts`)

Functions:
- `calculateVariance(actual: number, budget: number): { dollarVariance: number, percentVariance: number | null, severity: 'normal' | 'warning' | 'critical' }` — dollar and percentage variance, severity per RPT-P0-005 (>10% = warning/yellow, >25% = critical/red)
- `getActualsForPeriod(accountId: number, fundId: number, startDate: string, endDate: string): Promise<number>` — query GL transaction lines, sum debits - credits (adjusted for normal balance direction), excluding voided transactions
- `getBudgetVsActual(budgetId: number, month?: number, fundId?: number): Promise<BudgetVarianceRow[]>` — returns array of { accountId, accountName, accountCode, fundId, fundName, budgetAmount, actualAmount, dollarVariance, percentVariance, severity }

**Variance calculation logic:**
- For revenue accounts (normal balance = Credit): actual = sum(credits) - sum(debits)
- For expense accounts (normal balance = Debit): actual = sum(debits) - sum(credits)
- Dollar variance = actual - budget (positive = over budget for expenses, under target for revenue)
- Percent variance = (actual - budget) / budget * 100 (null if budget = 0)
- Severity: abs(percentVariance) > 25 → critical, abs(percentVariance) > 10 → warning, else normal
- **Phase 17 cross-reference:** The same severity thresholds and color scheme apply to the functional allocation wizard's benchmark comparison panel (outlier flagging at <65% or >90% program allocation). The `variance-indicator` component (Step 5) should be designed for reuse in both contexts.

### 3c. Cash Projection Auto-Fill (`projection.ts`)

Functions:
- `generateProjectionLines(startMonth: number, budgetId?: number): Promise<CashProjectionLine[]>` — for 3 months ahead:
  1. Try budget data first for each revenue/expense account
  2. Fall back to average of last 3 months actuals if no budget line
  3. Group into inflow/outflow categories
  4. Include: rent income, grant draws, other revenue (inflows); payables, AHP interest, capital spending (outflows)
  5. Starting cash = current bank balance (placeholder until Plaid integration in Phase 12)
- `getStartingCash(): Promise<number>` — sum of all cash-type account balances from GL
- `getThreeMonthActualAverage(accountId: number, fundId: number): Promise<number>` — average monthly actual over last 3 months

### 3d. Budget Queries (`queries.ts`)

Functions:
- `createBudget(input: InsertBudget): Promise<Budget>` — create budget, audit log
- `getBudget(id: number): Promise<Budget>` — single budget with lines
- `getBudgetByFiscalYear(year: number): Promise<Budget | null>` — lookup by FY
- `getBudgetList(): Promise<Budget[]>` — all budgets
- `createBudgetLine(input: InsertBudgetLine): Promise<BudgetLine>` — create line, audit log
- `updateBudgetLine(id: number, updates: UpdateBudgetLine, userId: string): Promise<BudgetLine>` — update line, enforce mid-year lock, audit log
- `deleteBudgetLine(id: number, userId: string): Promise<void>` — remove line, audit log
- `updateBudgetStatus(id: number, status: 'DRAFT' | 'APPROVED', userId: string): Promise<Budget>` — status change, audit log
- `getBudgetForMonth(fiscalYear: number, month: number, fundId?: number): Promise<BudgetLineWithAmount[]>` — returns budget amounts for a specific month, optionally filtered by fund
- `createCashProjection(input: InsertCashProjection): Promise<CashProjection>` — create projection record
- `saveCashProjectionLines(projectionId: number, lines: InsertCashProjectionLine[]): Promise<void>` — upsert lines

**Mid-year revision logic (BDG-P0-005):**
- Determine current month
- When updating a budget line, lock monthly amounts for months ≤ current month
- Only future months are editable
- Implementation: `updateBudgetLine` checks if any locked months are being changed

**Acceptance criteria:**
- Even spread produces 12 equal amounts (±$0.01 rounding)
- Seasonal spread distributes proportionally to weights
- One-time spread places full amount in single month
- Custom spread validates sum = annual amount
- Variance correctly handles revenue vs expense normal balance
- Color thresholds: >10% = yellow, >25% = red
- Mid-year lock prevents editing past months
- Cash projection auto-fills from budget, falls back to 3-month average

---

## Step 4: Server Actions

**Files to create:**
- `src/app/(protected)/budgets/actions.ts` — server actions for budget CRUD
- `src/app/(protected)/budgets/cash-projection/actions.ts` — server actions for projection

### 4a. Budget Actions

```typescript
'use server'
// createBudgetAction(formData) — create new budget for fiscal year
// saveBudgetLineAction(formData) — create or update a budget line
// deleteBudgetLineAction(lineId) — remove a budget line
// approveBudgetAction(budgetId) — move from DRAFT to APPROVED
// getBudgetDataAction(budgetId, month?, fundId?) — fetch budget with variance data
```

Each action:
1. Authenticate via `auth()`
2. Validate input via Zod schema
3. Call budget query function
4. Return result or error

### 4b. Cash Projection Actions

```typescript
'use server'
// generateProjectionAction(fiscalYear) — auto-fill 3-month projection
// saveProjectionAction(projectionId, lines) — save overrides
// getProjectionAction(projectionId) — fetch projection with lines
```

---

## Step 5: Budget UI Pages

**Files to create:**
- `src/app/(protected)/budgets/page.tsx` — budget list (replace placeholder)
- `src/app/(protected)/budgets/new/page.tsx` — create budget
- `src/app/(protected)/budgets/[id]/page.tsx` — budget review (variance view)
- `src/app/(protected)/budgets/[id]/edit/page.tsx` — budget line entry/editing
- `src/app/(protected)/budgets/cash-projection/page.tsx` — 3-month projection
- `src/components/budgets/budget-line-table.tsx` — TanStack Table for budget entry
- `src/components/budgets/spread-mode-selector.tsx` — spread method picker + config
- `src/components/budgets/variance-indicator.tsx` — color-coded variance badge
- `src/components/budgets/monthly-amounts-editor.tsx` — 12-month amount grid
- `src/components/budgets/cash-projection-table.tsx` — projection table with overrides

### 5a. Budget List Page (`/budgets`)

Replace existing placeholder. TanStack Table showing:
- Fiscal year
- Status badge (Draft / Approved)
- Created by
- Created date
- Total budget amount (sum of all lines)
- "New Budget" button

### 5b. Create Budget Page (`/budgets/new`)

Simple form:
- Fiscal year selector (dropdown of available years — reject if year already has budget)
- Status defaults to DRAFT
- On submit: create budget, redirect to edit page

### 5c. Budget Line Entry Page (`/budgets/[id]/edit`)

This is the primary budget entry interface. TanStack Table where:

**Layout:**
- Fund filter dropdown at top (optional — "All Funds" default, or filter to single fund)
- Account type tabs or filter: Revenue / Expense / Capital (CIP + fixed assets)
- Table: rows = GL accounts, organized by type

**Table columns:**
- Account code
- Account name
- Fund name
- Annual amount (editable input)
- Spread method (dropdown: Even / Seasonal / One-Time / Custom)
- 12 monthly columns (Jan–Dec) — auto-calculated from spread, editable for Custom
- Actions (delete line)

**Behavior:**
- "Add Line" button opens selector: pick GL account + fund → creates new budget line
- Changing annual amount auto-recalculates monthly columns per spread method
- Changing spread method recalculates monthly columns
- For SEASONAL: additional UI to set monthly weights (sliders or percentage inputs)
- For ONE_TIME: month picker to select which month gets the full amount
- For CUSTOM: all 12 months are directly editable, annual amount = sum
- Mid-year revision: months ≤ current month are greyed out / non-editable (BDG-P0-005)
- Auto-save on blur or debounced input (avoid explicit save button per line)
- "Approve Budget" button (changes status DRAFT → APPROVED)

**Account type filtering (BDG-P0-003):**
- Revenue accounts + Expense accounts = operating budget
- CIP sub-accounts + fixed asset accounts = capital budget
- AHP-related accounts = financing budget
- No separate field needed — account type determines category

### 5d. Budget Review Page (`/budgets/[id]`)

Read-only variance view. TanStack Table:
- Account code, account name, fund
- Budget amount (monthly or YTD depending on period selector)
- Actual amount (from GL)
- Dollar variance
- Percent variance
- Severity indicator (green / yellow / red per RPT-P0-005)

**Controls:**
- Period selector: individual month or Year-to-Date
- Fund filter
- "Edit Budget" button → navigate to edit page

### 5e. Cash Projection Page (`/budgets/cash-projection`)

Per BDG-P0-008 and Report #15:

**Layout:**
- 3 monthly columns (next 3 months)
- Row groups: Starting Cash, Inflows, Outflows, Ending Cash

**Inflow rows:** Rent income, Grant draws, Other revenue, Budget inflows
**Outflow rows:** Outstanding payables, Budget outflows, AHP interest, Capital spending

**Per row, per month:**
- Auto amount (system-calculated, grey/italic)
- Override amount (editable input, bold when set)
- Override note (expandable text, required when override entered)

**Footer:**
- AHP available credit (informational context)
- Save button
- "Generate" button to re-run auto-fill

### 5f. CIP Budget View

Within the budget review page, when filtering to CIP accounts:
- Show budget vs actual at sub-account level (Hard Costs, Soft Costs, etc.)
- Drill-down to cost code level within each sub-account (DM-P0-029)
- This requires joining budget_lines to cip_cost_codes (optional — budget lines are at account×fund level; cost code drill-down shows actuals by cost code against the sub-account budget)

**Implementation note:** CIP budget drill-down to cost code level shows GL actuals grouped by cip_cost_code_id against the budget line for the CIP sub-account. Budget lines themselves don't have cost codes — the drill-down is on the actuals side.

---

## Step 6: Compliance Calendar Integration

**Files to modify:**
- Budget-related compliance deadlines should be noted for Phase 17 (Compliance Calendar). For now, add constants/config that Phase 17 can consume.

**File to create:**
- `src/lib/budget/compliance.ts` — export budget cycle milestone dates

```typescript
// Budget cycle milestones (BDG-P0-004)
export const BUDGET_CYCLE_MILESTONES = [
  { month: 9, label: 'Budget Review — September' },
  { month: 10, label: 'ED Budget Draft — October' },
  { month: 11, label: 'Board Budget Circulation — November' },
  { month: 12, label: 'Board Budget Approval — December' },
]

// Public support trajectory review (from MCP research Feb 2025)
// As rental income enters Total Support denominator (Schedule A Line 10a)
// but NOT Public Support numerator (Line 1), RI's public support % will
// decline post-construction. Proactive review ensures ratio stays above
// 33⅓% per IRC § 509(a). Target ~FY2028 when rental income is stabilized.
export const PUBLIC_SUPPORT_REVIEW_MILESTONE = {
  label: 'Public Support Trajectory Review',
  description: 'Review Schedule A public support percentage — rental income pressures ratio post-construction',
  targetFiscalYear: 2028,
}
```

This data is consumed by the compliance calendar (Phase 17) to generate budget-related and compliance reminders.

---

## Step 7: Unit Tests

**Files to create:**
- `src/lib/budget/spread.test.ts`
- `src/lib/budget/variance.test.ts`
- `src/lib/budget/projection.test.ts`
- `src/lib/validators/budgets.test.ts`

### 7a. Spread Tests (`spread.test.ts`)

- EVEN: $12,000 → 12 × $1,000.00
- EVEN rounding: $10,000 → 11 × $833.33 + 1 × $833.37 (or similar rounding strategy)
- EVEN: $0 → 12 × $0.00
- EVEN: negative amount (contra-revenue account) → 12 × negative
- SEASONAL: $12,000 with weights [2,1,1,1,1,1,1,1,1,1,1,1] (total weight 12) → Jan $2,000, Feb-Dec $1,000
- SEASONAL: weights must be positive
- SEASONAL: weighted result sums to annual amount exactly
- ONE_TIME: $5,000 in month 6 → [0,0,0,0,0,5000,0,0,0,0,0,0]
- ONE_TIME: month must be 1-12
- CUSTOM: user provides exact months, validates sum = annual
- CUSTOM: rejects if sum ≠ annual amount

### 7b. Variance Tests (`variance.test.ts`)

- Expense account: budget $1,000, actual $1,200 → $200 over, 20% → warning (yellow)
- Expense account: budget $1,000, actual $1,300 → $300 over, 30% → critical (red)
- Expense account: budget $1,000, actual $900 → -$100, -10% → normal (green)
- Revenue account: budget $5,000, actual $4,000 → -$1,000 under target, -20% → warning
- Budget = $0: variance = actual amount, percent = null
- Voided transactions excluded from actuals
- System-generated entries included in actuals (depreciation, interest)

### 7c. Projection Tests (`projection.test.ts`)

- Auto-fill from budget data: if budget line exists for rent income, use budget amount
- Fallback to 3-month average: if no budget line, average last 3 months GL actuals
- Starting cash = sum of cash account balances
- Override replaces auto amount in display
- Override note required when override provided

### 7d. Validator Tests (`budgets.test.ts`)

- Valid budget creation accepted
- Duplicate fiscal year rejected (at DB level)
- Budget line with invalid accountId rejected
- Spread method EVEN produces valid monthly amounts
- ONE_TIME with invalid month (0, 13) rejected
- CUSTOM spread where sum ≠ annual rejected
- Mid-year lock: updating locked month rejected

---

## Step 8: E2E Test

**File to create:**
- `tests/e2e/budgets.spec.ts` (Playwright)

### Test scenario:

1. Navigate to `/budgets`
2. Click "New Budget" → fill fiscal year 2026 → create
3. Navigate to edit page
4. Add budget line: Salaries & Wages + General Fund, $120,000, EVEN spread
5. Verify 12 months show $10,000 each
6. Add budget line: Property Insurance + AHP Fund, $6,000, ONE_TIME in month 7
7. Verify month 7 shows $6,000, others show $0
8. Navigate to budget review page
9. Verify variance calculation against test GL data (if any exists)
10. Navigate to cash projection page
11. Verify auto-fill generates 3-month columns
12. Enter an override amount, verify note is required
13. Save projection

---

## Requirements Satisfied

| Requirement | Description | How Satisfied |
|-------------|-------------|---------------|
| BDG-P0-001 | Budget structure: GL Account × Fund × Month | budget_lines table with accountId, fundId, monthlyAmounts[12] |
| BDG-P0-002 | Four spread modes (even, seasonal, one-time, custom) | spreadMethod enum + spread calculator |
| BDG-P0-003 | Full budget scope (operating + capital + financing) | Account type determines category — no separate field |
| BDG-P0-004 | Annual budget cycle (Sept-Dec milestones) | Budget cycle constants exported for compliance calendar |
| BDG-P0-005 | One active budget per FY, mid-year revision | UNIQUE constraint on fiscalYear, mid-year month lock |
| BDG-P0-007 | Variance calculation with color thresholds | variance.ts with >10% yellow, >25% red |
| BDG-P0-008 | 3-month cash projection (semi-automated) | projection.ts auto-fill + manual override |
| BDG-P0-009 | Grant budgets = fund-level budgets | Budget lines have fundId, filter by fund = grant budget |
| DM-P0-029 | CIP budget with cost code drill-down | Budget review filters to CIP accounts, actuals drill to cost code |
| RPT-P0-004 | Three comparison columns (current, YTD, budget) | Budget data queryable by month/period for report integration |
| RPT-P0-005 | Color-coded budget variance | variance-indicator component with green/yellow/red |

**Explicitly deferred to later phases:**
- BDG-P0-006 (Copy prior year budget) — P1, needed for 2027+
- Report #15 full display (Phase 16) — we build the data layer; the report page is Phase 16
- Report #24 Capital Budget Summary (Phase 16) — data layer built here
- Compliance calendar integration (Phase 17) — we export milestone data

---

## File Summary

### New files (18):
| File | Purpose |
|------|---------|
| `src/lib/db/schema/budgets.ts` | budgets table |
| `src/lib/db/schema/budget-lines.ts` | budget_lines table |
| `src/lib/db/schema/cash-projections.ts` | cash_projections table |
| `src/lib/db/schema/cash-projection-lines.ts` | cash_projection_lines table |
| `src/lib/validators/budgets.ts` | Budget Zod schemas |
| `src/lib/validators/cash-projections.ts` | Cash projection Zod schemas |
| `src/lib/budget/spread.ts` | Spread calculation logic |
| `src/lib/budget/variance.ts` | Variance calculation logic |
| `src/lib/budget/projection.ts` | Cash projection auto-fill |
| `src/lib/budget/queries.ts` | Budget CRUD + data access |
| `src/lib/budget/compliance.ts` | Budget cycle milestone constants |
| `src/lib/budget/index.ts` | Re-exports |
| `src/app/(protected)/budgets/actions.ts` | Server actions |
| `src/app/(protected)/budgets/new/page.tsx` | Create budget page |
| `src/app/(protected)/budgets/[id]/page.tsx` | Budget review (variance) |
| `src/app/(protected)/budgets/[id]/edit/page.tsx` | Budget line entry |
| `src/app/(protected)/budgets/cash-projection/page.tsx` | 3-month projection |
| `src/app/(protected)/budgets/cash-projection/actions.ts` | Projection server actions |

### New component files (5):
| File | Purpose |
|------|---------|
| `src/components/budgets/budget-line-table.tsx` | TanStack Table for budget entry |
| `src/components/budgets/spread-mode-selector.tsx` | Spread method picker |
| `src/components/budgets/variance-indicator.tsx` | Color-coded variance badge |
| `src/components/budgets/monthly-amounts-editor.tsx` | 12-month grid editor |
| `src/components/budgets/cash-projection-table.tsx` | Projection table with overrides |

### Modified files (4):
| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add 3 new enums |
| `src/lib/db/schema/index.ts` | Export new tables + relations |
| `src/lib/validators/index.ts` | Re-export new validators |
| `src/app/(protected)/budgets/page.tsx` | Replace placeholder with budget list |

### Test files (5):
| File | Purpose |
|------|---------|
| `src/lib/budget/spread.test.ts` | Spread calculation tests |
| `src/lib/budget/variance.test.ts` | Variance calculation tests |
| `src/lib/budget/projection.test.ts` | Projection auto-fill tests |
| `src/lib/validators/budgets.test.ts` | Validator tests |
| `tests/e2e/budgets.spec.ts` | Full E2E workflow test |

---

## Execution Order

The steps should be executed in this sequence:

1. **Schema + Migration** (Step 1) — foundation, everything depends on this
2. **Validators** (Step 2) — needed by business logic and server actions
3. **Spread calculator** (Step 3a) — pure logic, no DB dependency, testable immediately
4. **Spread tests** (Step 7a) — validate spread logic before building on it
5. **Budget queries** (Step 3d) — CRUD operations using schema + validators
6. **Variance calculator** (Step 3b) — needs GL query capability
7. **Variance tests** (Step 7b) — validate variance logic
8. **Server actions** (Step 4a) — wire queries to UI layer
9. **Budget UI pages** (Steps 5a-5d) — list, create, edit, review
10. **Projection logic** (Step 3c) — auto-fill depends on budget queries + GL queries
11. **Projection tests** (Step 7c) — validate projection logic
12. **Projection server actions** (Step 4b) — wire projection to UI
13. **Projection UI** (Step 5e) — cash projection page
14. **CIP budget view** (Step 5f) — cost code drill-down on actuals
15. **Compliance constants** (Step 6) — lightweight, no dependencies
16. **Validator tests** (Step 7d) — validate all Zod schemas
17. **E2E test** (Step 8) — full workflow validation

---

## Risk Notes

- **No GL data to variance against:** If building Phase 14 before Phases 5-13, variance calculations will show $0 actuals. This is correct — budget amounts display, actuals show $0, variance = -100%. The variance engine works correctly regardless.
- **Cash projection starting cash:** Without Plaid integration (Phase 12), starting cash is calculated from GL cash account balances. If no transactions exist yet, starting cash = $0. This is correct.
- **CIP cost code drill-down:** Budget lines don't have cost codes. The drill-down shows GL actuals grouped by cost code within a CIP sub-account budget line. If no CIP transactions exist yet, the drill-down shows the budget amount with $0 actuals per cost code.
- **Mid-year lock timing:** For the first budget (2026), if created mid-year, months before the creation month are locked. For a fresh system, this may mean Jan-current month are locked immediately. This is correct behavior per BDG-P0-005.
