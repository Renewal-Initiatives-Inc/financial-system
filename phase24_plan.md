# Phase 24: Year-End Close Wizard

## Overview

Builds the full year-end closing workflow: account renames, period lock schema, soft lock enforcement, a multi-step Close the Books wizard, and a mandatory reports audit pass. Goal: close 2025 books once shipped.

This phase is split into four sub-phases executed sequentially:

| Sub-phase | Scope | Boundary |
|-----------|-------|----------|
| **24A** | Foundation — schema, enum, account rename, migration | DB layer only |
| **24B** | Soft lock enforcement — write-path warnings, reopen UI | GL engine + server actions |
| **24C** | Close the Books wizard — pre-close checklist, per-fund JEs, lock | New feature UI + actions |
| **24D** | Reports audit — every report scrubbed for post-close correctness | Reports library + clients |

---

## Dependencies

- [ ] Migration 0025 (`prepaid_cancelled_at`) applied to dev, staging, and prod DBs
- [ ] All 2025 transactions posted before running the wizard (user confirms prior to executing 24C)
- [ ] `src/lib/gl/engine.ts` in stable state (no in-flight changes)

---

---

# Sub-Phase 24A: Foundation

## Summary

| # | Task | Notes |
|---|------|-------|
| 1 | Rename accounts 3000 and 3100 | DB migration + seed update |
| 2 | Add `YEAR_END_CLOSE` to `sourceTypeEnum` | DB migration + schema file |
| 3 | Create `fiscal_year_locks` schema + migration | New table |
| 4 | Export new schema table from index | Wire into Drizzle |

---

## Tasks

### Task 1: Rename NET_ASSET Accounts 3000 and 3100

**What:** Rename both existing NET_ASSET accounts to use "Retained Earnings" terminology, matching the owner's preferred language. No new accounts created — fund identity is preserved via `fundId` on transaction lines.

**Files:**
- Modify: `src/lib/db/seed/accounts.ts` — change `name` values for codes `3000` and `3100`
  - `3000`: `'Net Assets Without Donor Restrictions'` → `'Retained Earnings, Without Donor Restrictions'`
  - `3100`: `'Net Assets With Donor Restrictions'` → `'Retained Earnings, With Donor Restrictions'`
- Create: `src/lib/db/migrations/0026_rename_retained_earnings.sql`
  ```sql
  UPDATE accounts SET name = 'Retained Earnings, Without Donor Restrictions'
    WHERE code = '3000';
  UPDATE accounts SET name = 'Retained Earnings, With Donor Restrictions'
    WHERE code = '3100';
  ```

**AC:**
- [ ] Account code `3000` has name `'Retained Earnings, Without Donor Restrictions'` in all three environments after migration
- [ ] Account code `3100` has name `'Retained Earnings, With Donor Restrictions'` in all three environments after migration
- [ ] Seed file matches — re-seeding a fresh DB produces the new names
- [ ] `isSystemLocked: true` and `normalBalance: 'CREDIT'` are unchanged on both accounts
- [ ] `id`, `code`, `type`, `subType`, and `normalBalance` columns are unchanged — only `name` is modified
- [ ] All existing `transaction_lines` rows with `account_id` pointing to the 3000 or 3100 accounts are fully intact after migration (FK references preserved — verify with `SELECT COUNT(*) FROM transaction_lines WHERE account_id IN (SELECT id FROM accounts WHERE code IN ('3000','3100'))` before and after)
- [ ] Balance sheet, statement of activities, and fund level reports render the new names without layout breakage

---

### Task 2: Add `YEAR_END_CLOSE` to `sourceTypeEnum`

**What:** Extend the `source_type` Postgres enum with the new value that closing entries will use. Closing entries must be distinguishable from MANUAL and SYSTEM entries for reporting exclusion logic.

**Files:**
- Modify: `src/lib/db/schema/enums.ts` — add `'YEAR_END_CLOSE'` to `sourceTypeEnum` array
- Create: `src/lib/db/migrations/0027_source_type_year_end_close.sql`
  ```sql
  ALTER TYPE source_type ADD VALUE 'YEAR_END_CLOSE';
  ```

**AC:**
- [ ] `sourceTypeEnum` TypeScript type includes `'YEAR_END_CLOSE'` as a valid value
- [ ] Postgres enum `source_type` includes `YEAR_END_CLOSE` after migration (verify with `\dT+ source_type`)
- [ ] Existing transactions with other source types are unaffected
- [ ] The `sourceReferenceId` pattern for closing entries will be `'year-end-close:{fiscalYear}:{fundId}'` (document in a code comment; not enforced by this task)

---

### Task 3: Create `fiscal_year_locks` Table Schema

**What:** Define the new table that tracks which fiscal years are locked or reopened, with full audit trail. This is the persistence layer for the soft lock.

