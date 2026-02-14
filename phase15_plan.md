# Phase 15 Execution Plan — Reports (Batch 1: Core Financial Statements & Operational)

**Phase:** 15 of 21
**Goal:** Build 13 reports with shared report infrastructure, PDF/CSV export, fund drill-down, budget comparison columns, and variance color coding.
**Dependencies:** Phase 7 (Revenue) ✅, Phase 8 (Expenses) ✅, Phase 14 (Budgeting) ✅
**Source:** implementation_plan.md Section 17

---

## Dependency Verification

| Phase | Status | Evidence |
|-------|--------|----------|
| Phase 7 (Revenue) | ✅ Complete | `src/lib/revenue/` — rent accrual, grants, donations, pledges, AHP, in-kind all implemented. Commit `e2d379f`. |
| Phase 8 (Expenses) | ✅ Complete | `src/lib/expenses/` — PO system, invoice posting, payables. Ramp categorization queue operational. Commit `e2d379f`. |
| Phase 14 (Budgeting) | ✅ Complete | `src/lib/budget/` — spread engine, variance calculation, cash projection. Budget CRUD + UI. Commit `c1d6575`. |

**Additional verified foundations:**
- GL engine (`src/lib/gl/engine.ts`) — fully tested, handles all transaction types
- `form_990_line` field on accounts — present in schema (`varchar('form_990_line', { length: 10 })`)
- Variance calculation engine (`src/lib/budget/variance.ts`) — `calculateVariance()`, `getActualsForPeriod()`, `getBudgetVsActual()`
- VarianceIndicator component (`src/components/budgets/variance-indicator.tsx`) — green/yellow/red badges
- DataTable component (`src/components/shared/data-table.tsx`) — TanStack Table with sorting, pagination, filtering
- All required schema tables present (accounts, transactions, transaction_lines, funds, budgets, budget_lines, tenants, vendors, donors, grants, pledges, purchase_orders, invoices)

**Missing but not blocking:** `functional_allocations` table — needed for Report #4 (Statement of Functional Expenses). Will create schema in this phase. Full allocation wizard is Phase 17 scope; Phase 15 creates the schema + query layer so Report #4 can render with or without allocations.

---

## Step-by-Step Execution Plan

### Step 1: Report Infrastructure — Shared Components

Build the reusable building blocks that all 13 reports will use. This is the foundation; all subsequent report steps depend on it.

**Files to create:**

1. **`src/lib/reports/types.ts`** — Shared TypeScript types for all reports
   - `ReportFilters` (dateRange, fundId, periodType)
   - `ReportMeta` (title, generatedAt timestamp, filters applied)
   - `ComparisonRow` (currentPeriod, yearToDate, budget, variance)
   - `ReportExportFormat` enum (PDF, CSV)
   - Currency/number formatting utilities: `formatCurrency()`, `formatPercent()`, `formatNumber()`
   - Date range helpers: `getCurrentPeriodRange()`, `getYTDRange()`, `getFiscalYearRange()`

2. **`src/components/reports/report-shell.tsx`** — Outer layout wrapper for every report page
   - Report title as h1
   - "As of" timestamp in header (RPT-P0-001): `Generated: Feb 14, 2026 at 3:42 PM`
   - Filter bar slot (children)
   - Export buttons (PDF + CSV) positioned top-right
   - Fund filter display (shows "Consolidated" or selected fund name)
   - Print-friendly CSS media query

3. **`src/components/reports/report-filter-bar.tsx`** — Unified filter bar (design.md Section 5.7)
   - Date range picker (always first position) — uses shadcn DatePickerWithRange
   - Fund selector (always second when applicable) — reuses `src/components/shared/fund-selector.tsx`
   - Period selector (Monthly/Quarterly/YTD/Annual) — shadcn Select
   - "Apply" button triggers report data refetch
   - URL search param sync (filters preserved in URL for bookmarking/sharing)
   - `data-testid="report-filter-bar"`

4. **`src/components/reports/report-table.tsx`** — Financial statement table component
   - Built on TanStack Table but adds financial report features:
     - Number formatting (currency with parentheses for negatives, accounting-style)
     - Bold subtotal/total rows with top-border separator
     - Indented child rows (for account hierarchy and sub-categories)
     - Variance color coding (reuses `calculateVariance()` from budget/variance.ts)
     - Row click → drill-down navigation (to transaction list filtered by account+fund+period)
   - Section header rows (e.g., "ASSETS", "Current Assets", "REVENUE")
   - Supports variable column count for comparison views

