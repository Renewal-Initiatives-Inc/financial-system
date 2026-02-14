# Phase 14: Budgeting & Cash Projection — Execution Plan

**Phase:** 14 of 22
**Depends on:** Phase 4 (Chart of Accounts & Fund Management) — **verified complete**
**Branch:** `phase-14-budgeting` (from `main`)
**Estimated scope:** Completion & hardening — core infrastructure already built in Phase 6 bundle

---

## Current State Assessment

Phase 14's infrastructure was scaffolded during the Phase 6 implementation. The following layers are **already built and functional**:

| Layer | Status | Files |
|-------|--------|-------|
| Database schema (4 tables + enums) | Done | `src/lib/db/schema/{budgets,budget-lines,cash-projections,cash-projection-lines,enums}.ts` |
| Spread calculation engine | Done + tested | `src/lib/budget/spread.ts` + `spread.test.ts` |
| Variance calculation engine | Done + tested | `src/lib/budget/variance.ts` + `variance.test.ts` |
| Cash projection engine | Done (shallow tests) | `src/lib/budget/projection.ts` + `projection.test.ts` |
| CRUD queries with audit logging | Done | `src/lib/budget/queries.ts` |
| Zod validation schemas | Done + tested | `src/lib/validators/{budgets,cash-projections}.ts` + `budgets.test.ts` |
| Server actions (budget + projection) | Done | `src/app/(protected)/budgets/actions.ts`, `cash-projection/actions.ts` |
| Budget list page | Done | `budgets-client.tsx` |
| Budget creation page | Done | `new/page.tsx` |
| Budget edit page (inline table) | Done | `[id]/edit/budget-edit-client.tsx` |
| Budget review page (variance) | Done | `[id]/budget-review-client.tsx` |
| Cash projection page | Done | `cash-projection/cash-projection-client.tsx` |
| Reusable components | Done | `src/components/budgets/{variance-indicator,spread-mode-selector,monthly-amounts-editor}.tsx` |
| Compliance milestones | Done | `src/lib/budget/compliance.ts` |

**What remains:** Gaps in CIP budget drill-down, grant budget multi-year support, help tooltips, E2E tests, and several edge cases/polish items identified below.

---

## Tasks

### Task 1: CIP Budget Drill-Down by Cost Code (DM-P0-029, BDG-P0-003)

**Why:** The implementation plan specifically requires "budget vs actual at sub-account level with drill-down to cost code level." This is critical for Report #24 and not yet built.

**Files to create/modify:**
- `src/lib/budget/cip-budget.ts` — New query functions for CIP budget vs actual at cost-code level
- `src/app/(protected)/budgets/[id]/budget-review-client.tsx` — Add CIP drill-down section below the main variance table

**Subtasks:**
1. Create `getCIPBudgetVsActual(budgetId, fundId?)` in `cip-budget.ts`:
   - Query budget lines where account is a CIP sub-account (Hard Costs, Soft Costs, Reserves, Developer Fee, Construction Interest)
   - Query GL actuals grouped by `cip_cost_code_id` on `transaction_lines` for those CIP accounts
   - Return: sub-account → cost codes → budget vs actual with variance
2. Add a collapsible "CIP Budget Detail" section to the budget review page that:
   - Shows CIP sub-account totals (budget vs actual)
   - Expands each sub-account to show cost-code-level breakdown
   - Uses existing `VarianceIndicator` component for coloring
3. Handle the case where no CIP budget lines exist (hide the section entirely)

**Tests:**
- Unit test: `cip-budget.test.ts` — CIP variance calculation with cost code grouping, empty CIP data returns empty array

---

### Task 2: Grant Budget Multi-Year Support (BDG-P0-009)

**Why:** Grant budgets span fiscal years. Currently budget lines are constrained to a single fiscal year's budget. Need to enable fund-level budget tracking across FYs.

**Files to modify:**
- `src/app/(protected)/budgets/[id]/edit/budget-edit-client.tsx` — Add visual indicator for fund-level budget totals
- `src/app/(protected)/budgets/[id]/budget-review-client.tsx` — Add cross-year grant budget context

**Subtasks:**
1. Add `getGrantBudgetSummary(fundId)` query in `src/lib/budget/queries.ts`:
   - Sum budget lines across all fiscal years for a given restricted fund
   - Return: total budgeted, total actual spent, remaining
2. When viewing a restricted fund's budget lines, show a context banner: "Grant total: $X budgeted across FY2026-FY2028 | $Y spent | $Z remaining"
3. No schema changes needed — multi-year is already supported by having budget_lines per fiscal year per fund