**Files:**
- Create: `src/lib/db/schema/fiscal-year-locks.ts`
  ```typescript
  // fiscal_year integer — the 4-digit calendar year (e.g., 2025)
  // status — 'LOCKED' or 'REOPENED'
  // locked_at, locked_by — set when status becomes LOCKED
  // reopened_at, reopened_by, reopen_reason — set when status becomes REOPENED (reason required)
  // created_at — immutable row creation timestamp
  ```
  Schema columns:
  - `id` serial primaryKey
  - `fiscalYear` integer notNull unique
  - `status` varchar(20) notNull — values: `'LOCKED'` | `'REOPENED'`
  - `lockedAt` timestamp notNull defaultNow
  - `lockedBy` varchar(255) notNull
  - `reopenedAt` timestamp (nullable)
  - `reopenedBy` varchar(255) (nullable)
  - `reopenReason` text (nullable — required when status = REOPENED, enforced at application layer)
  - `createdAt` timestamp notNull defaultNow
- Modify: `src/lib/db/schema/index.ts` — export `fiscalYearLocks` from the new file
- Create: `src/lib/db/migrations/0028_fiscal_year_locks.sql`
  ```sql
  CREATE TABLE fiscal_year_locks (
    id serial PRIMARY KEY,
    fiscal_year integer NOT NULL UNIQUE,
    status varchar(20) NOT NULL,
    locked_at timestamp NOT NULL DEFAULT now(),
    locked_by varchar(255) NOT NULL,
    reopened_at timestamp,
    reopened_by varchar(255),
    reopen_reason text,
    created_at timestamp NOT NULL DEFAULT now()
  );
  ```

**AC:**
- [ ] `fiscal_year_locks` table exists in DB after migration
- [ ] `fiscal_year` column has a UNIQUE constraint (one lock record per year)
- [ ] Table is exported from `src/lib/db/schema/index.ts` and usable via Drizzle queries
- [ ] TypeScript types (`$inferSelect`, `$inferInsert`) are valid and usable
- [ ] No FK constraints needed — this table is standalone

### Task 4: Run and Verify Migrations

**What:** Generate Drizzle migration artifacts and apply all three new migrations to dev DB. Verify schema is consistent.

**Files:**
- Run: `npx drizzle-kit generate` to produce migration SQL files
- Run: `npx drizzle-kit migrate` against dev DB
- Verify migration output matches hand-written SQL above

**AC:**
- [ ] All three migrations (0026, 0027, 0028) applied successfully to dev DB with no errors
- [ ] `npx drizzle-kit check` shows no schema drift
- [ ] `\d fiscal_year_locks` in psql shows expected columns and constraints
- [ ] TypeScript compilation passes with no errors after schema changes

---

## Tests (24A)

| Test | File | Verifies |
|------|------|---------|
| Account rename persists | `src/lib/db/seed/seed.test.ts` | codes 3000/3100 have new names after seed |
| sourceTypeEnum includes YEAR_END_CLOSE | `src/lib/db/schema/schema.test.ts` | enum value present |
| fiscal_year_locks table exists | `src/lib/db/schema/schema.test.ts` | table queryable, UNIQUE on fiscal_year |

---

---

# Sub-Phase 24B: Soft Lock Enforcement

## Summary

| # | Task | Notes |
|---|------|-------|
| 1 | Create `fiscal-year-lock` query helper | Reusable lock check + write functions |
| 2 | Add soft lock warning to GL engine `createTransaction` | Write-path gate with warning payload |
| 3 | Add soft lock warning to transaction edit and void actions | All mutation paths covered |
| 4 | Create period reopen UI | Settings page or modal, requires reason memo |
| 5 | Add locked-period banner component | Visible in transaction entry form |

---

## Tasks

### Task 1: Create `src/lib/fiscal-year-lock.ts`

**What:** Centralized query helpers for all period lock operations. All other code calls these — no raw DB queries for lock state elsewhere.