5. **`src/components/reports/comparison-columns.tsx`** — Three-column comparison renderer
   - Current Period | Year-to-Date | Budget columns (RPT-P0-004)
   - Budget column shows "—" when no budget exists
   - Variance sub-column with color badge (reuses VarianceIndicator)
   - Responsive: stacks on mobile, full columns on desktop

6. **`src/components/reports/export-buttons.tsx`** — PDF and CSV export triggers
   - PDF button: triggers server action → `@react-pdf/renderer` generation → download
   - CSV button: client-side CSV generation → download
   - Loading states while PDF generates
   - `data-testid="export-pdf-btn"`, `data-testid="export-csv-btn"`

7. **`src/lib/reports/export-csv.ts`** — Generic CSV export utility
   - Takes column definitions + row data → CSV string
   - Handles currency formatting, date formatting
   - UTF-8 BOM for Excel compatibility
   - Triggers browser download

8. **`src/lib/reports/export-pdf.tsx`** — Generic PDF report template
   - `@react-pdf/renderer` document component
   - RI letterhead (org name, address)
   - Report title, date range, fund filter, "as of" timestamp
   - Reusable table renderer for financial data
   - Page numbers, page breaks between sections
   - API route: `src/app/api/reports/pdf/route.ts` — server-side PDF generation

**Files to modify:**
- `src/lib/utils.ts` — Add `formatCurrency()`, `formatPercent()`, `formatDate()` shared utility functions

**Tests:**
- `src/lib/reports/__tests__/types.test.ts` — date range helpers, formatting utilities
- `src/lib/reports/__tests__/export-csv.test.ts` — CSV generation, special characters, currency formatting

**Acceptance criteria:**
- RPT-P0-001: "As of" datetime timestamp on every report header
- RPT-P0-002: PDF export and CSV export available on all reports
- RPT-P0-003: Fund drill-down via fund selector filter
- RPT-P0-004: Three comparison columns (Current Period, YTD, Budget)
- RPT-P0-005: Color-coded budget variance (green/yellow/red)

---

### Step 2: Report Index Page

Replace the placeholder reports page with a navigable report index.

**Files to create/modify:**

1. **`src/app/(protected)/reports/page.tsx`** — Report index (replace existing stub)
   - Card grid: one card per report with title, short description, link
   - Grouped by category: Core Financial Statements, Operational Dashboards, Fund & Grant Reports, Specialized Reports
   - Only shows Phase 15 reports (13); Phase 16 reports (16) show as "Coming Soon" disabled cards

2. **`src/app/(protected)/reports/layout.tsx`** — Reports layout with breadcrumb support
   - Consistent heading area
   - Back-to-index navigation

---

### Step 3: Report #1 — Statement of Financial Position (Balance Sheet)

**Report spec:** Assets / Liabilities / Net Assets. Net assets split by restriction. Current vs noncurrent grouping. AHP loan note. Fund drill-down.

**Files to create:**

1. **`src/lib/reports/balance-sheet.ts`** — Query function
   - Aggregate GL balances by account, grouped by type (ASSET/LIABILITY/NET_ASSET) and sub_type
   - Group assets into: Current Assets (Cash, AR, Prepaid) and Noncurrent Assets (Fixed Assets, CIP, net of Accum Depr)
   - Group liabilities into: Current (AP, payables, accrued) and Long-Term (AHP Loan, Deferred Dev Fee)
   - Net Assets: split Without Donor Restrictions vs With Donor Restrictions
   - AHP loan note: query `ahp_loan_config` for credit_limit, calculate drawn from GL balance of AHP Loan Payable
   - Fund filter: optional `fundId` — when null, consolidated; when set, filter all GL lines by fund
   - Comparison columns: current period balance, YTD (same for balance sheet — point-in-time), budget
   - Returns typed `BalanceSheetData` with sections, totals, AHP note

