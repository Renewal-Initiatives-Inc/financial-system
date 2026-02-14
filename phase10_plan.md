# Phase 10: Payroll Engine — Execution Plan

**Phase:** 10 of 19
**Goal:** Build the full payroll calculation engine, GL posting, and employee data integration.
**Dependencies:** Phase 5 (GL Engine) ✅, Phase 6 (Vendors/Tenants/Donors) ✅
**Blocked by this phase:** Phase 13 (Staging Integration), Phase 16 (Reports Batch 2)

---

## Pre-Implementation Checklist

Before starting, verify these Phase 5 and Phase 6 artifacts exist and are functional:

- [x] GL engine (`src/lib/gl/engine.ts`) — `createTransaction()` with INV-001 through INV-012 enforced
- [x] Audit logger (`src/lib/audit/logger.ts`) — append-only, participates in DB transactions
- [x] Seed accounts include all payroll accounts:
  - `2100` Accrued Payroll Payable (system-locked)
  - `2110` Federal Income Tax Payable (system-locked)
  - `2120` State Income Tax Payable (system-locked)
  - `2130` Social Security Payable (system-locked)
  - `2140` Medicare Payable (system-locked)
  - `2150` Workers Comp Payable
  - `2160` 401(k) Withholding Payable
  - `5000` Salaries & Wages (system-locked, 990 line 5)
- [x] `sourceTypeEnum` includes `TIMESHEET` and `SYSTEM` values
- [x] Payroll route stub exists at `/payroll`
- [x] Navigation includes Payroll link

---

## Task Breakdown

### Task 0: Annual Rate Config Table (Cross-Cutting Prerequisite)
**Files to create:**
- `src/lib/db/schema/annual-rate-config.ts`
- `src/lib/db/seed/annual-rates.ts`
- `src/lib/payroll/rates.ts`
- `src/lib/validators/annual-rate-config.ts`

**Schema definition:**
```
annual_rate_config
├─ id: serial PK
├─ fiscal_year: integer NOT NULL
├─ config_key: varchar(100) NOT NULL
├─ value: numeric(15,6) NOT NULL
├─ effective_date: date (nullable — for mid-year rate changes)
├─ notes: text (nullable)
├─ updated_by: varchar(255) NOT NULL
├─ updated_at: timestamp NOT NULL default now()
└─ UNIQUE(fiscal_year, config_key, effective_date)
```

**Seed data:**

| config_key | fiscal_year | value | notes |
|-----------|-------------|-------|-------|
| `fica_ss_rate` | 2025 | 0.062000 | IRS Pub 15 |
| `fica_ss_rate` | 2026 | 0.062000 | IRS Pub 15 |
| `fica_medicare_rate` | 2025 | 0.014500 | IRS Pub 15 |
| `fica_medicare_rate` | 2026 | 0.014500 | IRS Pub 15 |
| `fica_ss_wage_base` | 2025 | 176100.000000 | SSA announcement |
| `fica_ss_wage_base` | 2026 | 184500.000000 | SSA announcement Oct 2025 |
| `vendor_1099_threshold` | 2025 | 600.000000 | Pre-OBBBA |
| `vendor_1099_threshold` | 2026 | 2000.000000 | Per OBBBA |
| `ma_state_tax_rate` | 2025 | 0.050000 | MA DOR Circular M |
| `ma_state_tax_rate` | 2026 | 0.050000 | MA DOR Circular M |
| `ma_surtax_rate` | 2025 | 0.040000 | MA "millionaire's tax" |
| `ma_surtax_rate` | 2026 | 0.040000 | MA "millionaire's tax" |
| `ma_surtax_threshold` | 2025 | 1053750.000000 | MA DOR (indexed) |
| `ma_surtax_threshold` | 2026 | 1107750.000000 | MA DOR Circular M 2026 |

**Utility function:** `getAnnualRate(key: string, year: number, asOfDate?: string): Promise<number>`
- Queries `annual_rate_config` for the given key and year
- If `asOfDate` provided, returns the rate with `effective_date <= asOfDate` (for mid-year changes)
- Falls back to most recent prior year if current year not yet configured
- Throws if no rate found for the key at all

**Immutability rule:** Rates for a fiscal year become immutable once a payroll run is posted for that year. Enforced at the application level in the update action (check if any `payroll_runs` with `status = 'POSTED'` exist for that fiscal year).

**Modifications to existing files:**
- `src/lib/db/schema/index.ts` — add export for annual-rate-config
- `src/lib/db/seed/index.ts` — add annual rate seeding
- `src/lib/validators/index.ts` — add annual rate config validators

---

### Task 1: Staging Records Schema (Prerequisite — Partial)
**Why here:** Phase 10 reads timesheet data from `staging_records`. Phase 13 handles the full integration (Postgres roles, staging processor, error handling), but the table must exist for Phase 10 to read from and for development/testing.

**Files to create:**
- `src/lib/db/schema/staging-records.ts`
- `src/lib/validators/staging-records.ts`