**Tests:**
- Unit test in `queries.test.ts`: grant budget summary across 2 fiscal years

---

### Task 3: Budget Fiscal Year from Budget Record (Bug Fix)

**Why:** The variance engine currently uses `new Date().getFullYear()` for actuals date range instead of the budget's fiscal year. This would break if reviewing a past or future year's budget.

**Files to modify:**
- `src/lib/budget/variance.ts` — `getBudgetVsActual()` should accept and use fiscal year from the budget record

**Subtasks:**
1. Add `fiscalYear` parameter to `getBudgetVsActual(budgetId, month?, fundId?)`
2. Fetch the budget record to get its `fiscalYear` (or accept as parameter)
3. Use `fiscalYear` instead of `new Date().getFullYear()` for date range calculation
4. Update `src/app/(protected)/budgets/actions.ts` `getBudgetVarianceAction` to pass fiscal year

**Tests:**
- Update `variance.test.ts`: verify date range uses budget FY, not current year

---

### Task 4: Cash Projection — Starting Cash Row & AHP Context (BDG-P0-008, Report #15)

**Why:** The implementation plan specifies "Starting cash" as the first row and "AHP available credit as context." Neither is currently displayed.

**Files to modify:**
- `src/lib/budget/projection.ts` — `getStartingCash()` already exists
- `src/app/(protected)/budgets/cash-projection/cash-projection-client.tsx` — Add starting cash row and AHP context
- `src/app/(protected)/budgets/cash-projection/actions.ts` — Add action to fetch AHP context

**Subtasks:**
1. Add a "Starting Cash" row at the top of the projection table (read-only, from `getStartingCash()`)
2. Add an "Ending Cash" row after Net Cash Flow = Starting Cash + Net Cash Flow
3. Add an AHP context card below the table: "AHP Credit Facility: $3.5M | Drawn: $X | Available: $Y" — read from loan metadata settings (or hardcoded config until settings page is built)
4. Update the `generateProjectionAction` to include starting cash in the response

**Tests:**
- Verify starting cash appears in projection output
- Verify ending cash = starting + net

---

### Task 5: Mid-Year Lock Visual Enhancement

**Why:** The mid-year lock is enforced server-side, but the UI could communicate it more clearly. When a budget is APPROVED and months have passed, locked months should be visually distinct.

**Files to modify:**
- `src/app/(protected)/budgets/[id]/edit/budget-edit-client.tsx` — Enhance locked month display

**Subtasks:**
1. When budget is APPROVED, show a notice: "Months through [current month] are locked (actuals recorded)"
2. In the `MonthlyAmountsEditor`, ensure locked months show a lock icon or strikethrough styling (currently disabled, may need icon)
3. The annual amount input should reflect only the editable portion when in mid-year edit mode — show "Remaining: $X" hint

---

### Task 6: Help Tooltips for Budget Concepts (SYS-P0-021)

**Why:** Budget-related terms are not yet in the help dictionary. Users need inline explanations.

**Files to modify:**
- `src/lib/help/terms.ts` — Add budget-specific terms
- `src/app/(protected)/budgets/[id]/edit/budget-edit-client.tsx` — Add tooltips to column headers
- `src/app/(protected)/budgets/[id]/budget-review-client.tsx` — Add tooltips to variance columns
- `src/app/(protected)/budgets/cash-projection/cash-projection-client.tsx` — Add tooltips

**New terms to add:**
```
budget — "An annual financial plan that estimates revenue and expenses by GL account and fund. One active budget per fiscal year. Supports four spread methods for distributing annual amounts across months."

spread-method — "Method for allocating an annual budget amount to individual months: Even (÷12), Seasonal (weighted), One-Time (single month), or Custom (manual entry per month)."

budget-variance — "The difference between budgeted and actual amounts. Color-coded: green (≤10% deviation), yellow/warning (10-25%), red/critical (>25%). Per RPT-P0-005."

cash-projection — "A 3-month rolling forecast of cash inflows and outflows. Auto-populated from budget data (or 3-month GL average if no budget), with manual override capability. Updated quarterly before board meetings."

mid-year-revision — "Budget edits made after the fiscal year begins. Months with recorded actuals are locked — only future months can be modified. No version history; revisions overwrite."

budget-approval — "A budget moves from Draft to Approved status. Once approved, mid-year lock rules apply (past months frozen). Approval is logged in the audit trail."
```

---

### Task 7: Copy Prior Year Budget (BDG-P0-006 — P1)