2. **`src/app/(protected)/reports/balance-sheet/page.tsx`** — Server component, loads data
3. **`src/app/(protected)/reports/balance-sheet/balance-sheet-client.tsx`** — Client component with filters and table
   - Uses ReportShell, ReportFilterBar, ReportTable
   - Section headers: "ASSETS", "Current Assets", "Noncurrent Assets", "LIABILITIES", etc.
   - Bold total rows: "Total Current Assets", "Total Assets", "Total Liabilities & Net Assets"
   - AHP note rendered below the table
   - Fund drill-down via filter

**Tests:**
- `src/lib/reports/__tests__/balance-sheet.test.ts`
  - Correct grouping by account type and sub_type
  - Assets = Liabilities + Net Assets (accounting equation holds)
  - CIP and Accum Depr net correctly
  - Fund filter isolates balances
  - AHP note calculates drawn/available correctly

**Requirements satisfied:** Report #1 per Section 5.3, RPT-P0-003 (fund drill-down), RPT-P0-004 (comparison columns)

---

### Step 4: Report #2 — Statement of Activities (P&L)

**Report spec:** Revenue by type, expenses by nature, net asset releases, changes in net assets by restriction class.

**Files to create:**

1. **`src/lib/reports/activities.ts`** — Query function
   - Revenue section: group by account sub_type (Operating, Restricted, Contribution)
   - Show core rental income + adjustment accounts separately (D-027)
   - Expense section: group by account sub_type (Payroll, Property Ops, Financial, Non-Cash, Operating)
   - Net asset releases: sum of system-generated release entries (source_type=SYSTEM with release memo pattern)
   - Changes in net assets: Revenue - Expenses + Releases, split by restriction class
   - Beginning net assets + change = ending net assets
   - Comparison columns: Current Period, YTD, Budget (with variance)
   - Fund filter support

2. **`src/app/(protected)/reports/activities/page.tsx`** — Server component
3. **`src/app/(protected)/reports/activities/activities-client.tsx`** — Client component
   - Revenue section with subtotals by type
   - Expense section with subtotals by nature
   - Net asset release line
   - Change in net assets summary
   - Variance indicators on budget column

**Tests:**
- `src/lib/reports/__tests__/activities.test.ts`
  - Revenue grouped correctly by type
  - Rent adjustments shown separately from core rental income
  - Net asset releases calculated correctly
  - Revenue - Expenses = Change in net assets
  - Budget variance calculated per line

**Requirements satisfied:** Report #2, D-027 (rent vs adjustments), D-029 (net asset releases visible)

---

### Step 5: Report #3 — Statement of Cash Flows

**Report spec:** Indirect method. Operating/Investing/Financing sections.

**Files to create:**

1. **`src/lib/reports/cash-flows.ts`** — Query function (indirect method)
   - **Operating:** Start with change in net assets. Add back non-cash items (depreciation, in-kind). Adjust for changes in operating assets/liabilities (AR, prepaid, AP, accrued liabilities, deferred revenue)
   - **Investing:** CIP additions, fixed asset purchases, reserve fund transfers
   - **Financing:** AHP draws, AHP payments, AHP interest payments
   - Net change in cash = Operating + Investing + Financing
   - Beginning cash + net change = ending cash (reconciles to balance sheet cash)
   - Period-based: compares two balance dates to derive changes

2. **`src/app/(protected)/reports/cash-flows/page.tsx`** — Server component
3. **`src/app/(protected)/reports/cash-flows/cash-flows-client.tsx`** — Client component
   - Three clearly labeled sections with subtotals
   - Reconciliation line at bottom

**Tests:**
- `src/lib/reports/__tests__/cash-flows.test.ts`
  - Indirect method adds back depreciation correctly
  - Working capital changes calculated (ending - beginning balances)
  - Beginning + net change = ending cash
  - CIP spending shows in investing section

**Requirements satisfied:** Report #3

---

### Step 6: Report #4 — Statement of Functional Expenses

**Report spec:** Matrix: expense rows × function columns (Program/Admin/Fundraising). GAAP/990 format toggle.

**Pre-requisite task:** Create `functional_allocations` schema. The allocation wizard is Phase 17, but the table + query layer must exist now for Report #4 to render.

**Files to create:**

1. **`src/lib/db/schema/functional-allocations.ts`** — New schema table
   - `id`, `fiscal_year`, `account_id` (FK), `program_pct` (numeric), `admin_pct` (numeric), `fundraising_pct` (numeric), `is_permanent_rule` (boolean), `created_by`, `created_at`, `updated_at`
   - Constraint: `program_pct + admin_pct + fundraising_pct = 100`