**Files:**
- Create: `src/lib/fiscal-year-lock.ts`

  Exports:
  - `getLockedYears(): Promise<number[]>` — returns array of locked fiscal years
  - `isYearLocked(year: number): Promise<boolean>` — true if a LOCKED record exists for year (note: REOPENED status means it's currently open)
  - `lockYear(year: number, lockedBy: string): Promise<void>` — inserts or updates record to LOCKED status
  - `reopenYear(year: number, reopenedBy: string, reason: string): Promise<void>` — updates record to REOPENED, sets reopened_at, reopened_by, reopen_reason; throws if reason is empty
  - `getFiscalYearFromDate(date: string): number` — parses YYYY-MM-DD, returns the year as integer

**AC:**
- [ ] `isYearLocked` returns `false` for years with no record (no lock = open)
- [ ] `isYearLocked` returns `false` for years with status = `'REOPENED'` (reopened = currently open)
- [ ] `isYearLocked` returns `true` only for years with status = `'LOCKED'`
- [ ] `reopenYear` throws a descriptive error if `reason` is blank or whitespace-only
- [ ] `lockYear` is idempotent — calling twice for the same year updates, doesn't create duplicate rows

---

### Task 2: Add Soft Lock Warning to GL Engine `createTransaction`

**What:** Before posting any transaction, check if the transaction date falls in a locked fiscal year. If so, surface a warning payload rather than a hard rejection. The calling action decides how to present it to the user.

**Files:**
- Modify: `src/lib/gl/engine.ts`
  - Add `lockedYearWarning?: { year: number; message: string }` to `TransactionResult` type
  - At Step 1 of `createTransaction`, call `isYearLocked(getFiscalYearFromDate(input.date))`
  - If locked: include `lockedYearWarning` in result but still proceed with transaction creation (soft lock, not hard rejection)
  - Warning message text: `"This transaction is dated in fiscal year {YEAR}, which has been closed. Posting to a closed period may affect your Balance Sheet, Statement of Activities, donor reports, and grant reports. Confirm to proceed."`
- Modify: `src/lib/gl/types.ts` — add `lockedYearWarning` field to `TransactionResult`

**AC:**
- [ ] Posting a transaction dated in a locked year returns a result with `lockedYearWarning` populated
- [ ] The warning message is specific — it names the year and the downstream reports affected
- [ ] Posting a transaction dated in an open year returns a result with `lockedYearWarning: undefined`
- [ ] The transaction IS posted even when the warning fires (soft lock behavior)
- [ ] YEAR_END_CLOSE source type transactions skip the lock check (closing entries themselves must be able to post to the year being closed)
- [ ] Existing invariants (INV-001 through INV-015) are unaffected

---

### Task 3: Surface Lock Warning in Transaction Entry UI

**What:** The journal entry form must display the soft lock warning returned from `createTransaction` before the user sees a success state. The user must see the warning; they've already confirmed by submitting.

**Files:**
- Modify: `src/app/(protected)/transactions/new/journal-entry-form.tsx` (or wherever the form submit action is called) — after a successful post, if `result.lockedYearWarning` is present, show a toast or inline alert with the warning message alongside the success confirmation
- Modify: `src/app/(protected)/transactions/actions.ts` (or relevant server action) — pass the `lockedYearWarning` through the server action return value to the client

**AC:**
- [ ] When posting to a locked year, the user sees both a success confirmation AND the warning text
- [ ] The warning names the year and affected reports
- [ ] No warning is shown for transactions in open years
- [ ] Warning is non-blocking — the form does not require an extra confirmation click (transaction already posted)

---

### Task 4: Add Soft Lock Check to Transaction Edit and Void Actions

**What:** Editing or voiding a transaction that falls in a locked year should also surface the soft lock warning. These are separate code paths from `createTransaction`.

**Files:**
- Modify: `src/lib/gl/engine.ts` — add lock check to `editTransaction` and `voidTransaction` (or wherever these are implemented)
- Return `lockedYearWarning` in the result for these operations too
- Modify the corresponding server actions to pass the warning to the client

**AC:**
- [ ] Editing a transaction dated in a locked year surfaces the warning in the UI
- [ ] Voiding a transaction dated in a locked year surfaces the warning in the UI
- [ ] Edits and voids in locked years still complete (soft lock)
- [ ] Audit log entry is written for all operations regardless of lock status

---

### Task 5: Create Period Reopen UI

**What:** A UI surface where a user can reopen a previously locked fiscal year, providing a mandatory reason. This would logically live in Settings or as a modal accessible from a "Fiscal Year Status" section.

**Files:**
- Create: `src/app/(protected)/settings/fiscal-years/page.tsx` — server component, loads all `fiscal_year_locks` records
- Create: `src/app/(protected)/settings/fiscal-years/fiscal-years-client.tsx` — displays a table of locked years with a "Reopen" button per row; Reopen triggers a modal requiring a reason memo (non-blank enforced client-side and server-side)
- Create: `src/app/(protected)/settings/fiscal-years/actions.ts` — server action `reopenFiscalYear(year, reason)` that calls `reopenYear()` from the lock helper and writes an audit log entry
- Modify: `src/app/(protected)/settings/` navigation or layout — add "Fiscal Years" link

**AC:**
- [ ] Settings > Fiscal Years page lists all locked years with their lock date and locked-by user
- [ ] Reopened years show their reopen date, reopened-by user, and reason
- [ ] Clicking "Reopen" opens a dialog with a required reason text field
- [ ] Submitting with an empty reason shows a validation error; does not call the server action
- [ ] After reopen, the year's status shows as "Reopened" in the table
- [ ] An audit log entry is written for every reopen action (action: `'updated'`, entity: `fiscal_year_locks`)
- [ ] A year that was reopened and then re-closed (via another close operation) shows the most recent status

---

## Tests (24B)

| Test | File | Verifies |
|------|------|---------|
| `isYearLocked` returns false for open years | `src/lib/fiscal-year-lock.test.ts` | no record = open |
| `isYearLocked` returns true for LOCKED status | `src/lib/fiscal-year-lock.test.ts` | LOCKED = locked |
| `isYearLocked` returns false for REOPENED status | `src/lib/fiscal-year-lock.test.ts` | REOPENED = open |
| `reopenYear` throws on blank reason | `src/lib/fiscal-year-lock.test.ts` | server-side validation |
| `createTransaction` with locked year returns warning | `src/lib/gl/engine.test.ts` | warning payload populated |
| `createTransaction` YEAR_END_CLOSE skips lock check | `src/lib/gl/engine.test.ts` | closing entries exempt |
| Transaction still posts despite lock warning | `src/lib/gl/engine.test.ts` | soft lock behavior |

---

---

# Sub-Phase 24C: Close the Books Wizard

## Summary

| # | Task | Notes |
|---|------|-------|
| 1 | Pre-close checklist server action | Queries each hard-blocker condition |
| 2 | Closing entries computation logic | Per-fund revenue/expense aggregation |
| 3 | `postYearEndClose` server action | Posts JEs per fund + locks year atomically |
| 4 | Wizard UI: 4-step multi-step component | Checklist → Preview → Confirm → Success |
| 5 | Add "Close the Books" button to accounts page | Trigger point per spec |

---

## Tasks

### Task 1: Pre-Close Checklist Server Action

**What:** A server action that runs all hard-blocker checks for the given fiscal year and returns a pass/fail status per item. Wizard Step 1 calls this and won't allow proceeding until all items pass.

**Files:**
- Create: `src/app/(protected)/accounts/close-books/actions.ts`

  Export: `runPreCloseChecklist(fiscalYear: number): Promise<ChecklistResult>`

  ```typescript
  interface ChecklistItem {
    id: string
    label: string
    passed: boolean
    detail?: string  // human-readable explanation if failed
  }
  interface ChecklistResult {
    allPassed: boolean
    items: ChecklistItem[]
  }
  ```

  Checklist items (all must pass = `true` to proceed):

  1. **`bank_recs_complete`** — All bank accounts have a completed reconciliation session with `endDate >= '{fiscalYear}-12-31'`. Query `reconciliation_sessions` where `status = 'completed'` and `end_date >= lastDayOfYear`. One per active bank account required.

  2. **`no_unmatched_bank_transactions`** — No unmatched bank transactions dated in the fiscal year. Query `bank_transactions` where `year(date) = fiscalYear` and no corresponding `bank_matches` row exists and `status = 'posted'`.

  3. **`payroll_december_posted`** — At least one payroll transaction posted with a date in December of the fiscal year. Query `transactions` where `source_type IN ('TIMESHEET', 'SYSTEM')` and `date >= '{fiscalYear}-12-01'` and `date <= '{fiscalYear}-12-31'` and `is_voided = false`. (Heuristic check — not blocking if org had no December payroll, so detail explains the assumption.)

  4. **`depreciation_december_posted`** — Depreciation expense transaction posted for December. Query `transactions` where `source_type = 'SYSTEM'` and `date >= '{fiscalYear}-12-01'` and `date <= '{fiscalYear}-12-31'` and a transaction line debits account `5200` (Depreciation Expense).

  5. **`functional_allocation_complete`** — A `functional_allocations` record exists for the fiscal year. Query `functional_allocations` where `fiscal_year = fiscalYear`.

  6. **`year_not_already_closed`** — No existing `LOCKED` record for this fiscal year in `fiscal_year_locks`. Prevents double-close.

**AC:**
- [ ] All 6 checklist items are evaluated and returned
- [ ] `allPassed` is `true` only when every item's `passed` is `true`
- [ ] Each failed item includes a human-readable `detail` string explaining what's missing
- [ ] A year that's already locked returns `year_not_already_closed` as failed with appropriate detail
- [ ] Server action is callable from the wizard client component

---

### Task 2: Closing Entries Computation Logic

**What:** A pure function (no DB writes) that computes the closing journal entries for a given fiscal year. Returns a preview structure the wizard shows before the user confirms. Separated from posting so the wizard can display before committing.

**Files:**
- Create: `src/lib/year-end-close/compute-closing-entries.ts`

  Export: `computeClosingEntries(fiscalYear: number): Promise<ClosingEntriesPreview>`

  ```typescript
  interface FundClosingEntry {
    fundId: number
    fundName: string
    restrictionType: 'RESTRICTED' | 'UNRESTRICTED'
    revenueLines: { accountId: number; accountCode: string; accountName: string; amount: number }[]
    expenseLines: { accountId: number; accountCode: string; accountName: string; amount: number }[]
    netToRetainedEarnings: number  // positive = increase RE, negative = decrease RE
    retainedEarningsAccountId: number  // 3000 or 3100 depending on restrictionType
    retainedEarningsAccountCode: string
  }
  interface ClosingEntriesPreview {
    fiscalYear: number
    funds: FundClosingEntry[]
    totalNetChange: number
  }
  ```

  Logic per fund:
  - Query all active funds with revenue or expense activity in `[fiscalYear-01-01, fiscalYear-12-31]` (excluding already-voided and YEAR_END_CLOSE source entries)
  - For each fund: sum each REVENUE account balance (credit − debit for the period = positive revenue)
  - For each fund: sum each EXPENSE account balance (debit − credit for the period = positive expense)
  - `netToRetainedEarnings = totalRevenue − totalExpense`
  - `retainedEarningsAccountId`: account 3000 if fund is UNRESTRICTED, account 3100 if RESTRICTED

**AC:**
- [ ] Returns one `FundClosingEntry` per fund that has non-zero revenue or expense in the year
- [ ] Funds with zero activity in the year are omitted
- [ ] `netToRetainedEarnings` is positive for profitable funds, negative for funds that ran a deficit
- [ ] Revenue line amounts match what would appear in the Statement of Activities for the same period
- [ ] YEAR_END_CLOSE transactions are excluded from the computation (idempotency: can compute multiple times safely)
- [ ] Accounts 3000 and 3100 are correctly assigned based on `fund.restrictionType`

---

### Task 3: `postYearEndClose` Server Action

**What:** The write action that takes the computed closing entries and posts them to the GL, then locks the year. All fund JEs and the lock must succeed atomically — if any JE fails, nothing is committed and the year stays open.

**Files:**
- Modify: `src/app/(protected)/accounts/close-books/actions.ts` — add `postYearEndClose(fiscalYear: number, userId: string): Promise<{ success: boolean; transactionIds: number[]; error?: string }>`

  Logic:
  1. Re-run `computeClosingEntries(fiscalYear)` inside the action (don't trust client-side preview data)
  2. Wrap entire operation in `db.transaction()`
  3. For each fund's closing entry: call the GL engine's underlying insert (bypassing the standard `createTransaction` lock check — closing entries are exempt) with:
     - `date`: `'{fiscalYear}-12-31'`
     - `sourceType`: `'YEAR_END_CLOSE'`
     - `isSystemGenerated`: `true`
     - `sourceReferenceId`: `'year-end-close:{fiscalYear}:{fundId}'`
     - `memo`: `'Year-end closing entry — {fiscalYear} — {fundName}'`
     - Lines: DR each revenue account (amount = balance), CR each expense account (amount = balance), DR or CR retained earnings account for the net
  4. Call `lockYear(fiscalYear, userId)` inside the same transaction
  5. Write a single audit log entry summarizing the close: action `'posted'`, entity `fiscal_year_locks`, noting number of funds closed and transaction IDs
  6. Return all posted transaction IDs

**AC:**
- [ ] Each fund produces exactly one balanced journal entry (sum debits = sum credits per JE)
- [ ] All revenue accounts for the fund are debited (zeroed) — the DR amount equals the credit balance for the period
- [ ] All expense accounts for the fund are credited (zeroed) — the CR amount equals the debit balance for the period
- [ ] The net difference is posted to account 3000 (UNRESTRICTED funds) or 3100 (RESTRICTED funds)
- [ ] `fundId` is tagged on every transaction line
- [ ] `sourceType = 'YEAR_END_CLOSE'` on all closing transactions
- [ ] If any single JE fails DB validation, the entire operation rolls back (no partial close)
- [ ] After success, `isYearLocked(fiscalYear)` returns `true`
- [ ] Calling `postYearEndClose` a second time for the same year is blocked by the `year_not_already_closed` checklist item (not a raw error)
- [ ] Revenue and expense account balances for the closed year sum to zero after closing entries post

---

### Task 4: Wizard UI (Multi-Step)

**What:** A multi-step dialog/sheet that guides the user through the full close process. 4 steps: Checklist, Preview, Confirm, Success.

**Files:**
- Create: `src/app/(protected)/accounts/close-books/close-books-wizard.tsx` — client component

  Step 1 — **Pre-Close Checklist:**
  - Calls `runPreCloseChecklist(year)` on mount
  - Shows each checklist item with green checkmark or red X
  - Each failed item shows its `detail` explanation
  - "Continue" button disabled until `allPassed = true`
  - Shows fiscal year selector (default: previous calendar year relative to today)

  Step 2 — **Trial Balance Preview:**
  - Shows a table: Fund | Revenue | Expenses | Net Change | Retained Earnings Account
  - One row per fund in the `ClosingEntriesPreview`
  - Total row at bottom
  - "Back" and "Review Closing Entries" buttons

  Step 3 — **Closing Entries Confirm:**
  - Shows the exact journal entries that will be posted, per fund
  - Each entry shows: date (Dec 31), memo, debit/credit lines
  - Warning banner: "This action will post closing entries and lock fiscal year {YEAR}. This cannot be automatically undone. To post audit adjustments after closing, use Settings > Fiscal Years to reopen the period."
  - "Back" and "Close the Books" (destructive) buttons

  Step 4 — **Success:**
  - Confirms: "{N} closing entries posted. Fiscal year {YEAR} is now locked."
  - Lists each fund closed with its net change
  - "Done" button closes the wizard

**AC:**
- [ ] Wizard is a shadcn/ui Dialog or Sheet component
- [ ] Step 1 hard-blocks on any failed checklist item — "Continue" is disabled with tooltip explaining what's blocking
- [ ] Step 2 correctly reflects the computed entries (calls `computeClosingEntries`, not local state)
- [ ] Step 3 warning banner is prominent and uses destructive/warning styling
- [ ] "Close the Books" button in Step 3 calls `postYearEndClose` and advances to Step 4 on success
- [ ] Errors from `postYearEndClose` are caught and displayed as an inline error (not a silent failure)
- [ ] Step 4 shows a complete summary of what was posted
- [ ] Wizard can be dismissed at any step before Step 4 without any DB writes occurring

---

### Task 5: Add "Close the Books" Button to Chart of Accounts Page

**What:** Add the trigger button to the accounts page header, next to the existing "Make a Journal Entry" and "+ Create Account" buttons.

**Files:**
- Modify: `src/app/(protected)/accounts/accounts-client.tsx`
  - Import `CloseBooksWizard` component
  - Add state: `const [closeWizardOpen, setCloseWizardOpen] = useState(false)`
  - Add button in the header `flex items-center gap-2` div, between the Journal Entry button and Create Account button:
    ```tsx
    <Button variant="outline" onClick={() => setCloseWizardOpen(true)} data-testid="close-books-btn">
      <Lock className="h-4 w-4 mr-2" />
      Close the Books
    </Button>
    <CloseBooksWizard open={closeWizardOpen} onClose={() => setCloseWizardOpen(false)} />
    ```

**AC:**
- [ ] "Close the Books" button appears in the Chart of Accounts header
- [ ] Button is positioned between "Make a Journal Entry" and "+ Create Account"
- [ ] Clicking opens the wizard dialog
- [ ] Button has `data-testid="close-books-btn"`
- [ ] `Lock` icon from `lucide-react` used (already a dependency)

---

## Tests (24C)

| Test | File | Verifies |
|------|------|---------|
| Checklist passes when all conditions met | `src/lib/year-end-close/checklist.test.ts` | all items green |
| Checklist fails on missing bank rec | `src/lib/year-end-close/checklist.test.ts` | bank_recs_complete = false |
| Checklist fails if year already closed | `src/lib/year-end-close/checklist.test.ts` | year_not_already_closed = false |
| `computeClosingEntries` returns balanced entries | `src/lib/year-end-close/compute-closing-entries.test.ts` | debits = credits per fund |
| `computeClosingEntries` routes to correct RE account | `src/lib/year-end-close/compute-closing-entries.test.ts` | 3000 for unrestricted, 3100 for restricted |
| `computeClosingEntries` excludes YEAR_END_CLOSE entries | `src/lib/year-end-close/compute-closing-entries.test.ts` | idempotent recompute |
| `postYearEndClose` locks year after success | `src/lib/year-end-close/post-year-end-close.test.ts` | isYearLocked = true |
| `postYearEndClose` rolls back on failure | `src/lib/year-end-close/post-year-end-close.test.ts` | partial failure = no commit |
| Revenue accounts zeroed after close | `src/lib/year-end-close/post-year-end-close.test.ts` | net balance = 0 for closed year |

---

---

# Sub-Phase 24D: Reports Audit

## Summary

Every existing report is audited for correctness after closing entries exist. The root issue is that several reports use `lte(transactions.date, endDate)` with no start date on REVENUE/EXPENSE accounts, causing inception-to-date accumulation instead of period-specific figures. After closing entries are posted, reports must also correctly exclude or include `YEAR_END_CLOSE` transactions.

| # | Report | Issue | Fix Required |
|---|--------|-------|--------------|
| 1 | Balance Sheet | Revenue/expense rolled from inception — no startDate filter | Add fiscal year startDate filter to rev/exp roll-up |
| 2 | Statement of Activities | Verify YEAR_END_CLOSE entries excluded from revenue/expense totals | Add sourceType exclusion |
| 3 | Statement of Cash Flows | "Change in Net Assets" line must exclude YEAR_END_CLOSE entries | Add sourceType exclusion |
| 4 | Fund Level Report | Per-fund revenue/expense — same inception-to-date risk | Audit and fix |
| 5 | Late Entries Report | Period-close date logic may need updating for real lock dates | Audit and align with fiscal_year_locks |
| 6 | All other reports | Date range assumptions, calculation approaches | Audit each; fix if needed |

---

## Tasks

### Task 1: Fix Balance Sheet Revenue/Expense Roll-Up

**What:** The balance sheet currently rolls ALL revenue/expense from inception into "Change in Net Assets." After closing entries post, income/expense accounts are zeroed for closed years, so this bug corrects itself for closed years — but the report must still use a proper start date for the current open year (to avoid double-counting if someone runs the report mid-year after a prior-year close).

**Files:**
- Modify: `src/lib/reports/balance-sheet.ts`
  - The `revenueExpenseConditions` array (line ~178) currently only uses `lte(transactions.date, endDate)`
  - Add: derive `startDate` as Jan 1 of the year containing `endDate` (e.g., if endDate = '2026-09-30', startDate = '2026-01-01')
  - Also add: `neq(transactions.sourceType, 'YEAR_END_CLOSE')` — exclude closing entries from the dynamic roll-up (they're already captured in the retained earnings account balance)
  - The NET_ASSET account balance query (which runs `lte` with no start date) is CORRECT — it should show all-time balance including prior-year retained earnings. Only the revenue/expense roll-up needs the start date.

**AC:**
- [ ] Balance sheet run for `endDate = '2025-12-31'` after 2025 close shows `Change in Net Assets = 0` (because income/expense zeroed by closing entries)
- [ ] Balance sheet run for `endDate = '2026-06-30'` shows only 2026 revenue/expense in the "Change in Net Assets" line, not 2025 history
- [ ] Retained earnings accounts (3000, 3100) show their correct cumulative balances (prior years + current year RE)
- [ ] TOTAL LIABILITIES AND NET ASSETS still balances (= TOTAL ASSETS)
- [ ] The fix does not change behavior for users who have never posted closing entries (pre-close, inception-to-date still shows correctly)

---

### Task 2: Audit Statement of Activities for YEAR_END_CLOSE Exclusion

**What:** The Statement of Activities shows revenue, expenses, and "Net Assets Released from Restrictions." Closing entries should NOT appear as revenue or expense line items — they are balance sheet reclassifications, not income statement events.

**Files:**
- Modify: `src/lib/reports/activities.ts`
  - Audit the revenue query, expense query, and net asset release query
  - Anywhere `sourceType` is not already filtered, add exclusion: `neq(transactions.sourceType, 'YEAR_END_CLOSE')`
  - YEAR_END_CLOSE entries debit revenue and credit expense accounts — without exclusion, they'd show as negative revenue and negative expenses, distorting the P&L

**AC:**
- [ ] Running Statement of Activities for full year 2025 after close shows same figures as before close (closing entries have zero P&L impact on the report)
- [ ] No negative revenue or negative expense lines appear due to closing entries
- [ ] "Net Assets Released from Restrictions" line is unaffected (already uses `isSystemGenerated` memo filter, which naturally excludes YEAR_END_CLOSE entries since those have different memos)
- [ ] "Change in Net Assets" at bottom of activities report matches the net posted to retained earnings accounts for the period

---

### Task 3: Audit Statement of Cash Flows for YEAR_END_CLOSE Exclusion

**What:** The Cash Flows report uses `getChangeInNetAssets()` to compute the first line of operating activities. This function queries REVENUE and EXPENSE accounts for the period — closing entries will distort this if not excluded.

**Files:**
- Modify: `src/lib/reports/cash-flows.ts`
  - In `getChangeInNetAssets()` function (line ~158): add `neq(transactions.sourceType, 'YEAR_END_CLOSE')` to the conditions
  - Verify no other functions in this file query REVENUE/EXPENSE without this filter

**AC:**
- [ ] "Change in Net Assets" on Cash Flows matches "Change in Net Assets" on Statement of Activities for the same period
- [ ] Cash Flows report for 2025 (post-close) shows the same operating figure as before close
- [ ] Beginning Cash + Net Change in Cash = Ending Cash still reconciles correctly

---

### Task 4: Audit Fund Level Report

**What:** The Fund Level report shows revenue, expense, and net change per fund. Same YEAR_END_CLOSE exclusion risk as Activities.

**Files:**
- Read: `src/lib/reports/fund-level.ts`
- Audit all revenue and expense queries
- Add `neq(transactions.sourceType, 'YEAR_END_CLOSE')` wherever revenue/expense accounts are queried without it

**AC:**
- [ ] Fund Level report for each fund shows zero change after close (closing entries zeroed revenue/expense)
- [ ] Fund Level report for an open period (e.g., 2026 YTD) is unaffected
- [ ] No negative revenue/expense lines from closing entries

---

### Task 5: Audit Late Entries Report

**What:** The Late Entries report identifies transactions entered after a period's theoretical close date. With real lock dates now in `fiscal_year_locks`, the report should optionally use actual lock dates rather than heuristic close dates.

**Files:**
- Read: `src/lib/reports/late-entries.ts`
- Audit the "period close date" heuristic used
- If the report uses a hardcoded or estimated close date, update it to query `fiscal_year_locks` for the actual lock date when available

**AC:**
- [ ] Late Entries report for 2025 uses the actual lock date from `fiscal_year_locks` as the close date (if 2025 is locked)
- [ ] For years without a lock record, the report falls back to its existing heuristic behavior
- [ ] YEAR_END_CLOSE transactions are excluded from the late entries list (they are expected post-close activity, not late entries)

---

### Task 6: Audit All Remaining Reports

**What:** Systematic audit of every remaining report for (a) inception-to-date assumptions on revenue/expense queries, (b) missing YEAR_END_CLOSE exclusions, and (c) GAAP compliance with closed periods. Fix any issues found.

**Reports to audit:**
- AR Aging — balance sheet position, not revenue; likely fine
- AP Aging / Outstanding Payables — same
- Rent Collection — revenue-based; check sourceType filter
- Donor Giving History — revenue-based; check sourceType filter
- Grant Compliance / Fund Drawdown — revenue-based; check sourceType filter
- Board Pack — composite; audit sub-sections
- Form 990 Data — revenue-based; must exclude YEAR_END_CLOSE
- Functional Expenses — expense-based; must exclude YEAR_END_CLOSE
- Payroll Register — system-generated TIMESHEET entries; no YEAR_END_CLOSE risk
- All other reports — audit for date range issues

**Files:**
- Read + modify each report file in `src/lib/reports/` as needed
- Document any report that required no changes with a code comment: `// Audited for YEAR_END_CLOSE compatibility: no changes needed`

**AC:**
- [ ] Every report file has been read and audited
- [ ] Any report querying REVENUE or EXPENSE account types excludes `YEAR_END_CLOSE` source type
- [ ] Any report with an inception-to-date balance for revenue/expense either (a) has a correct start date or (b) has a code comment explaining why inception-to-date is intentional
- [ ] Form 990 Data report excludes YEAR_END_CLOSE entries from all revenue lines
- [ ] No report shows doubled figures when run after year-end close
- [ ] All existing report tests pass

---

## Tests (24D)

| Test | File | Verifies |
|------|------|---------|
| Balance sheet post-close shows zero Change in Net Assets for closed year | `src/lib/reports/balance-sheet.test.ts` | revenue/expense zeroed |
| Balance sheet current year shows only current year rev/exp | `src/lib/reports/balance-sheet.test.ts` | startDate filter correct |
| Balance sheet still balances post-close | `src/lib/reports/balance-sheet.test.ts` | assets = liabilities + net assets |
| Activities report unaffected by closing entries | `src/lib/reports/activities.test.ts` | YEAR_END_CLOSE excluded |
| Cash flows "Change in Net Assets" matches activities | `src/lib/reports/cash-flows.test.ts` | consistent across reports |
| Fund level report excludes closing entries | `src/lib/reports/fund-level.test.ts` | no distortion |
| Form 990 data excludes closing entries from revenue lines | `src/lib/reports/form-990-data.test.ts` | clean 990 output |

---

## Final Gate: Cross-Report Consistency Check

Before Phase 24 is considered complete, verify the following numbers are consistent across reports for the same period and fund selection:

| Metric | Source Report A | Source Report B | Must Match? |
|--------|----------------|----------------|-------------|
| Change in Net Assets (open year) | Statement of Activities | Statement of Cash Flows (line 1) | Yes |
| Total Net Assets | Balance Sheet | (derived) Fund Level totals | Yes |
| Total Revenue | Statement of Activities | Form 990 Data (total revenue) | Yes |
| Fund-level net change | Fund Level Report | Activities filtered by fund | Yes |

Document this check as a manual QA step in the commit notes when Phase 24D ships.

---

## Phase 24 Complete: First Close

Once all four sub-phases are merged and deployed to production:
1. Run the Close the Books wizard for fiscal year 2025
2. Verify all checklist items pass
3. Review the trial balance preview — confirm figures match QBO import totals
4. Post closing entries
5. Run all four consistency checks above against the closed-year reports
6. Archive this plan doc