**Schema definition:**
```
staging_records
├─ id: serial PK
├─ source_app: varchar(50) NOT NULL ('timesheets' | 'expense_reports')
├─ source_record_id: varchar(255) NOT NULL
├─ record_type: varchar(50) NOT NULL ('timesheet_fund_summary' | 'expense_line_item')
├─ employee_id: varchar(255) NOT NULL
├─ reference_id: varchar(255) NOT NULL (timesheet or expense report ID)
├─ date_incurred: date NOT NULL
├─ amount: numeric(12,2) NOT NULL
├─ fund_id: integer NOT NULL FK → funds
├─ gl_account_id: integer (nullable FK → accounts)
├─ metadata: jsonb NOT NULL default '{}'
├─ status: varchar(20) NOT NULL default 'received'
├─ gl_transaction_id: integer (nullable FK → transactions)
├─ created_at: timestamp NOT NULL default now()
├─ processed_at: timestamp (nullable)
└─ UNIQUE(source_app, source_record_id)
```

**Timesheet metadata JSONB shape:**
```typescript
{
  regular_hours: number
  overtime_hours: number
  regular_earnings: number
  overtime_earnings: number
  week_ending_dates: string[]  // for overtime tracking across weeks
}
```

**Scope for Phase 10:** Define the table and run migration. Do NOT build the staging processor or Postgres roles — that's Phase 13. Phase 10 reads from this table for payroll calculations. During development, use seed data / test fixtures to populate staging records.

**Modifications to existing files:**
- `src/lib/db/schema/index.ts` — add export
- `src/lib/validators/index.ts` — add export

---