2. **Drizzle migration** for `functional_allocations` table

3. **`src/lib/reports/functional-expenses.ts`** — Query function
   - Two modes: GAAP format (accounts grouped by nature) and 990 format (accounts grouped by `form_990_line`)
   - For each expense account: look up allocation in `functional_allocations` for the fiscal year
   - If no allocation exists: show full amount in "Unallocated" column (don't guess)
   - Matrix: rows = expense accounts/990 lines, columns = Total | Program | M&G | Fundraising
   - Column totals at bottom
   - Fund filter support

4. **`src/app/(protected)/reports/functional-expenses/page.tsx`** — Server component
5. **`src/app/(protected)/reports/functional-expenses/functional-expenses-client.tsx`** — Client component
   - Toggle button: GAAP Format / 990 Format (TXN-P0-048)
   - GAAP: grouped by account sub_type (Payroll, Property Ops, etc.)
   - 990: grouped by IRS Part IX line numbers (Line 5 Compensation, Line 15 Interest, Line 22 Depreciation, etc.)
   - "Unallocated" column shown when allocations incomplete (guides user to Phase 17 wizard)

**Tests:**
- `src/lib/reports/__tests__/functional-expenses.test.ts`
  - Allocation percentages applied correctly
  - Program + M&G + Fundraising = Total per row
  - 990 format groups by form_990_line
  - GAAP format groups by sub_type
  - Missing allocations → "Unallocated" column

**Requirements satisfied:** Report #4, TXN-P0-048 (GAAP/990 toggle), D-061 (functional allocation in reports), D-062 (990 line mapping), D-116 (990 format toggle)

---

### Step 7: Report #5 — Cash Position Summary

**Report spec:** Bank balances, outstanding payables, outstanding receivables, net available cash, AHP drawn vs available.

**Files to create:**

1. **`src/lib/reports/cash-position.ts`** — Query function
   - Cash accounts: sum GL balances for all Cash/Cash Equivalent accounts (Checking, Savings, Security Deposit Escrow, Restricted Cash accounts)
   - Outstanding payables: sum of AP, Reimbursements Payable, Credit Card Payable, Accrued Payroll Payable balances
   - Outstanding receivables: sum of AR, Grants Receivable, Pledges Receivable balances
   - Net available cash = Cash - Payables + near-term Receivables
   - AHP section: credit_limit, drawn (GL balance), available (limit - drawn)
   - Returns `CashPositionData` with sections

2. **`src/app/(protected)/reports/cash-position/page.tsx`**
3. **`src/app/(protected)/reports/cash-position/cash-position-client.tsx`**
   - Card layout: Cash section, Payables section, Receivables section, Net Available, AHP section
   - Color coding: net available green/yellow/red based on coverage ratio

**Tests:**
- `src/lib/reports/__tests__/cash-position.test.ts`
  - Cash = sum of cash-type accounts
  - Net available = Cash - Payables + Receivables
  - AHP available = limit - drawn

**Requirements satisfied:** Report #5, D-113 (dashboard cash section data source)

---

### Step 8: Report #6 — AR Aging

**Report spec:** By tenant + grants + pledges. Buckets: current, 30, 60, 90+ days. VASH distinction.

**Files to create:**

1. **`src/lib/reports/ar-aging.ts`** — Query function
   - **Tenant AR:** Outstanding rent invoices (DR AR entries without matching CR). Age from due date. Include tenant name, unit, funding_source_type (flag VASH for known delay pattern)
   - **Grant AR:** Grants Receivable balance by grant. Age from award/expected date
   - **Pledge AR:** Pledges Receivable by donor. Age from expected date
   - Buckets: Current (0-30), 31-60, 61-90, 90+
   - Totals per category and grand total

2. **`src/app/(protected)/reports/ar-aging/page.tsx`**
3. **`src/app/(protected)/reports/ar-aging/ar-aging-client.tsx`**
   - Three sections: Tenant AR, Grant AR, Pledge AR
   - Aging bucket columns with subtotals
   - VASH badge on tenant rows with VASH funding source (not delinquent — expected delay)
   - Grand total row

**Tests:**
- `src/lib/reports/__tests__/ar-aging.test.ts`
  - Correct aging bucket assignment
  - VASH tenants flagged correctly
  - Totals sum across buckets

**Requirements satisfied:** Report #6, D-026 (tenant AR), D-030 (grants receivable), D-050 (pledges)

---

### Step 9: Report #7 — Outstanding Payables

**Report spec:** Reimbursements Payable, Credit Card Payable, Accounts Payable, vendor invoices pending.

**Files to create:**

1. **`src/lib/reports/outstanding-payables.ts`** — Query function
   - Group by payable type (Reimb, CC, AP, Accrued)
   - Within AP: group by vendor, show individual invoices with PO reference
   - Invoice-level detail: invoice number, date, amount, PO number, payment status
   - Aging buckets: Current, 30, 60, 90+
   - Total by type and grand total

2. **`src/app/(protected)/reports/outstanding-payables/page.tsx`**
3. **`src/app/(protected)/reports/outstanding-payables/payables-client.tsx`**

**Tests:**
- `src/lib/reports/__tests__/outstanding-payables.test.ts`

**Requirements satisfied:** Report #7, D-040 (payment tracking)

---

### Step 10: Report #8 — Rent Collection Status

**Report spec:** Billed vs collected by unit this month. Occupancy tracking. Vacancy loss. Collection rate.

**Files to create:**

1. **`src/lib/reports/rent-collection.ts`** — Query function
   - Per unit/tenant: monthly rent amount, amount billed (accrued AR), amount collected (payments received), outstanding
   - Occupancy rate: occupied units / total units
   - Vacancy loss: sum of unoccupied unit potential rent
   - Collection rate: collected / billed as percentage
   - Month selector (default: current month)

2. **`src/app/(protected)/reports/rent-collection/page.tsx`**
3. **`src/app/(protected)/reports/rent-collection/rent-collection-client.tsx`**
   - Per-unit rows with billed/collected/outstanding columns
   - Summary row: total billed, total collected, collection %
   - Vacancy section
   - Progress bars for collection rate

**Tests:**
- `src/lib/reports/__tests__/rent-collection.test.ts`

**Requirements satisfied:** Report #8, D-026 (AR by tenant), D-027 (adjustments separate)

---

### Step 11: Report #9 — Fund Draw-Down / Restricted Grant Status

**Report spec:** Per fund: awarded, spent, remaining restricted. Conditional grant progress.

**Files to create:**

1. **`src/lib/reports/fund-drawdown.ts`** — Query function
   - For each restricted fund: total awarded (revenue to fund), total spent (expenses from fund), remaining balance
   - Include net asset release impact
   - Conditional grants: progress toward conditions (milestones achieved from PO data)
   - Progress percentage: spent / awarded

2. **`src/app/(protected)/reports/fund-drawdown/page.tsx`**
3. **`src/app/(protected)/reports/fund-drawdown/fund-drawdown-client.tsx`**
   - Per-fund rows with awarded/spent/remaining columns
   - Progress bars for draw-down percentage
   - Conditional grant section with milestone checklist

**Tests:**
- `src/lib/reports/__tests__/fund-drawdown.test.ts`

**Requirements satisfied:** Report #9, D-029 (restricted fund tracking), D-046 (conditional grant progress)

---

### Step 12: Report #10 — Grant Compliance Tracking

**Report spec:** Conditional grant progress. Matching requirements. Milestones.

**Files to create:**

1. **`src/lib/reports/grant-compliance.ts`** — Query function
   - Per grant: award amount, conditions text, milestones from linked POs
   - Matching requirement status: how much matched spending achieved
   - Financial progress: draw-down amount vs award
   - Timeline: start/end dates, remaining time

2. **`src/app/(protected)/reports/grant-compliance/page.tsx`**
3. **`src/app/(protected)/reports/grant-compliance/grant-compliance-client.tsx`**

**Tests:**
- `src/lib/reports/__tests__/grant-compliance.test.ts`

**Requirements satisfied:** Report #10, D-046

---

### Step 13: Report #11 — Fund-Level P&L and Balance Sheet

**Report spec:** Same as Reports 1-2 filtered to single fund. Drill-down from consolidated.

**Files to create:**

1. **`src/lib/reports/fund-level.ts`** — Thin wrapper that calls balance-sheet.ts and activities.ts with a required `fundId` parameter
   - Validates fund exists
   - Returns combined balance sheet + P&L for the fund

2. **`src/app/(protected)/reports/fund-level/page.tsx`**
3. **`src/app/(protected)/reports/fund-level/fund-level-client.tsx`**
   - Fund selector (required, not optional like other reports)
   - Tabs: Balance Sheet | Activities
   - Reuses the same table components as Reports 1-2

**Tests:**
- `src/lib/reports/__tests__/fund-level.test.ts` — Fund filter isolates correctly; fund-level balances match consolidated drill-down

**Requirements satisfied:** Report #11, D-055 (fund drill-down)

---

### Step 14: Report #12 — Property Operating Expense Breakdown

**Report spec:** D-031's 13 categories. Budget vs actual per category.

**Files to create:**

1. **`src/lib/reports/property-expenses.ts`** — Query function
   - 13 property expense categories from D-031: Property Taxes, Property Insurance, Management Fees, Commissions, Landscaping, Repairs & Maintenance, Electric, Gas, Water/Sewer, Internet, Security & Fire Monitoring, Trash, Other Operating
   - Match accounts by sub_type = "Property Ops" or by specific account names
   - Budget comparison per category from budget_lines
   - Variance calculation per line

2. **`src/app/(protected)/reports/property-expenses/page.tsx`**
3. **`src/app/(protected)/reports/property-expenses/property-expenses-client.tsx`**
   - Category rows with actual/budget/variance columns
   - Subtotal and total rows
   - Variance color coding

**Tests:**
- `src/lib/reports/__tests__/property-expenses.test.ts`

**Requirements satisfied:** Report #12, D-031

---

### Step 15: Report #13 — Utility Trend Analysis

**Report spec:** Electric, gas, water trends over time. Line chart. Solar ROI.

**Files to create:**

1. **`src/lib/reports/utility-trends.ts`** — Query function
   - Monthly totals for each utility account (Electric, Gas, Water/Sewer, Internet, Security, Trash)
   - 12-month rolling window
   - Year-over-year comparison (when 2+ years of data)
   - Total utilities per month

2. **`src/app/(protected)/reports/utility-trends/page.tsx`**
3. **`src/app/(protected)/reports/utility-trends/utility-trends-client.tsx`**
   - **Line chart** (shadcn/ui Charts / Recharts): one line per utility type, x-axis = months
   - Data table below chart with monthly values
   - Toggle: individual utilities vs combined total
   - Solar ROI section (placeholder until solar data available)

**Tests:**
- `src/lib/reports/__tests__/utility-trends.test.ts`

**Requirements satisfied:** Report #13

---

### Step 16: PDF Export Templates

Build the `@react-pdf/renderer` PDF document for each of the 13 reports.

**Files to create:**

1. **`src/lib/reports/pdf/report-document.tsx`** — Base PDF document component
   - RI letterhead (organization name, address)
   - Report title, date range, fund filter
   - "As of" timestamp
   - Page numbers
   - Reusable table component for financial data rows

2. **`src/lib/reports/pdf/balance-sheet-pdf.tsx`** — Balance sheet PDF layout
3. **`src/lib/reports/pdf/activities-pdf.tsx`** — P&L PDF layout
4. **`src/lib/reports/pdf/cash-flows-pdf.tsx`** — Cash flows PDF layout
5. **`src/lib/reports/pdf/functional-expenses-pdf.tsx`** — Functional expenses PDF layout
6. **`src/lib/reports/pdf/cash-position-pdf.tsx`**
7. **`src/lib/reports/pdf/ar-aging-pdf.tsx`**
8. **`src/lib/reports/pdf/outstanding-payables-pdf.tsx`**
9. **`src/lib/reports/pdf/rent-collection-pdf.tsx`**
10. **`src/lib/reports/pdf/fund-drawdown-pdf.tsx`**
11. **`src/lib/reports/pdf/grant-compliance-pdf.tsx`**
12. **`src/lib/reports/pdf/fund-level-pdf.tsx`**
13. **`src/lib/reports/pdf/property-expenses-pdf.tsx`**
14. **`src/lib/reports/pdf/utility-trends-pdf.tsx`** — Table-only (no chart in PDF)

15. **`src/app/api/reports/pdf/route.ts`** — API route for server-side PDF generation
    - Accepts: report type, filters (date range, fund, period)
    - Runs query function, pipes data to PDF component
    - Returns PDF as download response
    - Used by ExportButtons component

**Tests:**
- `src/lib/reports/pdf/__tests__/report-document.test.ts` — Base template renders without error

---

### Step 17: CSV Export Utility

**Files to create:**

1. **`src/lib/reports/csv/export-csv.ts`** — Generic CSV export
   - `generateCSV(columns: string[], rows: Record<string, unknown>[])` → string
   - Currency formatting, date formatting, UTF-8 BOM
   - Handles special characters (commas, quotes, newlines in cell values)

2. **`src/lib/reports/csv/report-csv-configs.ts`** — Per-report column definitions for CSV
   - Maps each report's data shape to flat CSV columns

**Tests:**
- `src/lib/reports/csv/__tests__/export-csv.test.ts` — special characters, formatting, BOM

---

### Step 18: Schema Migration

**Files to create:**
1. **Drizzle migration** — `functional_allocations` table
2. **`src/lib/db/schema/functional-allocations.ts`** — Schema definition
3. **Update `src/lib/db/schema/index.ts`** — Export new table

---

### Step 19: Unit Tests for All Report Queries

One test file per report query function (listed in steps 3-15). Each test validates:
- Correct account grouping and aggregation
- Fund filter isolation
- Balance/total calculations
- Variance computation
- Edge cases (no data, single entry, voided transactions excluded)

**Test files (13 total):**
- `src/lib/reports/__tests__/balance-sheet.test.ts`
- `src/lib/reports/__tests__/activities.test.ts`
- `src/lib/reports/__tests__/cash-flows.test.ts`
- `src/lib/reports/__tests__/functional-expenses.test.ts`
- `src/lib/reports/__tests__/cash-position.test.ts`
- `src/lib/reports/__tests__/ar-aging.test.ts`
- `src/lib/reports/__tests__/outstanding-payables.test.ts`
- `src/lib/reports/__tests__/rent-collection.test.ts`
- `src/lib/reports/__tests__/fund-drawdown.test.ts`
- `src/lib/reports/__tests__/grant-compliance.test.ts`
- `src/lib/reports/__tests__/fund-level.test.ts`
- `src/lib/reports/__tests__/property-expenses.test.ts`
- `src/lib/reports/__tests__/utility-trends.test.ts`

---

### Step 20: E2E Test

**File to create:**
- `e2e/reports.spec.ts`
  - Navigate to reports index, verify 13 report cards visible
  - Open Report #1 (Balance Sheet), verify sections render (Assets, Liabilities, Net Assets)
  - Apply fund filter, verify data updates
  - Test PDF export button triggers download
  - Test CSV export button triggers download
  - Verify "As of" timestamp appears

---

## File Summary

### New Files (~55 files)

**Library layer (`src/lib/reports/`):**
- `types.ts` — shared types and formatting utilities
- `balance-sheet.ts`, `activities.ts`, `cash-flows.ts`, `functional-expenses.ts`
- `cash-position.ts`, `ar-aging.ts`, `outstanding-payables.ts`, `rent-collection.ts`
- `fund-drawdown.ts`, `grant-compliance.ts`, `fund-level.ts`, `property-expenses.ts`, `utility-trends.ts`
- `pdf/report-document.tsx` + 13 report-specific PDF components
- `pdf/__tests__/report-document.test.ts`
- `csv/export-csv.ts`, `csv/report-csv-configs.ts`
- `csv/__tests__/export-csv.test.ts`
- `__tests__/types.test.ts` + 13 report query test files

**Component layer (`src/components/reports/`):**
- `report-shell.tsx`, `report-filter-bar.tsx`, `report-table.tsx`
- `comparison-columns.tsx`, `export-buttons.tsx`

**Page layer (`src/app/(protected)/reports/`):**
- `page.tsx` (replace), `layout.tsx`
- 13 report subdirectories, each with `page.tsx` + client component

**Schema:**
- `src/lib/db/schema/functional-allocations.ts`
- Drizzle migration

**API:**
- `src/app/api/reports/pdf/route.ts`

**E2E:**
- `e2e/reports.spec.ts`

### Modified Files (~3 files)
- `src/lib/utils.ts` — add formatting functions
- `src/lib/db/schema/index.ts` — export `functionalAllocations`
- `src/app/(protected)/reports/page.tsx` — replace stub

---

## Execution Order & Parallelization

```
Step 1  (Infrastructure)     ─── MUST BE FIRST ───────────────────────
Step 2  (Index page)         ─── Can parallel with Step 1 ───────────
Step 18 (Schema migration)   ─── Can parallel with Step 1 ───────────
                                       │
Step 3  (Balance Sheet #1)   ──────────┤
Step 4  (Activities #2)      ──────────┤  These 13 can be built
Step 5  (Cash Flows #3)      ──────────┤  sequentially or in small
Step 6  (Func Expenses #4)   ──────────┤  batches after Step 1
Step 7  (Cash Position #5)   ──────────┤
Step 8  (AR Aging #6)        ──────────┤
Step 9  (Payables #7)        ──────────┤
Step 10 (Rent Collection #8) ──────────┤
Step 11 (Fund Draw-Down #9)  ──────────┤
Step 12 (Grant Compliance #10)─────────┤
Step 13 (Fund-Level #11)     ──────────┤  (depends on #1 + #2 queries)
Step 14 (Property Expenses #12)────────┤
Step 15 (Utility Trends #13) ──────────┘
                                       │
Step 16 (PDF templates)      ─── After report queries done ──────────
Step 17 (CSV export)         ─── Can parallel with Step 16 ──────────
Step 19 (Unit tests)         ─── Built alongside each report step ───
Step 20 (E2E test)           ─── LAST ───────────────────────────────
```

**Recommended batching for `/execute-phase`:**
1. **Batch A:** Steps 1, 2, 17, 18 (infrastructure + schema + CSV utility + index)
2. **Batch B:** Steps 3-6 (core financial statements: Balance Sheet, P&L, Cash Flows, Functional Expenses)
3. **Batch C:** Steps 7-10 (operational dashboards: Cash Position, AR Aging, Payables, Rent Collection)
4. **Batch D:** Steps 11-15 (fund & specialized: Fund Draw-Down, Grant Compliance, Fund-Level, Property Expenses, Utility Trends)
5. **Batch E:** Steps 16, 19, 20 (PDF export + remaining tests + E2E)

---

## Requirements Satisfied by Phase 15

| Requirement | Description | Report(s) |
|-------------|-------------|-----------|
| RPT-P0-001 | "As of" timestamp on every report | All 13 |
| RPT-P0-002 | PDF + CSV export on all reports | All 13 |
| RPT-P0-003 | Fund drill-down | All fund-aware reports |
| RPT-P0-004 | Three comparison columns | Financial statements |
| RPT-P0-005 | Color-coded variance | Budget comparison reports |
| RPT-P0-006 | All users see same data | No role filtering |
| RPT-P0-008 | Full GAAP format | Reports #1-4 |
| TXN-P0-048 | GAAP/990 format toggle | Report #4 |
| D-027 | Rent vs adjustments separate | Report #2 |
| D-029 | Net asset releases visible | Reports #2, #9 |
| D-031 | 13 property expense categories | Report #12 |
| D-046 | Conditional grant progress | Reports #9, #10 |
| D-055 | Consolidated + fund drill-down | Report #11 |
| D-061 | Functional allocation in reports | Report #4 |
| D-062 | 990 line mapping | Report #4 |
| D-116 | 990 format toggle | Report #4 |

---

## Risk Notes

1. **Functional allocations table** — Created in this phase but the wizard to populate it is Phase 17. Report #4 will show an "Allocations not yet configured" message until the wizard is run. This is by design — the report renders correctly with or without allocations.

2. **Cash flows (indirect method)** — Most complex query. Requires computing balance changes between two dates for all working capital accounts. Worth extra test coverage.

3. **PDF generation performance** — `@react-pdf/renderer` runs on server. Large reports may be slow. Consider streaming or background generation if needed. For Phase 15 with small data volumes this is not a concern.

4. **No Plaid bank balance** — Report #5 (Cash Position) shows GL cash balances, not live Plaid balances. Live Plaid balances are a Phase 12 (Bank Rec) feature. GL balances are the authoritative view for financial statements.