**Why:** Marked P1 in requirements ("First budget year (2026) has no prior year to copy. Feature needed for 2027+"). Build it now since the infrastructure is ready.

**Files to modify:**
- `src/lib/budget/queries.ts` — Add `copyBudgetFromPriorYear()` function
- `src/app/(protected)/budgets/new/page.tsx` — Add "Copy from prior year" option with percentage adjustment

**Subtasks:**
1. Add `copyBudgetFromPriorYear(sourceBudgetId, targetFiscalYear, adjustmentPercent, userId)`:
   - Creates new budget for target FY
   - Copies all budget lines from source
   - Applies percentage adjustment to all annual amounts
   - Recalculates monthly spreads using each line's existing spread method
   - Returns new budget ID
2. On the "New Budget" page, if a prior year budget exists:
   - Show radio: "Start blank" / "Copy from FY [year] budget"
   - If copying, show percentage adjustment slider/input (-50% to +50%, default 0%)
3. Audit log the copy operation with source reference

**Tests:**
- Unit test: copy with 0% adjustment produces identical amounts
- Unit test: copy with +10% adjustment increases all lines by 10%
- Unit test: spread methods are preserved during copy

---

### Task 8: Compliance Calendar Integration (BDG-P0-004)

**Why:** The implementation plan requires budget cycle milestones in the compliance calendar. The milestones are defined in `src/lib/budget/compliance.ts` but not yet wired to the compliance system.

**Files to modify:**
- `src/lib/budget/compliance.ts` — Already has milestone definitions
- This task prepares the data for Phase 17 (Dashboard & Compliance Calendar)

**Subtasks:**
1. Verify `BUDGET_CYCLE_MILESTONES` constant matches BDG-P0-004: Sept review → Oct draft → Nov circulation → Dec approval
2. Add `getBudgetCycleDeadlines(fiscalYear)` function that generates compliance deadline records from the milestones for a given FY
3. Export this so Phase 17's compliance calendar can import it
4. No UI work — this is a data preparation step for Phase 17

**Tests:**
- Unit test: generates 4 deadlines for a given FY with correct months and labels

---

### Task 9: Projection Engine Improvements

**Why:** The projection fallback path (no budget → 3-month average) only uses General Fund (fund=1). Multi-fund projections need to aggregate across all funds or allow fund-specific projections.

**Files to modify:**
- `src/lib/budget/projection.ts` — Fix fallback to use all funds, not just General Fund

**Subtasks:**
1. In `generateProjectionLines`, when falling back to GL averages:
   - Query all funds with recent activity, not just fund ID 1
   - Aggregate amounts by account across funds (for consolidated projection)
   - Include account+fund label in `sourceLabel` when fund matters
2. Add optional `fundId` parameter to `generateProjectionLines` for fund-specific projections
3. Handle edge case: accounts with zero activity in all 3 months should be excluded

**Tests:**
- Update `projection.test.ts` with proper DB mock tests (currently only tests exports exist)

---

### Task 10: E2E Test — Full Budget Workflow

**Why:** No E2E tests exist for budgeting. The implementation plan requires: "create budget, enter lines with different spread modes, verify variance calculation against test GL data, create cash projection."

**Files to create:**
- `e2e/budgets.spec.ts`

**Test scenarios:**
1. **Budget creation:** Navigate to /budgets → New Budget → select FY → create → redirected to edit page
2. **Add budget lines:** Add 3 lines (one EVEN, one ONE_TIME, one CUSTOM spread) → verify monthly amounts calculate correctly
3. **Edit budget line:** Change annual amount → verify spread recalculates
4. **Delete budget line:** Remove a line → verify it disappears
5. **Approve budget:** Click Approve → verify status changes to Approved
6. **Variance review:** Navigate to budget review → verify variance table shows data → change period filter → verify data updates
7. **Cash projection:** Navigate to /budgets/cash-projection → Generate → verify table renders with inflows/outflows → add an override → save → verify note required

---

### Task 11: User Identity Integration

**Why:** Multiple actions currently pass `'system'` as the userId. These should use the actual authenticated user's identity.

**Files to modify:**
- `src/app/(protected)/budgets/actions.ts` — Get user from session
- `src/app/(protected)/budgets/cash-projection/actions.ts` — Get user from session
- `src/app/(protected)/budgets/[id]/edit/budget-edit-client.tsx` — Pass userId from session
- `src/app/(protected)/budgets/new/page.tsx` — Pass userId from session

**Subtasks:**
1. Import `auth()` or `getServerSession()` from next-auth in server actions
2. Replace all hardcoded `'system'` userId references with the actual authenticated user
3. Verify audit log entries show real user names