### Task 2: Payroll Schema (Runs + Entries)
**Files to create:**
- `src/lib/db/schema/payroll.ts` (both tables in one file — they're tightly coupled)

**New enums to add to `src/lib/db/schema/enums.ts`:**
```typescript
export const payrollRunStatusEnum = pgEnum('payroll_run_status', ['DRAFT', 'CALCULATED', 'POSTED'])
```

**payroll_runs table:**
```
payroll_runs
├─ id: serial PK
├─ pay_period_start: date NOT NULL
├─ pay_period_end: date NOT NULL
├─ status: payroll_run_status NOT NULL default 'DRAFT'
├─ created_by: varchar(255) NOT NULL
├─ created_at: timestamp NOT NULL default now()
├─ posted_at: timestamp (nullable)
└─ INDEX on (pay_period_start, pay_period_end)
```

**payroll_entries table:**
```
payroll_entries
├─ id: serial PK
├─ payroll_run_id: integer NOT NULL FK → payroll_runs
├─ employee_id: varchar(255) NOT NULL
├─ employee_name: varchar(255) NOT NULL (denormalized — snapshot at run time)
├─ gross_pay: numeric(12,2) NOT NULL
├─ federal_withholding: numeric(12,2) NOT NULL
├─ state_withholding: numeric(12,2) NOT NULL
├─ social_security_employee: numeric(12,2) NOT NULL
├─ medicare_employee: numeric(12,2) NOT NULL
├─ social_security_employer: numeric(12,2) NOT NULL
├─ medicare_employer: numeric(12,2) NOT NULL
├─ net_pay: numeric(12,2) NOT NULL
├─ fund_allocations: jsonb NOT NULL
│   // Array of { fund_id: number, fund_name: string, amount: string, hours: string }
├─ gl_transaction_id: integer (nullable FK → transactions, employee JE)
├─ gl_employer_transaction_id: integer (nullable FK → transactions, employer FICA JE)
├─ created_at: timestamp NOT NULL default now()
└─ INDEX on payroll_run_id
```

**Validators:** `src/lib/validators/payroll.ts`
- `insertPayrollRunSchema` — validate pay period dates, createdBy
- `payrollEntrySchema` — validate all numeric fields, fund_allocations shape

**Run migration after defining both tables.**

**Modifications to existing files:**
- `src/lib/db/schema/enums.ts` — add `payrollRunStatusEnum`
- `src/lib/db/schema/index.ts` — add payroll exports + relations
- `src/lib/validators/index.ts` — add payroll validators

---

### Task 3: People API Integration
**File to create:** `src/lib/integrations/people.ts`

**Purpose:** Read employee data from app-portal's Neon database via a restricted Postgres role (`financial_system_reader`). This is a cross-Neon-project read per INT-P0-003, INT-P0-010, INT-P0-011.

**Connection:** Separate connection string via `PEOPLE_DATABASE_URL` env var. Create a dedicated Drizzle client for this read-only connection.

**Data to read:**

```typescript
export interface EmployeePayrollData {
  id: string
  name: string
  email: string
  compensationType: 'PER_TASK' | 'SALARIED'
  annualSalary: number | null          // null for PER_TASK
  expectedAnnualHours: number | null   // null for PER_TASK
  exemptStatus: 'EXEMPT' | 'NON_EXEMPT'
  federalFilingStatus: string          // 'single' | 'married' | 'head_of_household'
  federalAllowances: number            // W-4 adjustments
  stateAllowances: number              // MA M-4 allowances
  additionalFederalWithholding: number // per-period extra withholding from W-4 Step 4c
  additionalStateWithholding: number   // per-period extra MA withholding
  isHeadOfHousehold: boolean           // for MA credit
  isBlind: boolean                     // for MA credit (employee and/or spouse)
  spouseIsBlind: boolean               // for MA credit
}
```

**Functions:**
- `getActiveEmployees(): Promise<EmployeePayrollData[]>` — all active employees
- `getEmployeeById(id: string): Promise<EmployeePayrollData | null>` — single employee
- `getEmployeeYtdWages(employeeId: string, year: number): Promise<number>` — sum of gross_pay from payroll_entries for the calendar year (reads from financial-system DB, not app-portal)

**Development approach:** If `PEOPLE_DATABASE_URL` is not set, fall back to a mock data provider (useful for local dev/testing before app-portal integration is live). The mock returns a small set of test employees matching RI's actual team.

**Mock employees for development:**
1. Heather Takle — SALARIED, EXEMPT, annual salary, single filer
2. Test Employee 1 — PER_TASK, NON_EXEMPT, hourly rates from timesheet
3. Test Employee 2 — SALARIED, NON_EXEMPT, annual salary, married filer

---

### Task 4: Federal Income Tax Calculator
**File to create:** `src/lib/payroll/federal-tax.ts`

**Method:** IRS Publication 15-T percentage method for 2026.

**Algorithm (monthly pay period):**

1. **Adjust gross pay:** Subtract pre-tax deductions (none currently — no 401k/health yet)
2. **Annualize:** Multiply monthly gross by 12
3. **Subtract standard deduction** based on filing status (from W-4 Step 1):
   - Single/MFS: $8,600
   - Married Filing Jointly: $12,900
   - Head of Household: $8,600 (same as single per Pub 15-T)
4. **Subtract W-4 Step 4(b) adjustments** (additional deductions claimed)
5. **Apply bracket rates** (2026 annual brackets — see table below)
6. **Add W-4 Step 4(a)** additional income (other income claimed)
7. **De-annualize:** Divide annual tax by 12 for monthly amount
8. **Add Step 4(c)** additional withholding per period

**2026 Federal Tax Brackets (Annual, Percentage Method):**

Single/MFS:
| Over | But not over | Rate | Plus |
|------|-------------|------|------|
| $0 | $7,500 | 0% | $0 |
| $7,500 | $19,900 | 10% | $0 |
| $19,900 | $57,900 | 12% | $1,240 |
| $57,900 | $113,200 | 22% | $5,800 |
| $113,200 | $209,275 | 24% | $17,966 |
| $209,275 | $263,725 | 32% | $41,024 |
| $263,725 | $648,100 | 35% | $58,448 |
| $648,100 | — | 37% | $192,979.25 |

Married Filing Jointly:
| Over | But not over | Rate | Plus |
|------|-------------|------|------|
| $0 | $19,300 | 0% | $0 |
| $19,300 | $44,100 | 10% | $0 |
| $44,100 | $120,100 | 12% | $2,480 |
| $120,100 | $230,700 | 22% | $11,600 |
| $230,700 | $422,850 | 24% | $35,932 |
| $422,850 | $531,750 | 32% | $82,048 |
| $531,750 | $788,000 | 35% | $116,896 |
| $788,000 | — | 37% | $206,583.50 |

Head of Household:
| Over | But not over | Rate | Plus |
|------|-------------|------|------|
| $0 | $15,550 | 0% | $0 |
| $15,550 | $33,250 | 10% | $0 |
| $33,250 | $83,000 | 12% | $1,770 |
| $83,000 | $121,250 | 22% | $7,740 |
| $121,250 | $217,300 | 24% | $16,155 |
| $217,300 | $271,750 | 32% | $39,207 |
| $271,750 | $656,150 | 35% | $56,631 |
| $656,150 | — | 37% | $191,171 |

**Implementation notes:**
- Store bracket tables as typed constants (not DB — they're IRS-published, not user-editable)
- Organize by tax year so future year updates are isolated
- Monthly conversion: annualize → compute → de-annualize
- Result is never negative (floor at $0)

**Export:**
```typescript
export function calculateFederalWithholding(params: {
  monthlyGross: number
  filingStatus: 'single' | 'married' | 'head_of_household'
  additionalDeductions: number      // W-4 Step 4(b), annualized
  additionalIncome: number          // W-4 Step 4(a), annualized
  additionalWithholding: number     // W-4 Step 4(c), per period
  taxYear: number
}): number
```

---

### Task 5: MA State Income Tax Calculator
**File to create:** `src/lib/payroll/ma-state-tax.ts`

**Method:** MA DOR Circular M 2026 percentage method.

**Algorithm (monthly pay period):**

1. **Start with gross pay** for the month
2. **Subtract exemptions:**
   - 1 allowance: $4,400/year ($366.67/month)
   - N allowances (N > 1): ($1,000 × N + $3,400)/year
3. **Annualize** the result (multiply by 12)
4. **Apply tax rates:**
   - 5% on annualized wages up to $1,107,750 (2026 threshold)
   - 9% on annualized wages over $1,107,750 (5% base + 4% surtax)
5. **De-annualize** (divide by 12)
6. **Subtract credits:**
   - Head of Household: $10.00/month ($120/year)
   - Blindness (employee): $9.17/month ($110/year)
   - Blindness (spouse): $9.17/month ($110/year)
7. **Add additional withholding** per period
8. Result is never negative (floor at $0)

**Implementation notes:**
- The surtax threshold is indexed annually — read from `annual_rate_config` (`ma_surtax_threshold`)
- The base rate reads from `annual_rate_config` (`ma_state_tax_rate`)
- The surtax rate reads from `annual_rate_config` (`ma_surtax_rate`)
- Exemption formula and credits are in code constants (not DB — rarely change)

**Export:**
```typescript
export function calculateMAWithholding(params: {
  monthlyGross: number
  allowances: number
  isHeadOfHousehold: boolean
  isBlind: boolean
  spouseIsBlind: boolean
  additionalWithholding: number
  taxYear: number
  rates: { stateRate: number; surtaxRate: number; surtaxThreshold: number }
}): number
```

---

### Task 6: FICA Calculator
**File to create:** `src/lib/payroll/fica.ts`

**Algorithm:**

1. **Social Security (employee):** `min(monthlyGross, remainingWageBase) × ssRate`
   - `remainingWageBase = ssWageBase - ytdWages` (if positive, else 0)
   - Rate: 6.2% (from `annual_rate_config`)
   - Wage base 2026: $184,500 (from `annual_rate_config`)
2. **Social Security (employer):** Same formula, same cap
3. **Medicare (employee):** `monthlyGross × medicareRate`
   - Rate: 1.45% (from `annual_rate_config`)
   - No wage base cap
4. **Medicare (employer):** Same formula
5. **Additional Medicare Tax:** 0.9% on wages exceeding $200,000 YTD (employee only, no employer match)
   - Not common for RI's pay levels, but implement for correctness

**Implementation notes:**
- ALL rates read from `annual_rate_config` — NEVER hardcoded
- YTD wages computed from prior `payroll_entries` in the same calendar year
- Wage base cap applies to cumulative annual wages, not per-period

**Export:**
```typescript
export function calculateFICA(params: {
  monthlyGross: number
  ytdWages: number
  taxYear: number
  rates: { ssRate: number; medicareRate: number; ssWageBase: number }
}): {
  socialSecurityEmployee: number
  socialSecurityEmployer: number
  medicareEmployee: number
  medicareEmployer: number
}
```

---

### Task 7: Gross Pay Calculator
**File to create:** `src/lib/payroll/gross-pay.ts`

**Purpose:** Calculate gross pay per employee from staging records + employee data.

**Algorithm:**

1. **Query staging_records** for the pay period:
   - `source_app = 'timesheets'`
   - `record_type = 'timesheet_fund_summary'`
   - `status = 'received'`
   - `date_incurred` within the pay period range
   - Grouped by `employee_id`

2. **Per employee, by compensation type:**

   **PER_TASK employees:**
   - Sum `amount` from staging records (renewal-timesheets already applied task code rates)
   - Sum `metadata.regular_hours` and `metadata.overtime_hours` from staging records
   - Overtime: if NON_EXEMPT, check if any week had >40 hours. If so, overtime premium = (overtime_hours × hourly_rate × 0.5) — the base 1x is already in the staging amount
   - Note: renewal-timesheets calculates at straight time. Phase 10 applies the 1.5x premium for overtime

   **SALARIED employees:**
   - Hourly rate = `annual_salary / expected_annual_hours` (from People API)
   - Regular pay = `regular_hours × hourly_rate`
   - Overtime (NON_EXEMPT only): `overtime_hours × hourly_rate × 1.5`
   - EXEMPT employees: `all_hours × hourly_rate` (no overtime premium)

3. **Fund allocation:** Each staging record has a `fund_id`. Gross pay is allocated by fund based on the staging records' fund breakdown.

**Export:**
```typescript
export interface EmployeeGrossPay {
  employeeId: string
  grossPay: number
  fundAllocations: Array<{
    fundId: number
    fundName: string
    amount: number
    hours: number
  }>
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  stagingRecordIds: number[]  // track which staging records were consumed
}

export function calculateGrossPay(params: {
  employee: EmployeePayrollData
  stagingRecords: StagingRecord[]
  payPeriodStart: string
  payPeriodEnd: string
}): EmployeeGrossPay
```

---

### Task 8: Payroll Engine (Orchestrator)
**File to create:** `src/lib/payroll/engine.ts`

**Purpose:** Orchestrate the full payroll calculation and GL posting pipeline.

**Functions:**

#### `calculatePayrollRun(runId: number): Promise<PayrollCalculation>`
1. Load the payroll run record
2. Fetch all staging records for the pay period
3. Fetch all active employees from People API
4. Fetch annual rates from `annual_rate_config`
5. For each employee with staging records:
   a. Calculate gross pay (Task 7)
   b. Look up YTD wages for FICA wage base cap
   c. Calculate federal withholding (Task 4)
   d. Calculate MA state withholding (Task 5)
   e. Calculate FICA — employee and employer (Task 6)
   f. Calculate net pay = gross - federal - state - SS(ee) - Medicare(ee)
6. Return the full calculation result (not yet persisted)
7. Update payroll run status to `CALCULATED`

#### `postPayrollRun(runId: number, userId: string): Promise<void>`
1. Verify run status is `CALCULATED`
2. In a single DB transaction:
   a. For each employee payroll entry, create **two GL transactions** via GL engine:

   **Employee JE (per employee):**
   - DR Salaries & Wages (5000) — per fund from fund_allocations
   - CR Federal Income Tax Payable (2110) — federal_withholding
   - CR State Income Tax Payable (2120) — state_withholding
   - CR Social Security Payable (2130) — social_security_employee
   - CR Medicare Payable (2140) — medicare_employee
   - CR Accrued Payroll Payable (2100) — net_pay
   - `sourceType: 'SYSTEM'`, `isSystemGenerated: true`
   - `memo: "Payroll [period] - [employee name]"`

   **Employer FICA JE (per employee):**
   - DR Salaries & Wages (5000) — employer FICA total, allocated by fund
   - CR Social Security Payable (2130) — social_security_employer
   - CR Medicare Payable (2140) — medicare_employer
   - `sourceType: 'SYSTEM'`, `isSystemGenerated: true`
   - `memo: "Employer FICA [period] - [employee name]"`

   b. Insert `payroll_entries` records with `gl_transaction_id` and `gl_employer_transaction_id`
   c. Update consumed `staging_records` status to `'posted'`
   d. Update payroll run status to `'POSTED'`, set `posted_at`
   e. Log audit entries

**Account code lookups:** The engine needs to resolve account IDs by code. Use the existing `accounts` table:
- `5000` → Salaries & Wages
- `2100` → Accrued Payroll Payable
- `2110` → Federal Income Tax Payable
- `2120` → State Income Tax Payable
- `2130` → Social Security Payable
- `2140` → Medicare Payable

Build a helper: `getPayrollAccountIds(): Promise<PayrollAccounts>` that fetches all six by code.

---

### Task 9: Server Actions
**File to create:** `src/app/(protected)/payroll/actions.ts`

**Query actions:**
- `getPayrollRuns(filters?)` — list all runs with status, period, totals
- `getPayrollRunById(id)` — single run with entries
- `getPayrollRunEntries(runId)` — per-employee breakdown for a run
- `getStagingRecordsForPeriod(start, end)` — preview staging data before creating run
- `getAnnualRates(year)` — current rate config for display
- `getPayrollAccountIds()` — resolve account codes to IDs

**Mutation actions:**
- `createPayrollRun(data, userId)` — create draft run, return ID
- `calculatePayrollRun(runId, userId)` — run calculations, persist entries
- `postPayrollRun(runId, userId)` — GL posting + staging status update
- `deletePayrollRun(runId, userId)` — only if status is DRAFT (delete entries too)
- `updateAnnualRate(id, data, userId)` — with immutability check (no edits if posted runs exist for that year)
- `createAnnualRate(data, userId)` — add new rate config entry

---

### Task 10: Payroll Run List Page
**File to modify:** `src/app/(protected)/payroll/page.tsx` (replace stub)

**Layout:**
- Page title: "Payroll" with HelpTooltip for "payroll"
- "New Payroll Run" button (links to `/payroll/runs/new`)
- TanStack Table with columns:
  - Pay Period (formatted as "Jan 2026" or "Jan 1 - Jan 31, 2026")
  - Status (badge: Draft / Calculated / Posted)
  - Employees (#)
  - Total Gross
  - Total Net
  - Posted At (if posted)
  - Actions (View)
- Sortable by period, filterable by status
- Empty state: "No payroll runs yet. Create your first payroll run to get started."

---

### Task 11: New Payroll Run Page (Wizard)
**Files to create:**
- `src/app/(protected)/payroll/runs/new/page.tsx`
- `src/app/(protected)/payroll/runs/new/payroll-wizard.tsx`

**Multi-step wizard flow:**

**Step 1: Select Pay Period**
- Month/year selector (monthly pay periods per TXN-P0-030)
- System shows staging record count for the selected period
- Warning if no staging records found
- Warning if a run already exists for this period
- "Create Draft" button → creates payroll_run with status DRAFT

**Step 2: Review & Calculate**
- Shows per-employee breakdown table:
  - Employee Name
  - Compensation Type (Salaried/Per Task)
  - Regular Hours / Overtime Hours
  - Gross Pay (by fund breakdown)
  - Federal Tax
  - State Tax
  - Social Security (EE)
  - Medicare (EE)
  - Net Pay
  - Employer SS + Medicare
- Summary row with totals
- Fund allocation summary section
- "Calculate" button → runs `calculatePayrollRun()`, persists entries
- Status changes to CALCULATED

**Step 3: Review & Post**
- Same table as Step 2 but with GL entry preview:
  - Shows the journal entries that will be generated
  - DR/CR columns with account names and amounts
  - Per-employee collapsible sections
- Fund allocation summary
- "Post to GL" button → runs `postPayrollRun()`
- On success: redirect to payroll run detail page
- Status changes to POSTED

---

### Task 12: Payroll Run Detail Page
**Files to create:**
- `src/app/(protected)/payroll/runs/[id]/page.tsx`
- `src/app/(protected)/payroll/runs/[id]/payroll-run-detail.tsx`

**Layout:**
- Breadcrumb: Payroll > Run #X (Jan 2026)
- Status badge (DRAFT / CALCULATED / POSTED)
- Summary cards: Total Gross, Total Net, Total Employer Cost, Employee Count
- Per-employee table (same columns as wizard Step 2)
- Expandable rows showing:
  - Fund allocation breakdown
  - GL transaction links (if posted) — clickable to `/transactions/[id]`
- If DRAFT: "Calculate" and "Delete" buttons
- If CALCULATED: "Post" and "Recalculate" buttons
- If POSTED: Read-only view, "View GL Entries" links

---

### Task 13: Annual Rate Config UI
**Files to create:**
- `src/app/(protected)/settings/rates/page.tsx`
- `src/app/(protected)/settings/rates/rate-config-table.tsx`
- `src/app/(protected)/settings/rates/edit-rate-dialog.tsx`

**Layout:**
- Accessible from Settings > Annual Rates
- TanStack Table grouped by fiscal year:
  - Config Key (human-readable label)
  - Value (formatted: percentages as "6.200%", money as "$184,500")
  - Effective Date (or "Full Year")
  - Notes
  - Last Updated
  - Actions (Edit — disabled if immutable)
- "Add Rate" button for new entries
- Immutability indicator: lock icon + tooltip "Cannot edit — payroll has been posted for this year"

---

### Task 14: Help Terms
**File to modify:** `src/lib/help/terms.ts`

**New terms to add:**

| Term Key | Definition |
|---------|-----------|
| `payroll` | Monthly payroll processing. Reads approved timesheets, calculates withholdings (federal, MA state, FICA), and generates GL entries per employee. |
| `payroll-run` | A batch payroll calculation for a specific monthly pay period. Progresses through Draft → Calculated → Posted states. |
| `gross-pay` | Total compensation before any deductions. For salaried employees: annual salary ÷ expected annual hours × hours worked. For per-task employees: sum of task-code-rated earnings from timesheets. |
| `net-pay` | Take-home pay after all withholdings: gross pay minus federal tax, state tax, Social Security, and Medicare. |
| `federal-withholding` | Federal income tax withheld per IRS Publication 15-T percentage method. Based on W-4 filing status, pay frequency, and claimed adjustments. |
| `ma-state-withholding` | Massachusetts income tax withheld per DOR Circular M. 5% flat rate with 4% surtax on income over the annual threshold ($1,107,750 in 2026). |
| `fica` | Federal Insurance Contributions Act taxes: Social Security (6.2% up to wage base) and Medicare (1.45%, no cap). Both employee and employer pay equal shares. |
| `ss-wage-base` | Annual Social Security wage base — the maximum earnings subject to Social Security tax. $184,500 for 2026 (SSA announcement). Once exceeded, no more SS tax is withheld for the year. |
| `exempt-status` | FLSA classification. EXEMPT employees receive straight-time pay regardless of hours. NON_EXEMPT employees receive 1.5× overtime pay for hours exceeding 40 per week. |
| `compensation-type` | PER_TASK employees are paid based on task code rates applied in renewal-timesheets. SALARIED employees use a pre-calculated hourly rate (annual salary ÷ expected annual hours). |
| `fund-allocation-payroll` | Payroll expenses are coded to the fund(s) specified on each timesheet entry. A single employee's pay can split across multiple funds if their timesheet hours span multiple funding sources. |
| `annual-rate-config` | System-wide table of year-specific rates: FICA percentages, SS wage base, MA tax rate, 1099 thresholds. Updated annually (October) when IRS/SSA announce next-year values. |
| `employer-fica` | The employer's matching share of FICA taxes — 6.2% Social Security + 1.45% Medicare. Recorded as a separate GL entry: DR Salaries & Wages, CR Social Security/Medicare Payable. |

---

### Task 15: Navigation Updates
**File to modify:** `src/components/layout/nav-items.ts`

Add payroll sub-navigation:
- Payroll (parent, links to `/payroll` — run list)
- New Run (links to `/payroll/runs/new`)

Also add Settings > Annual Rates link.

---

### Task 16: Unit Tests
**File to create:** `src/lib/payroll/__tests__/federal-tax.test.ts`

**Federal tax test cases:**
1. Single filer, $3,000/month gross → expected withholding
2. Single filer, $8,000/month gross → crosses brackets
3. Married filer, $5,000/month gross → lower bracket
4. Married filer, $15,000/month gross → higher bracket
5. Head of household, $4,500/month → HoH brackets
6. Zero income → $0 withholding
7. High income → top bracket verification
8. Additional withholding (W-4 Step 4c) adds correctly
9. Additional deductions (W-4 Step 4b) reduces withholding

**File to create:** `src/lib/payroll/__tests__/ma-state-tax.test.ts`

**MA tax test cases:**
1. Single allowance, $4,000/month → 5% rate
2. Two allowances → correct exemption formula
3. Zero allowances → no exemption
4. Head of household credit applied
5. Blindness credit applied (employee)
6. Blindness credit applied (both employee and spouse)
7. High income → surtax kicks in above threshold
8. Additional withholding adds correctly
9. Result never goes below $0

**File to create:** `src/lib/payroll/__tests__/fica.test.ts`

**FICA test cases:**
1. Normal wages → 6.2% SS + 1.45% Medicare, both EE and ER
2. YTD wages near SS wage base → partial SS on remaining wages
3. YTD wages exceed SS wage base → $0 SS, Medicare still applies
4. YTD wages exactly at wage base → $0 SS this period
5. First payroll of year (YTD = 0) → full SS
6. Monthly gross that would cross the wage base mid-period → cap correctly

**File to create:** `src/lib/payroll/__tests__/gross-pay.test.ts`

**Gross pay test cases:**
1. SALARIED employee: hourly rate = salary / expected_hours × hours
2. PER_TASK employee: sum staging amounts
3. NON_EXEMPT overtime: 1.5x for hours > 40/week
4. EXEMPT no overtime premium regardless of hours
5. Multi-fund allocation: staging records on different funds
6. No staging records → $0 gross pay
7. Multiple weeks in pay period → overtime calculated per week

**File to create:** `src/lib/payroll/__tests__/engine.test.ts`

**Engine integration test cases:**
1. Full payroll calculation produces correct entries
2. GL entries balance (debits = credits) per employee
3. Fund allocation flows through to GL line items
4. Staging records marked as posted after GL posting
5. Payroll run status transitions: DRAFT → CALCULATED → POSTED
6. Cannot post a DRAFT run (must calculate first)
7. Cannot delete a POSTED run
8. Employer FICA JE is separate from employee JE
9. Net pay = gross - federal - state - SS(ee) - Medicare(ee)

---

### Task 17: E2E Test
**File to create:** `tests/e2e/payroll.spec.ts`

**Test scenario:**
1. Seed staging records for a test pay period (2 employees, multiple funds)
2. Navigate to `/payroll`
3. Click "New Payroll Run"
4. Select pay period
5. Verify employee data loads correctly
6. Click "Calculate"
7. Verify per-employee breakdown shows correct withholdings
8. Click "Post to GL"
9. Verify redirect to detail page with POSTED status
10. Navigate to transactions — verify GL entries exist with correct amounts
11. Verify staging records status changed to 'posted'
12. Verify payroll run cannot be deleted after posting

---

## File Summary

### New Files (20)

| File | Purpose |
|------|---------|
| `src/lib/db/schema/annual-rate-config.ts` | Annual rate config table definition |
| `src/lib/db/schema/staging-records.ts` | Staging records table definition |
| `src/lib/db/schema/payroll.ts` | Payroll runs + entries tables |
| `src/lib/db/seed/annual-rates.ts` | Seed data for tax rates |
| `src/lib/validators/annual-rate-config.ts` | Zod schemas for rate config |
| `src/lib/validators/staging-records.ts` | Zod schemas for staging records |
| `src/lib/validators/payroll.ts` | Zod schemas for payroll runs/entries |
| `src/lib/integrations/people.ts` | People API reader (app-portal DB) |
| `src/lib/payroll/rates.ts` | `getAnnualRate()` utility |
| `src/lib/payroll/federal-tax.ts` | IRS Pub 15-T withholding calculator |
| `src/lib/payroll/ma-state-tax.ts` | MA Circular M withholding calculator |
| `src/lib/payroll/fica.ts` | FICA calculator (SS + Medicare) |
| `src/lib/payroll/gross-pay.ts` | Gross pay calculator from staging |
| `src/lib/payroll/engine.ts` | Payroll engine orchestrator |
| `src/app/(protected)/payroll/actions.ts` | Payroll server actions |
| `src/app/(protected)/payroll/runs/new/page.tsx` | New payroll run page |
| `src/app/(protected)/payroll/runs/new/payroll-wizard.tsx` | Multi-step wizard component |
| `src/app/(protected)/payroll/runs/[id]/page.tsx` | Payroll run detail page |
| `src/app/(protected)/payroll/runs/[id]/payroll-run-detail.tsx` | Detail view component |
| `src/app/(protected)/settings/rates/page.tsx` | Rate config management page |

### Modified Files (7)

| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add `payrollRunStatusEnum` |
| `src/lib/db/schema/index.ts` | Export new schemas + relations |
| `src/lib/validators/index.ts` | Export new validators |
| `src/lib/help/terms.ts` | Add 13 payroll help terms |
| `src/app/(protected)/payroll/page.tsx` | Replace stub with run list |
| `src/components/layout/nav-items.ts` | Add payroll sub-nav items |
| `src/lib/db/seed/index.ts` | Add annual rate seeding |

### Test Files (6)

| File | Coverage |
|------|----------|
| `src/lib/payroll/__tests__/federal-tax.test.ts` | 9 test cases |
| `src/lib/payroll/__tests__/ma-state-tax.test.ts` | 9 test cases |
| `src/lib/payroll/__tests__/fica.test.ts` | 6 test cases |
| `src/lib/payroll/__tests__/gross-pay.test.ts` | 7 test cases |
| `src/lib/payroll/__tests__/engine.test.ts` | 9 test cases |
| `tests/e2e/payroll.spec.ts` | 1 full E2E scenario |

---

## Requirements Satisfied

| Requirement ID | Description | How Satisfied |
|---------------|-------------|---------------|
| TXN-P0-030 | Full in-house payroll, monthly pay period | Payroll engine + run wizard |
| TXN-P0-031 | Payroll GL entry structure (DR Wages, CR payables) | GL posting in engine.ts |
| TXN-P0-032 | Dual compensation model (PER_TASK/SALARIED) | gross-pay.ts calculator |
| TXN-P0-033 | Overtime: 1.5x for NON_EXEMPT, straight-time for EXEMPT | gross-pay.ts calculator |
| TXN-P0-034 | Payroll coded to fund per timesheet allocation | Fund allocation in GL entries |
| TXN-P0-035 | Federal/MA/FICA withholding calculations | federal-tax.ts, ma-state-tax.ts, fica.ts |
| INT-P0-010 | app-portal is SSOT for employee data | people.ts integration |
| INT-P0-011 | Financial-system reads employee withholding data | people.ts integration |
| INV-008 | System-generated entries flagged, non-editable | `isSystemGenerated: true` on payroll JEs |
| INV-011 | Source provenance on every transaction | `sourceType: 'SYSTEM'` on payroll JEs |
| INV-012 | Audit log for every GL write | Audit entries in postPayrollRun |

**Deferred to later phases:**
- TXN-P0-036 (W-2 generation) → Phase 16 (Reports Batch 2)
- TXN-P0-037 (941/M-941 data prep) → Phase 16 (Reports Batch 2)
- Reports #25-29 (payroll reports) → Phase 16

---

## Execution Order

The tasks should be executed in this sequence (some can be parallelized):

```
Task 0: Annual Rate Config ─────────────────┐
Task 1: Staging Records Schema ─────────────┤
Task 2: Payroll Schema ─────────────────────┤── DB layer (parallel)
                                             │
Task 3: People API Integration ─────────────┘
         │
         ├── Task 4: Federal Tax Calculator ─┐
         ├── Task 5: MA State Tax Calculator ─┤── Calculators (parallel)
         ├── Task 6: FICA Calculator ─────────┘
         │
         └── Task 7: Gross Pay Calculator
                │
                └── Task 8: Payroll Engine (orchestrator)
                       │
                       ├── Task 9: Server Actions
                       │
                       ├── Task 10: Payroll Run List ──────┐
                       ├── Task 11: New Run Wizard ─────────┤── UI (parallel)
                       ├── Task 12: Run Detail Page ────────┤
                       └── Task 13: Rate Config UI ─────────┘
                              │
                              ├── Task 14: Help Terms
                              ├── Task 15: Nav Updates
                              │
                              ├── Task 16: Unit Tests
                              └── Task 17: E2E Test
```

**Estimated task count:** 18 tasks (0-17)
**Migration runs:** After Tasks 0-2 (single migration covering all new tables)

---

## Risk Notes

1. **People API availability:** If app-portal's employee schema doesn't yet have all required fields (compensation_type, exempt_status, withholding elections), the mock provider covers development. Flag this dependency early with Jeff.

2. **Tax bracket accuracy:** Federal brackets change annually. The 2026 brackets are confirmed from IRS Pub 15-T. Structure the code so updating to 2027 brackets is a single constant change.

3. **Staging data format:** The staging_records JSONB metadata shape must align with what renewal-timesheets will INSERT. Define the contract here; Phase 13 enforces it.

4. **Surtax edge case:** The MA millionaire's surtax won't apply to RI employees at current pay levels, but implement it correctly now for completeness and future-proofing.

5. **Overtime across pay periods:** Weekly overtime (>40 hrs) must be tracked per week, not per pay period. The staging data includes `week_ending_dates` in metadata to support this.
