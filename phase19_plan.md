# Phase 19: Security Deposits (MA Compliance) & Automated Entries

**Goal:** Build the MA-compliant security deposit system with automated interest calculation, receipt tracking, compliance calendar integration, and Security Deposit Register (Report #22).

**Dependencies:** Phase 6 (Tenants CRUD — complete), Phase 7 (Revenue Recognition — rent accrual patterns)

**Requirements satisfied:** TXN-P0-049, TXN-P0-050, TXN-P0-041, DM-P0-013, SYS-P0-007, SYS-P0-008, SYS-P0-009, Report #22, Report #23 (compliance calendar)

---

## Pre-Flight Checklist

Verify before starting:
- [ ] Tenant schema has all security deposit fields (securityDepositAmount, escrowBankRef, depositDate, interestRate, statementOfConditionDate, tenancyAnniversary)
- [ ] GL accounts exist: 1020 (Security Deposit Escrow), 2060 (Security Deposits Held), 5100 (Interest Expense)
- [ ] GL engine (`src/lib/gl/engine.ts`) supports system-generated entries
- [ ] Cron pattern proven (depreciation, interest-accrual, prepaid-amortization routes exist)
- [ ] Postmark integration pattern exists (`src/lib/integrations/ramp-sync-notification.ts`)

---

## Task Breakdown

### Task 1: Security Deposit Interest Tracking Schema

**What:** Create `security_deposit_interest_payments` table to track annual interest calculations and payments per tenant.

**Files to create:**
- `src/lib/db/schema/security-deposit-interest.ts` — Drizzle table definition

**Schema:**
```
security_deposit_interest_payments
├─ id (serial PK)
├─ tenant_id (FK → tenants)
├─ period_start (date — anniversary start)
├─ period_end (date — anniversary end)
├─ deposit_amount (numeric 12,2 — deposit at time of calc)
├─ interest_rate (numeric 5,4 — rate used)
├─ interest_amount (numeric 12,2 — calculated amount)
├─ gl_transaction_id (FK → transactions, nullable — set when GL entry posted)
├─ paid_at (timestamp, nullable — set when interest actually paid)
├─ created_at (timestamp)
```

**Files to modify:**
- `src/lib/db/schema/index.ts` — export new table + relations
- `src/lib/db/schema/enums.ts` — no new enums needed (uses existing patterns)

**Migration:** Generate via `drizzle-kit generate`

---

### Task 2: Compliance Deadlines Schema

**What:** Create `compliance_deadlines` table per design.md §2.6. This tracks all recurring compliance deadlines with Postmark reminder support.

**Files to create:**
- `src/lib/db/schema/compliance-deadlines.ts` — Drizzle table definition

**Schema (per design.md):**
```
compliance_deadlines
├─ id (serial PK)
├─ task_name (varchar 255)
├─ due_date (date)
├─ category (varchar — tax/tenant/grant/budget)
├─ recurrence (varchar — annual/monthly/per_tenant/one_time)
├─ status (varchar — upcoming/reminded/completed)
├─ reminder_30d_sent (boolean default false)
├─ reminder_7d_sent (boolean default false)
├─ tenant_id (integer FK → tenants, nullable)
├─ notes (text, nullable)
├─ created_at (timestamp)
```

**New enum:**
- `complianceDeadlineCategoryEnum`: `tax`, `tenant`, `grant`, `budget`
- `complianceDeadlineRecurrenceEnum`: `annual`, `monthly`, `per_tenant`, `one_time`
- `complianceDeadlineStatusEnum`: `upcoming`, `reminded`, `completed`

**Files to modify:**
- `src/lib/db/schema/enums.ts` — add 3 new enums
- `src/lib/db/schema/index.ts` — export + relations (tenant FK)

**Migration:** Generate via `drizzle-kit generate`

---

### Task 3: Security Deposit Collection GL Entry (Server Action)

**What:** Build the "Collect Security Deposit" action that creates the proper GL entry: DR Security Deposit Escrow (1020), CR Security Deposits Held (2060). Enforce MA maximum (deposit ≤ first month's rent).

**Files to create:**
- `src/lib/security-deposits/collect.ts` — collection logic
  - `collectSecurityDeposit(tenantId, amount, depositDate, escrowBankRef, userId)`
  - Validates: deposit ≤ monthly rent, tenant active, deposit not already collected
  - Creates GL entry via `createTransaction()` with source_type = MANUAL
  - Updates tenant record (depositDate, securityDepositAmount, escrowBankRef)
  - Calculates and sets tenancyAnniversary from moveInDate
  - Sets statementOfConditionDate deadline (moveInDate + 10 days)
  - Creates compliance_deadlines: statement of condition (10 days), initial receipt (30 days), annual interest anniversary
  - Logs to audit trail

**Files to modify:**
- `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx` — add "Collect Security Deposit" button/dialog
- `src/app/(protected)/tenants/actions.ts` — add `collectSecurityDeposit` server action

---

### Task 4: Receipt Tracking (TXN-P0-050)

**What:** Track the two MA-required receipts per tenant: (1) collection receipt, (2) 30-day receipt with bank details. Also track statement of condition date.

**Files to create:**
- `src/lib/db/schema/security-deposit-receipts.ts` — Track receipt dates

**Schema:**
```
security_deposit_receipts
├─ id (serial PK)
├─ tenant_id (FK → tenants)
├─ receipt_type (varchar — collection_receipt / bank_details_receipt / statement_of_condition)
├─ due_date (date — when it must be provided by)
├─ completed_date (date, nullable — when it was actually provided)
├─ created_at (timestamp)
```

**Files to modify:**
- `src/lib/db/schema/index.ts` — export + relations
- `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx` — add receipt tracking checklist in Security Deposit card showing:
  - Collection receipt: [due date] [✓ completed / ✗ overdue / pending]
  - 30-day bank details receipt: [due date] [status]
  - Statement of condition: [due date] [status]

---

### Task 5: Security Deposit Interest Calculation Engine

**What:** Build the interest calculation per MA G.L. c. 186 § 15B: deposit × rate × days/365. Rate = lesser of actual bank rate or 5%.

**Files to create:**
- `src/lib/security-deposits/interest.ts` — core calculation + GL entry generation
  - `calculateDepositInterest(deposit, rate, periodStart, periodEnd)` → number (rounded to cents)
  - `generateInterestEntries(asOfDate, userId)` → process all tenants with deposits where anniversary falls in current month
  - GL entry: DR Interest Expense (5100), CR Cash (checking account). Posted to General Fund.
  - Creates `security_deposit_interest_payments` record
  - Audit log entry

**Key rules:**
- Interest = deposit × min(actual_rate, 0.05) × (days_in_period / 365)
- Paid annually on tenancy anniversary (or within 30 days)
- Rate on tenant record is the actual bank rate; system caps at 5%
- If no interest rate set on tenant, skip with warning

---

### Task 6: Security Deposit Interest Cron Job

**What:** Monthly cron job that checks for tenants whose tenancy anniversary falls in the current month and generates interest entries.

**Files to create:**
- `src/app/api/cron/security-deposit-interest/route.ts` — cron endpoint
  - Pattern: CRON_SECRET validation → call `generateInterestEntries()` → JSON response
  - Schedule: monthly on the 1st (0 6 1 * *)

**Files to modify:**
- `vercel.json` — add cron entry for `/api/cron/security-deposit-interest`

---

### Task 7: Compliance Calendar Schema Seeding & Deadline Generator

**What:** Seed initial compliance deadlines and build the generator that creates per-tenant deadlines when deposits are collected.

**Files to create:**
- `src/lib/compliance/deadline-generator.ts` — generates/refreshes deadlines
  - `generateAnnualDeadlines(fiscalYear)` — creates tax deadlines (990, Form PC, 941s, W-2s, 1099s), budget cycle, insurance renewal, annual reviews
  - `generateTenantDeadlines(tenantId)` — creates per-tenant deposit anniversary, receipt deadlines
  - `completeDeadline(deadlineId, userId)` — marks complete with audit
- `src/lib/db/seed/compliance-deadlines.ts` — initial deadline seeds per SYS-P0-009

**Seed data (from requirements SYS-P0-009):**

| Task | Category | Recurrence | Due Date Pattern |
|------|----------|------------|------------------|
| Form 990 filing | tax | annual | May 15 |
| Form PC filing | tax | annual | May 15 |
| Federal 941 (Q1) | tax | annual | Apr 30 |
| Federal 941 (Q2) | tax | annual | Jul 31 |
| Federal 941 (Q3) | tax | annual | Oct 31 |
| Federal 941 (Q4) | tax | annual | Jan 31 |
| MA M-941 (Q1) | tax | annual | Apr 30 |
| MA M-941 (Q2) | tax | annual | Jul 31 |
| MA M-941 (Q3) | tax | annual | Oct 31 |
| MA M-941 (Q4) | tax | annual | Jan 31 |
| W-2 filing | tax | annual | Jan 31 |
| 1099-NEC filing | tax | annual | Jan 31 |
| Annual in-kind review | tax | annual | Dec 31 |
| Budget draft (ED) | budget | annual | Oct 31 |
| Budget board circulation | budget | annual | Nov 30 |
| Budget board approval | budget | annual | Dec 31 |
| Quarterly board prep (Q1) | budget | annual | Mar 15 |
| Quarterly board prep (Q2) | budget | annual | Jun 15 |
| Quarterly board prep (Q3) | budget | annual | Sep 15 |
| Quarterly board prep (Q4) | budget | annual | Dec 15 |
| Officer compensation review | tax | annual | Annual meeting |
| Conflict of interest attestation | tax | annual | Annual meeting |
| Insurance renewal (Hiscox BOP) | tax | annual | Policy renewal date |
| Security deposit interest [per tenant] | tenant | per_tenant | Tenancy anniversary |

---

### Task 8: Compliance Reminder Cron Job (Postmark)

**What:** Daily cron that checks for upcoming deadlines and sends Postmark email reminders at 30 days and 7 days before due date.

**Files to create:**
- `src/lib/compliance/reminder-sender.ts` — check deadlines, send emails
  - `checkAndSendReminders()` — queries compliance_deadlines where due_date is within 30 or 7 days and reminder not yet sent
  - Sends via Postmark (same pattern as `ramp-sync-notification.ts`)
  - Updates `reminder_30d_sent` / `reminder_7d_sent` flags
- `src/app/api/cron/compliance-reminders/route.ts` — cron endpoint (daily, same pattern as ramp-sync)

**Files to modify:**
- `vercel.json` — add cron entry for `/api/cron/compliance-reminders` (daily: `0 6 * * *`)

---

### Task 9: Compliance Calendar Page (Report #23)

**What:** Full-page compliance calendar view filterable by category (tax/tenant/grant/budget). Shows upcoming, reminded, and completed deadlines.

**Files to create:**
- `src/app/(protected)/compliance/page.tsx` — server component, data fetch
- `src/app/(protected)/compliance/compliance-calendar-client.tsx` — client component with TanStack Table
- `src/app/(protected)/compliance/actions.ts` — server actions (complete deadline, add note)
- `src/app/(protected)/compliance/columns.tsx` — column definitions

**Features:**
- Filter by category (tax/tenant/grant/budget)
- Color-coded status: upcoming (blue), within 30 days (yellow), within 7 days (red), completed (green)
- "Mark Complete" action per deadline
- Notes field for tracking
- Sort by due date (default: nearest first)
- Dashboard widget showing next 30 days (for Phase 21 dashboard integration)

---

### Task 10: Security Deposit Register (Report #22)

**What:** Per-tenant breakdown showing deposit amount, date, escrow bank, interest rate, interest accrued/paid, tenancy anniversary, next interest due. Totals reconcile to GL liability (2060) + escrow bank balance (1020).

**Files to create:**
- `src/lib/reports/security-deposit-register.ts` — data query
  - Query: all tenants with deposits, joined with interest payment history
  - Calculate: interest accrued but not yet paid (prorated from last anniversary)
  - Include: GL balance of account 2060 (Security Deposits Held) and 1020 (Security Deposit Escrow) for reconciliation
- `src/app/(protected)/reports/security-deposit-register/page.tsx` — server component
- `src/app/(protected)/reports/security-deposit-register/register-client.tsx` — client component with TanStack Table

**Report columns:**
| Column | Source |
|--------|--------|
| Tenant Name | tenants.name |
| Unit | tenants.unitNumber |
| Deposit Amount | tenants.securityDepositAmount |
| Deposit Date | tenants.depositDate |
| Escrow Bank | tenants.escrowBankRef |
| Interest Rate | tenants.interestRate (capped display at 5%) |
| Interest Accrued | Calculated: deposit × rate × days since last payment |
| Interest Paid (YTD) | Sum of security_deposit_interest_payments for current year |
| Tenancy Anniversary | tenants.tenancyAnniversary |
| Next Interest Due | tenancyAnniversary (or 30 days after) |

**Footer reconciliation row:**
- Total Deposits Held = sum of all active tenant deposits → should match GL 2060 balance
- Total Escrow Balance = GL 1020 balance → should match if properly maintained
- Variance flag if totals don't reconcile

---

### Task 11: Rent Accrual Proration Refinements

**What:** Handle mid-month move-in rent proration per MA G.L. c. 186 § 4: daily rate = monthly rent ÷ actual calendar days in month × days occupied.

**Files to create:**
- `src/lib/security-deposits/proration.ts` — proration calculation
  - `calculateProratedRent(monthlyRent, moveInDate)` → prorated amount for partial first month
  - `calculateDailyRate(monthlyRent, yearMonth)` → monthlyRent ÷ calendar days in month
  - Pure functions, no side effects

**Note:** The rent accrual cron job doesn't exist yet (it's part of Phase 7 which may need to be verified). If Phase 7 didn't build the rent accrual cron, this task creates it:

**Files to create (if needed):**
- `src/app/api/cron/rent-accrual/route.ts` — monthly cron for rent accrual entries
  - For each active tenant: DR Accounts Receivable, CR Rental Income, coded to tenant's fund
  - For new tenants (moveInDate in current month): use prorated amount
  - `vercel.json` update for the cron schedule

---

### Task 12: Tenant Detail Page Enhancements

**What:** Enhance the tenant detail page to show security deposit lifecycle, receipt tracking, interest history, and compliance status.

**Files to modify:**
- `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx` — major enhancements:
  1. **Collect Deposit Dialog:** Button that opens a dialog to enter deposit amount, escrow bank ref. Calls `collectSecurityDeposit` action
  2. **Receipt Tracking Section:** Checklist showing the 3 required documents (collection receipt, 30-day bank receipt, statement of condition) with due dates and completion status
  3. **Interest History Section:** Table of past interest payments from `security_deposit_interest_payments`
  4. **Compliance Alerts:** Warning badges when receipts are overdue or interest anniversary approaching
  5. Replace "Rent & AR" placeholder card with actual rent history (or keep placeholder if Phase 7 not complete)

---

### Task 13: Move-Out Architecture Note

**What:** Document the deferred move-out workflow extension point (TXN-P0-051) — ensure schema supports future 30-day deadline tracking, itemized deduction recording, and refund calculation without schema changes.

**Files to create:**
- `src/lib/security-deposits/README.md` — architecture documentation

**Content:**
- Current: deposit collection, receipt tracking, annual interest, register
- Deferred: move-out deposit return workflow (P2, triggered when tenants occupy units)
- Extension points: `security_deposit_receipts` table supports `move_out_inspection` type, `compliance_deadlines` supports 30-day return deadline, `security_deposit_interest_payments` supports final prorated interest
- No schema changes needed for move-out — existing tables accommodate the workflow

---

### Task 14: Unit Tests

**Files to create:**
- `src/lib/security-deposits/interest.test.ts`
  - Interest calculation: $1,000 deposit × 3.5% × 365 days = $35.00
  - Interest calculation: $1,500 deposit × 6% (capped to 5%) × 365 days = $75.00
  - Partial year: $1,000 × 3.5% × 180/365 = $17.26
  - Zero deposit: returns $0
  - Zero rate: returns $0
  - Edge: leap year (366 days)
- `src/lib/security-deposits/proration.test.ts`
  - Full month (no proration): 30-day month, move-in day 1 = full rent
  - Move-in day 15 of 30-day month: 16/30 × monthly rent
  - Move-in day 15 of 31-day month: 17/31 × monthly rent
  - February (28 days): move-in day 20 = 9/28 × monthly rent
  - February leap year (29 days): move-in day 20 = 10/29 × monthly rent
- `src/lib/compliance/deadline-generator.test.ts`
  - Annual deadlines generate correct dates for fiscal year
  - Tenant deadlines generate from tenant data
  - Duplicate prevention (idempotent generation)

---

### Task 15: E2E Test

**Files to create:**
- `e2e/security-deposits.spec.ts`
  - Create tenant with all fields
  - Collect security deposit → verify GL entry created (DR 1020, CR 2060)
  - Verify receipt tracking dates appear on tenant detail
  - Verify compliance deadline created for interest anniversary
  - Navigate to compliance calendar → verify tenant deadline visible
  - Navigate to security deposit register → verify tenant row with correct data
  - (If cron testable) Trigger interest calculation → verify GL entry and register update

---

## Navigation & Routing

Add to app sidebar/nav:
- `/compliance` — Compliance Calendar (new top-level nav item under existing structure)
- `/reports/security-deposit-register` — linked from Reports page

---

## File Summary

### New Files (18)
| File | Purpose |
|------|---------|
| `src/lib/db/schema/security-deposit-interest.ts` | Interest payment tracking table |
| `src/lib/db/schema/compliance-deadlines.ts` | Compliance deadline tracking table |
| `src/lib/db/schema/security-deposit-receipts.ts` | Receipt tracking table |
| `src/lib/db/seed/compliance-deadlines.ts` | Initial deadline seeds |
| `src/lib/security-deposits/collect.ts` | Deposit collection logic |
| `src/lib/security-deposits/interest.ts` | Interest calculation + GL entry |
| `src/lib/security-deposits/proration.ts` | MA rent proration formula |
| `src/lib/security-deposits/README.md` | Architecture docs + move-out extension |
| `src/lib/compliance/deadline-generator.ts` | Deadline creation/refresh |
| `src/lib/compliance/reminder-sender.ts` | Postmark reminder logic |
| `src/app/api/cron/security-deposit-interest/route.ts` | Monthly interest cron |
| `src/app/api/cron/compliance-reminders/route.ts` | Daily reminder cron |
| `src/app/(protected)/compliance/page.tsx` | Compliance calendar server component |
| `src/app/(protected)/compliance/compliance-calendar-client.tsx` | Calendar client component |
| `src/app/(protected)/compliance/actions.ts` | Compliance server actions |
| `src/app/(protected)/compliance/columns.tsx` | TanStack Table columns |
| `src/app/(protected)/reports/security-deposit-register/page.tsx` | Register server component |
| `src/app/(protected)/reports/security-deposit-register/register-client.tsx` | Register client component |
| `src/lib/reports/security-deposit-register.ts` | Register data query |

### Modified Files (5)
| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add 3 compliance deadline enums |
| `src/lib/db/schema/index.ts` | Export new tables + relations |
| `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx` | Add deposit collection, receipt tracking, interest history |
| `src/app/(protected)/tenants/actions.ts` | Add collectSecurityDeposit action |
| `vercel.json` | Add 2 cron jobs |

### Test Files (4)
| File | Coverage |
|------|----------|
| `src/lib/security-deposits/interest.test.ts` | Interest calculation edge cases |
| `src/lib/security-deposits/proration.test.ts` | MA proration formula |
| `src/lib/compliance/deadline-generator.test.ts` | Deadline generation |
| `e2e/security-deposits.spec.ts` | Full workflow E2E |

---

## Execution Order

Tasks should be executed in this order (dependencies flow downward):

```
1. Schema: security-deposit-interest   ──┐
2. Schema: compliance-deadlines         ──┤
3. Schema: security-deposit-receipts    ──┤
                                          ├── 4. DB migration (drizzle-kit generate + push)
                                          │
5. Deposit collection logic ──────────────┤── depends on: schema + GL engine
6. Interest calculation engine ───────────┤── depends on: schema + GL engine
7. Proration formula ─────────────────────┤── pure functions, no deps
8. Compliance deadline generator ─────────┤── depends on: compliance schema
                                          │
9. Compliance reminder sender (Postmark) ─┤── depends on: deadline generator
10. Cron: security-deposit-interest ──────┤── depends on: interest engine
11. Cron: compliance-reminders ───────────┤── depends on: reminder sender
                                          │
12. Compliance Calendar page (Report #23) ┤── depends on: deadline schema + generator
13. Security Deposit Register (Report #22)┤── depends on: interest schema + query
14. Tenant detail enhancements ───────────┤── depends on: collection + receipts + interest
                                          │
15. Move-out architecture note ───────────┤── no code deps
16. Unit tests ───────────────────────────┤── depends on: calculation functions
17. E2E test ─────────────────────────────┘── depends on: all above
```

---

## Acceptance Criteria

- [ ] **TXN-P0-049:** Deposit collection creates GL entry DR 1020, CR 2060. Max deposit = first month's rent enforced
- [ ] **TXN-P0-050:** System tracks collection receipt date, 30-day bank receipt date, statement of condition date. Status visible on tenant detail
- [ ] **TXN-P0-041:** Annual interest calculated as deposit × min(rate, 5%) × days/365. GL: DR Interest Expense, CR Cash. Per-tenant on tenancy anniversary
- [ ] **DM-P0-013:** All security deposit fields tracked per tenant (amount, date, escrow bank, rate, interest history, anniversary, statement of condition)
- [ ] **SYS-P0-007:** Compliance calendar tracks all deadline categories (tax, tenant, grant, budget)
- [ ] **SYS-P0-008:** Postmark reminders sent at 30 days and 7 days before each deadline
- [ ] **SYS-P0-009:** All annual compliance items seeded (990, Form PC, 941s, W-2, 1099, budget cycle, insurance, annual reviews, per-tenant anniversaries)
- [ ] **Report #22:** Security Deposit Register shows per-tenant breakdown reconciling to GL 2060 + 1020
- [ ] **Report #23:** Compliance Calendar page with category filter, status colors, mark-complete action
- [ ] **TXN-P0-007:** Rent proration formula per MA G.L. c. 186 § 4 implemented (daily rate = rent ÷ calendar days × days occupied)
- [ ] **INV-012:** All mutations (deposit collection, interest posting, deadline completion) logged to audit trail
- [ ] Unit tests pass for interest calculation (various rates, partial years, cap at 5%, leap year)
- [ ] Unit tests pass for proration formula (various month lengths, move-in dates)
- [ ] E2E test passes: full deposit lifecycle from collection through interest calculation and register verification