---

## Files Summary

### New Files
| File | Purpose |
|------|---------|
| `src/lib/budget/cip-budget.ts` | CIP budget vs actual by cost code |
| `src/lib/budget/cip-budget.test.ts` | Tests for CIP budget queries |
| `e2e/budgets.spec.ts` | E2E test for full budget workflow |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/budget/variance.ts` | Use budget fiscal year for date ranges |
| `src/lib/budget/projection.ts` | Multi-fund fallback, fund filter param |
| `src/lib/budget/queries.ts` | Grant budget summary query, copy prior year |
| `src/lib/budget/compliance.ts` | Add deadline generator function |
| `src/lib/help/terms.ts` | Add 6 budget-related help terms |
| `src/app/(protected)/budgets/actions.ts` | User identity, pass fiscal year to variance |
| `src/app/(protected)/budgets/cash-projection/actions.ts` | Starting cash, AHP context, user identity |
| `src/app/(protected)/budgets/cash-projection/cash-projection-client.tsx` | Starting/ending cash rows, AHP context card, help tooltips |
| `src/app/(protected)/budgets/[id]/budget-review-client.tsx` | CIP drill-down section, grant context banner, help tooltips |
| `src/app/(protected)/budgets/[id]/edit/budget-edit-client.tsx` | Mid-year lock notice, help tooltips, user identity |
| `src/app/(protected)/budgets/new/page.tsx` | Copy prior year option, user identity |
| `src/lib/budget/projection.test.ts` | Proper unit tests (currently only export checks) |
| `src/lib/budget/variance.test.ts` | Fiscal year parameter tests |

---

## Requirements Satisfied

| ID | Requirement | Task |
|----|------------|------|
| BDG-P0-001 | Budget structure: GL Account × Fund × Month | Already built |
| BDG-P0-002 | Four spread modes (even/seasonal/one_time/custom) | Already built |
| BDG-P0-003 | Full budget scope: operating + capital + financing | Task 1 (CIP drill-down) |
| BDG-P0-004 | Budget cycle compliance calendar integration | Task 8 |
| BDG-P0-005 | One budget per FY, mid-year revision with locks | Already built + Task 5 (visual) |
| BDG-P0-006 | Copy prior year budget (P1) | Task 7 |
| BDG-P0-007 | Variance calculation with color thresholds | Already built |
| BDG-P0-008 | 3-month cash projection (semi-automated) | Already built + Task 4 (starting cash, AHP) |
| BDG-P0-009 | Grant budgets = fund-level, multi-year | Task 2 |
| DM-P0-029 | CIP budget drill-down to cost code level | Task 1 |
| RPT-P0-005 | Color-coded variance (>10% yellow, >25% red) | Already built |
| SYS-P0-021 | Inline help tooltips | Task 6 |

---

## Execution Order

Tasks are ordered by dependency and priority:

1. **Task 3** — Fix fiscal year bug (foundational correctness)
2. **Task 9** — Projection engine improvements (foundational correctness)
3. **Task 11** — User identity integration (affects all audit entries)
4. **Task 1** — CIP budget drill-down (new feature, high requirements coverage)
5. **Task 4** — Cash projection starting cash & AHP context (requirements gap)
6. **Task 2** — Grant budget multi-year context (requirements gap)
7. **Task 5** — Mid-year lock visual enhancement (polish)
8. **Task 6** — Help tooltips (polish)
9. **Task 7** — Copy prior year budget (P1 feature, nice-to-have)
10. **Task 8** — Compliance calendar integration (data prep for Phase 17)
11. **Task 10** — E2E test (validation of everything above)

---

## Acceptance Criteria

- [ ] Creating a budget, adding lines with all 4 spread modes, and approving works end-to-end
- [ ] Budget variance shows correct actual-vs-budget with proper color coding
- [ ] CIP budget lines show drill-down to cost code level
- [ ] Cash projection generates with starting cash row, 3 months of inflows/outflows, and ending cash
- [ ] AHP available credit context is visible on cash projection page
- [ ] Override amounts require notes (validation enforced)
- [ ] Mid-year revision locks past months from editing (server + visual)
- [ ] Grant fund budgets show cross-year total context
- [ ] Variance engine uses budget fiscal year, not current year
- [ ] All audit log entries show real user identity (not 'system')
- [ ] 6 budget-related help tooltips appear on budget pages
- [ ] E2E test passes: create → edit → approve → variance → projection workflow
- [ ] All existing unit tests still pass (`npm test`)
