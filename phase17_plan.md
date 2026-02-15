# Phase 17: Dashboard, Compliance Calendar & Tax Forms — Execution Plan

**Goal:** Build the dashboard home screen, functional allocation wizard, W-2/1099-NEC form generation, filing progression awareness, board pack assembly, and quarterly tax export.

**Dependencies:** Phase 15 (Reports Batch 1) ✅, Phase 16 (Reports Batch 2) ✅
**All 29 report query functions exist.** Compliance deadline system (generator + reminder sender) already implemented. Functional allocations table with DB constraint ready. PDF generation infrastructure (react-pdf + API route) operational for 14 reports.

---

## Task 1: Dashboard Home Screen

Build the 5-section dashboard per design.md Section 5.2 and requirements D-113.

### 1A: Dashboard Data Layer (`src/lib/dashboard/`)

**Create `src/lib/dashboard/queries.ts`** — lightweight query wrappers for each dashboard section. Each calls the existing report query function but returns a summary subset:

| Section | Source Report | Data Summary |
|---------|-------------|--------------|
| Cash Snapshot | `getCashPositionData()` (Report #5) | Bank balances, net available cash, AHP drawn vs available |
| Alerts/Attention | Multiple queries | Overdue rent count, upcoming deadlines (30d), unmatched bank txns, sync failures |
| Rent Collection | `getRentCollectionData()` (Report #8) | This month billed vs collected by unit, collection rate |
| Fund Balances | `getFundDrawdownData()` (Report #9) | Restricted vs unrestricted net assets, per-fund breakdown |
| Recent Activity | `getTransactionHistoryData()` (Report #18) | Last 10 transactions posted |

**Alert aggregation queries:**
- Overdue rent: Query `rent_collection` for units with `outstanding > 0`
- Compliance deadlines: Query `compliance_deadlines` for `status = 'upcoming'` AND `due_date <= NOW() + 30 days`
- Unmatched bank txns: Count `bank_transactions` with no match
- Sync failures: Check last sync timestamp from `bank_accounts` and `ramp_transactions`

### 1B: Dashboard UI (`src/app/(protected)/(dashboard)/`)

**Modify `dashboard-client.tsx`** — Replace stub with 5-section grid layout using shadcn/ui Card components:

```
┌──────────────────────┬──────────────────────┐
│ 1. Cash Snapshot     │ 2. Alerts/Attention  │
│ (bank balances,      │ (overdue rent,       │
│  net cash, AHP)      │  deadlines, unmatched│
├──────────────────────┼──────────────────────┤
│ 3. Rent Collection   │ 4. Fund Balances     │
│ (billed vs collected)│ (restricted/unrestr) │
├──────────────────────┴──────────────────────┤
│ 5. Recent Activity (last 10 transactions)   │
└─────────────────────────────────────────────┘
```

**Modify `page.tsx`** — Convert to async server component that fetches all 5 sections' data server-side and passes to client.

**Create section components:**
- `src/app/(protected)/(dashboard)/sections/cash-snapshot.tsx`
- `src/app/(protected)/(dashboard)/sections/alerts-attention.tsx`
- `src/app/(protected)/(dashboard)/sections/rent-collection.tsx`
- `src/app/(protected)/(dashboard)/sections/fund-balances.tsx`
- `src/app/(protected)/(dashboard)/sections/recent-activity.tsx`

Each section:
- Shows summary data in a Card
- Links to the full report (e.g., "View Full Report →" linking to `/reports/cash-position`)
- Uses SWR for client-side refresh with `revalidateOnFocus: true`

**Files to create:**
- `src/lib/dashboard/queries.ts`
- `src/app/(protected)/(dashboard)/sections/cash-snapshot.tsx`
- `src/app/(protected)/(dashboard)/sections/alerts-attention.tsx`
- `src/app/(protected)/(dashboard)/sections/rent-collection.tsx`
- `src/app/(protected)/(dashboard)/sections/fund-balances.tsx`
- `src/app/(protected)/(dashboard)/sections/recent-activity.tsx`

**Files to modify:**
- `src/app/(protected)/(dashboard)/page.tsx`
- `src/app/(protected)/(dashboard)/dashboard-client.tsx`

**Acceptance criteria:**
- Dashboard loads with all 5 sections populated from real queries
- Each section links to its full report
- SWR auto-refreshes on tab focus
- Alert section shows counts with appropriate urgency indicators

---

## Task 2: Functional Allocation Wizard

Build the year-end allocation wizard per TXN-P0-046, TXN-P0-047.

### 2A: Functional Allocation Defaults (`src/lib/compliance/functional-defaults.ts`)

**Create `src/lib/compliance/functional-defaults.ts`** — Three-tier default resolution:

1. **Permanent rules** (highest priority): Query `functional_allocations` WHERE `is_permanent_rule = true` for the account
2. **Prior-year percentages** (year 2+): Query `functional_allocations` WHERE `fiscal_year = targetYear - 1` for the account
3. **Sub-type defaults** (year 1 or new accounts): Static mapping from account `sub_type`:
   - `Property Ops` → 100/0/0 (permanent)
   - `Non-Cash` → 100/0/0 (permanent)
   - `Financial` → 100/0/0 (permanent)
   - `Payroll` → 70/25/5
   - `Operating` → 80/20/0

**Create `src/lib/compliance/functional-allocation-logic.ts`** — Business logic:
- `getDefaultAllocations(fiscalYear)` — resolves defaults for all active expense accounts
- `saveAllocations(fiscalYear, allocations[], userId)` — bulk upsert into `functional_allocations`
- `getAllocationsForYear(fiscalYear)` — fetch existing allocations
- `computeBenchmarkComparison(allocations[])` — compare RI totals against peer orgs

### 2B: Wizard UI (`src/app/(protected)/compliance/functional-allocation/`)

**Create wizard page** at `/compliance/functional-allocation`:
- Step-through UI: one account at a time with progress indicator (e.g., "Account 3 of 18")
- Each step shows: account name, sub-type, current default percentages (editable), "Mark as permanent" checkbox
- Three input fields per account: Program %, M&G %, Fundraising % — must sum to 100%
- Client-side validation: warn if sum ≠ 100%, block save
- Skip accounts with permanent rules (show as pre-filled, read-only)
- "Apply Defaults to All Remaining" bulk action
- Final summary page with benchmark comparison panel:
  - RI's total Program / M&G / Fundraising percentages
  - Comparable org benchmarks (Falcon Housing, Pioneer Valley Habitat, Valley CDC)
  - Industry minimum (65% program) flagged if below
  - Outlier flag if >90% program

**Files to create:**
- `src/lib/compliance/functional-defaults.ts`
- `src/lib/compliance/functional-allocation-logic.ts`
- `src/app/(protected)/compliance/functional-allocation/page.tsx`
- `src/app/(protected)/compliance/functional-allocation/wizard-client.tsx`
- `src/app/(protected)/compliance/functional-allocation/actions.ts`

**Acceptance criteria:**
- Wizard walks through all active expense accounts
- Three-tier default resolution works (permanent > prior-year > sub-type)
- Percentages must sum to 100% per account (enforced client-side and DB constraint)
- Permanent rules skip wizard steps in future years
- Benchmark panel shows peer comparison after completion
- Allocations saved to `functional_allocations` table with audit log

---

## Task 3: Filing Progression Awareness (990 Readiness)

Build automatic 990 form type detection per SYS-P0-010.

### 3A: Filing Logic (`src/lib/compliance/filing-progression.ts`)

**Create `src/lib/compliance/filing-progression.ts`:**
- `determine990FormType(currentYear)` — computes which form RI must file:
  - Year 1: gross receipts for that year only
  - Years 1-3: average gross receipts over years of existence
  - Year 4+: rolling 3-year average of prior years
  - Thresholds: 990-N (≤$50K), 990-EZ (<$200K AND assets <$500K), Full 990 (either exceeded)
  - Total assets test: end-of-year balance (no averaging) — includes CIP as assets
- `check990Thresholds()` — returns current total assets vs $500K and YTD gross receipts vs $200K for dashboard alert

### 3B: 990 Readiness Page (`src/app/(protected)/compliance/990-readiness/`)

**Create 990 readiness checklist page:**
- Shows current filing type determination with threshold data
- Checklist items:
  - `form_990_line` mapped on all active expense accounts
  - Functional allocation completed for the year
  - Officer compensation data populated
  - Contribution source type tags on all donations
- Status indicators: complete / incomplete / not applicable
- Link from dashboard alert section when threshold crossed

**Files to create:**
- `src/lib/compliance/filing-progression.ts`
- `src/app/(protected)/compliance/990-readiness/page.tsx`
- `src/app/(protected)/compliance/990-readiness/readiness-client.tsx`

**Acceptance criteria:**
- Correctly determines 990 form type based on multi-year averaging rules
- CIP counts toward total assets for $500K threshold
- Dashboard alert appears when Full 990 triggered
- Checklist identifies incomplete items

---

## Task 4: W-2 PDF Generation

Build W-2 form filling per TXN-P0-036, using existing `getW2VerificationData()`.

### 4A: W-2 PDF Generator (`src/lib/pdf/w2-generator.ts`)

**Create `src/lib/pdf/w2-generator.ts`:**
- Uses `pdf-lib` to fill official IRS W-2 template
- Input: `W2Row` data from `w2-verification.ts`
- Employer info: RI's EIN, name, address (from env vars or system config)
- Employee info: name, address, SSN (from app-portal via DB read — encrypted, handled per D-132)
- Box placement coordinates for W-2 form fields (Copy A, Copy B, Copy C, Copy D, Copy W-2c if needed)
- Returns PDF buffer

### 4B: W-2 API Route

**Add W-2 generation to PDF route** or create separate `src/app/api/tax-forms/w2/route.ts`:
- GET `?year=2026&employeeId=...` for single employee
- GET `?year=2026` for all employees (combined PDF)
- Preview mode (Report #27 data) vs generation mode (actual PDF fill)

**Files to create:**
- `src/lib/pdf/w2-generator.ts`
- `src/app/api/tax-forms/w2/route.ts`

**Files to modify:**
- None (new route)

**Acceptance criteria:**
- W-2 PDF generated with correct box values matching Report #27 preview
- Employer info populated from system config
- SS wage base cap applied correctly (Box 3 capped)
- Combined PDF for all employees available
- pdf-lib used for pixel-precise field placement

---

## Task 5: 1099-NEC Preparation

Build 1099-NEC tracking and generation per TXN-P0-023.

### 5A: Vendor Payment Aggregation (`src/lib/compliance/vendor-1099.ts`)

**Create `src/lib/compliance/vendor-1099.ts`:**
- `getVendor1099Data(year)` — aggregates vendor payments by calendar year:
  - Queries `transaction_lines` joined with `transactions` + `vendors`
  - Groups by vendor, sums payments for 1099-eligible vendors
  - Fetches threshold from `annual_rate_config` (key: `vendor_1099_threshold`, default $600)
  - Returns: vendor list with total paid, threshold exceeded flag, W-9 status
- `getVendor1099Summary(year)` — dashboard-level summary: count of vendors over threshold, W-9 collection status

### 5B: 1099-NEC PDF Generator (`src/lib/pdf/form-1099-generator.ts`)

**Create `src/lib/pdf/form-1099-generator.ts`:**
- Uses `pdf-lib` to fill official IRS 1099-NEC template
- Input: vendor data (name, address, TIN), total payments, payer info
- Box 1: Nonemployee compensation
- Returns PDF buffer

### 5C: 1099-NEC API Route & UI

**Create `src/app/api/tax-forms/1099/route.ts`:**
- GET `?year=2026` — returns all 1099-eligible vendors over threshold as JSON
- GET `?year=2026&format=csv` — CSV export for CPA
- GET `?year=2026&format=pdf&vendorId=...` — individual 1099-NEC PDF

**Create `src/app/(protected)/compliance/1099-prep/page.tsx`:**
- List of 1099-eligible vendors with YTD payment totals
- Threshold flag ($600 or $2,000 based on tax year via `annual_rate_config`)
- W-9 collection status per vendor
- Bulk actions: generate all PDFs, export CSV
- TaxBandits integration placeholder (optional e-filing path — not blocking for v1)

**Files to create:**
- `src/lib/compliance/vendor-1099.ts`
- `src/lib/pdf/form-1099-generator.ts`
- `src/app/api/tax-forms/1099/route.ts`
- `src/app/(protected)/compliance/1099-prep/page.tsx`
- `src/app/(protected)/compliance/1099-prep/prep-client.tsx`

**Acceptance criteria:**
- Vendor payments aggregated by calendar year from GL data
- $600 threshold flagging (configurable via `annual_rate_config`)
- W-9 status visible per vendor
- CSV export for CPA
- PDF 1099-NEC form generated with correct field placement
- TaxBandits integration stubbed as future enhancement

---

## Task 6: Quarterly 941/M-941 Data Export

Build formatted export per TXN-P0-037, using existing `getQuarterlyTaxPrepData()`.

### 6A: 941 Export Route

**Create `src/app/api/tax-forms/941/route.ts`:**
- GET `?year=2026&quarter=1&format=csv` — CSV matching 941 line items
- GET `?year=2026&quarter=1&format=pdf` — Formatted PDF summary

### 6B: Add PDF case for Report #29

**Modify `src/app/api/reports/pdf/route.ts`:**
- Add `case 'quarterly-tax-prep':` with proper formatting of Federal 941 and MA M-941 data

**Files to create:**
- `src/app/api/tax-forms/941/route.ts`

**Files to modify:**
- `src/app/api/reports/pdf/route.ts` (add quarterly-tax-prep case)

**Acceptance criteria:**
- Federal 941 lines 1-10 populated from payroll data
- MA M-941 wages and withholding populated
- CSV export matches form line structure
- PDF formatted to visual match

---

## Task 7: Board Pack Assembly

Build report selection and combined PDF generation per RPT-P0-007.

### 7A: Board Pack Generator (`src/lib/pdf/board-pack.ts`)

**Create `src/lib/pdf/board-pack.ts`:**
- Input: array of report slugs + date range params
- For each selected report: call `generateReportPDF()` from the existing PDF route logic
- Combine multiple PDF buffers into single document using `pdf-lib` (page merge)
- Add cover page with: "Board Pack — [Date Range]", table of contents
- Returns combined PDF buffer

### 7B: Board Pack UI (`src/app/(protected)/reports/board-pack/`)

**Create board pack page:**
- Checkbox list of all 29 reports (pre-select core financial statements #1-4)
- Date range selector
- Fund filter (optional)
- "Generate Board Pack" button → downloads combined PDF
- No automated distribution (Heather manually shares)

**Files to create:**
- `src/lib/pdf/board-pack.ts`
- `src/app/(protected)/reports/board-pack/page.tsx`
- `src/app/(protected)/reports/board-pack/board-pack-client.tsx`
- `src/app/api/reports/board-pack/route.ts`

**Acceptance criteria:**
- User selects reports from full inventory
- Combined PDF generated with cover page and table of contents
- Core financial statements (#1-4) pre-selected by default
- Download works reliably for up to 10+ reports

---

## Task 8: Additional Report PDF Cases

Several Phase 15/16 reports use the "coming soon" fallback in the PDF route. Add proper rendering for Phase 17-adjacent reports.

**Modify `src/app/api/reports/pdf/route.ts`** — Add cases for:
- `donor-giving-history` (Report #14)
- `ahp-loan-summary` (Report #16)
- `audit-log` (Report #17)
- `transaction-history` (Report #18)
- `late-entries` (Report #19)
- `ahp-annual-package` (Report #20)
- `form-990-data` (Report #21)
- `compliance-calendar` (Report #23)
- `capital-budget` (Report #24)
- `payroll-register` (Report #25)
- `payroll-tax-liability` (Report #26)
- `w2-verification` (Report #27)
- `employer-payroll-cost` (Report #28)
- `quarterly-tax-prep` (Report #29)
- `cash-projection` (Report #15)

**Acceptance criteria:**
- All 29 reports produce proper PDF output (no "coming soon" fallback)

---

## Task 9: Compliance Calendar Enhancements

Enhance the existing compliance calendar with missing items from SYS-P0-009.

### 9A: Add Missing Deadline Types

**Modify `src/lib/compliance/deadline-generator.ts`:**
- Add annual tax rate review (October) — SSA announces SS wage base mid-Oct
- Add public support trajectory review (~FY2028 context note)
- Ensure all deadline types from SYS-P0-009 are present

### 9B: Add Compliance Dashboard Widget

The dashboard alerts section (Task 1) already handles this. Ensure compliance deadlines within 30 days surface in the alerts section with:
- Deadline name, due date, days remaining
- Color-coded urgency: green (>14d), yellow (7-14d), red (<7d), overdue (past due)

**Files to modify:**
- `src/lib/compliance/deadline-generator.ts`

**Acceptance criteria:**
- All SYS-P0-009 deadline types seeded
- Dashboard shows upcoming deadlines with urgency colors

---

## Task 10: Tests

### Unit Tests

**Create `src/lib/compliance/__tests__/functional-allocation.test.ts`:**
- Three-tier default resolution (permanent > prior-year > sub-type)
- Percentage validation (sums to 100%)
- Benchmark outlier flagging (<65% or >90% program)
- Permanent rule detection
- Sub-type default mapping correctness

**Create `src/lib/compliance/__tests__/filing-progression.test.ts`:**
- 990-N determination (≤$50K gross receipts)
- 990-EZ determination (<$200K AND assets <$500K)
- Full 990 trigger (assets >$500K via CIP)
- Multi-year averaging logic (year 1, years 1-3, year 4+ rolling)

**Create `src/lib/compliance/__tests__/vendor-1099.test.ts`:**
- Vendor payment aggregation
- $600 threshold flagging
- Configurable threshold from annual_rate_config

**Create `src/lib/pdf/__tests__/w2-generator.test.ts`:**
- W-2 box value calculation (Box 3 capped at SS wage base)
- Combined PDF generation for multiple employees

**Create `src/lib/dashboard/__tests__/queries.test.ts`:**
- Dashboard section data shapes
- Alert aggregation correctness

### E2E Test

**Create `e2e/phase17-dashboard.spec.ts`:**
- Dashboard loads with all 5 sections visible
- Cash snapshot shows bank balances
- Alerts section shows compliance deadlines
- Navigation to full reports from dashboard links

**Create `e2e/phase17-functional-allocation.spec.ts`:**
- Wizard walks through accounts
- Percentage validation enforced
- Summary with benchmarks shown

---

## Execution Order

Recommended build sequence (some tasks can parallelize):

```
1. Dashboard data layer (Task 1A)          ← foundational
2. Dashboard UI (Task 1B)                  ← depends on 1A
3. Functional allocation logic (Task 2A)   ← independent
4. Functional allocation wizard (Task 2B)  ← depends on 2A
5. Filing progression (Task 3)             ← independent
6. W-2 PDF generation (Task 4)             ← independent
7. 1099-NEC preparation (Task 5)           ← independent
8. 941 export (Task 6)                     ← independent
9. Board pack (Task 7)                     ← depends on Task 8
10. Additional report PDFs (Task 8)        ← independent
11. Compliance enhancements (Task 9)       ← independent
12. Tests (Task 10)                        ← after all tasks
```

**Parallel tracks:**
- Track A: Dashboard (Tasks 1-2)
- Track B: Tax forms (Tasks 4-6)
- Track C: Compliance (Tasks 3, 5, 9)
- Track D: PDF completion (Tasks 7-8)

---

## Requirements Satisfied

| Requirement | Description | Task |
|-------------|-------------|------|
| D-113 | Dashboard home screen with 5 sections | Task 1 |
| SYS-P0-007 | Compliance calendar with all deadlines | Task 9 |
| SYS-P0-008 | Automated email reminders (already built) | Existing |
| SYS-P0-009 | All compliance deadline types seeded | Task 9 |
| SYS-P0-010 | Filing progression awareness | Task 3 |
| TXN-P0-036 | W-2 generation | Task 4 |
| TXN-P0-023 | 1099-NEC preparation | Task 5 |
| TXN-P0-037 | Quarterly 941/M-941 data export | Task 6 |
| TXN-P0-046 | Year-end functional allocation | Task 2 |
| TXN-P0-047 | Smart defaults for allocation wizard | Task 2 |
| TXN-P0-048 | 990 functional expense report (already built) | Existing |
| RPT-P0-002 | PDF export on all reports | Task 8 |
| RPT-P0-007 | Board pack generation | Task 7 |

---

## File Summary

**New files (27):**
- `src/lib/dashboard/queries.ts`
- `src/app/(protected)/(dashboard)/sections/cash-snapshot.tsx`
- `src/app/(protected)/(dashboard)/sections/alerts-attention.tsx`
- `src/app/(protected)/(dashboard)/sections/rent-collection.tsx`
- `src/app/(protected)/(dashboard)/sections/fund-balances.tsx`
- `src/app/(protected)/(dashboard)/sections/recent-activity.tsx`
- `src/lib/compliance/functional-defaults.ts`
- `src/lib/compliance/functional-allocation-logic.ts`
- `src/app/(protected)/compliance/functional-allocation/page.tsx`
- `src/app/(protected)/compliance/functional-allocation/wizard-client.tsx`
- `src/app/(protected)/compliance/functional-allocation/actions.ts`
- `src/lib/compliance/filing-progression.ts`
- `src/app/(protected)/compliance/990-readiness/page.tsx`
- `src/app/(protected)/compliance/990-readiness/readiness-client.tsx`
- `src/lib/pdf/w2-generator.ts`
- `src/app/api/tax-forms/w2/route.ts`
- `src/lib/compliance/vendor-1099.ts`
- `src/lib/pdf/form-1099-generator.ts`
- `src/app/api/tax-forms/1099/route.ts`
- `src/app/(protected)/compliance/1099-prep/page.tsx`
- `src/app/(protected)/compliance/1099-prep/prep-client.tsx`
- `src/app/api/tax-forms/941/route.ts`
- `src/lib/pdf/board-pack.ts`
- `src/app/(protected)/reports/board-pack/page.tsx`
- `src/app/(protected)/reports/board-pack/board-pack-client.tsx`
- `src/app/api/reports/board-pack/route.ts`
- 6 test files (see Task 10)

**Modified files (4):**
- `src/app/(protected)/(dashboard)/page.tsx`
- `src/app/(protected)/(dashboard)/dashboard-client.tsx`
- `src/app/api/reports/pdf/route.ts`
- `src/lib/compliance/deadline-generator.ts`
