# Phase 21: Testing, Polish & Performance — Execution Plan

**Goal:** Comprehensive testing pass, UI polish, and performance optimization before production deployment.

**Current State:**
- 62 test files, 823 tests, all passing (8.13s runtime)
- 10 E2E specs covering auth, revenue, expenses, payroll, POs, bank rec, security deposits, budgets, reports, dashboard, functional allocation
- 88 page routes across 16 route groups
- 0 error.tsx files, 0 loading.tsx files, 0 not-found.tsx files
- 17 TODO comments (12 are `// TODO: replace with session user`)
- 27 files reference Suspense/loading/skeleton patterns but no formal loading states

**Dependencies:** All prior phases (1–20) complete. Phase 17 (dashboard, compliance, board pack) changes are staged but uncommitted.

---

## Step 1: Resolve TODO Comments — Session User

**Why first:** These are real bugs in production — all mutations log `'system'` as the user instead of the actual authenticated user. This affects audit log integrity (INV-012).

**Files to modify (12 files):**
- `src/components/transactions/reverse-transaction-dialog.tsx`
- `src/components/transactions/void-transaction-dialog.tsx`
- `src/app/(protected)/accounts/create-account-dialog.tsx`
- `src/app/(protected)/accounts/[id]/account-detail-client.tsx`
- `src/app/(protected)/transactions/[id]/edit/edit-transaction-form.tsx`
- `src/app/(protected)/transactions/new/journal-entry-form.tsx`
- `src/app/(protected)/donors/create-donor-dialog.tsx`
- `src/app/(protected)/tenants/create-tenant-dialog.tsx`
- `src/app/(protected)/expenses/ramp/rules/create-rule-dialog.tsx`
- `src/app/(protected)/expenses/ramp/categorize-dialog.tsx`
- `src/app/(protected)/expenses/ramp/bulk-categorize-dialog.tsx`
- `src/app/(protected)/expenses/purchase-orders/new/create-po-form.tsx`
- `src/app/(protected)/vendors/create-vendor-dialog.tsx`

**Approach:** Create a `useCurrentUser()` hook (or use existing next-auth `useSession()`) that returns the authenticated user's ID. Replace all `'system' // TODO` instances with the actual user ID from session. Server actions should get user from `auth()`.

**Tests:** Unit test for `useCurrentUser()` hook. Verify audit log entries contain real user IDs (integration test).

**Acceptance criteria:** INV-012 — every mutation logs the actual acting user. No `'system'` user in production audit log entries from UI actions.

---

## Step 2: Error Boundaries & Error Pages

**Why:** Zero error handling infrastructure exists. Any runtime error shows a white screen.

**Files to create:**

### 2a. Global error boundary
- `src/app/error.tsx` — root error boundary for unhandled exceptions
- `src/app/global-error.tsx` — catches errors in root layout itself
- `src/app/not-found.tsx` — 404 page

### 2b. Protected route error handlers
- `src/app/(protected)/error.tsx` — error boundary for all authenticated pages
- `src/app/(protected)/not-found.tsx` — 404 within authenticated section

### 2c. Per-section error handlers (key sections only)
- `src/app/(protected)/transactions/error.tsx`
- `src/app/(protected)/reports/error.tsx`
- `src/app/(protected)/bank-rec/error.tsx`
- `src/app/(protected)/payroll/error.tsx`
- `src/app/(protected)/expenses/error.tsx`

**Pattern:** Each error.tsx follows Next.js conventions:
```tsx
'use client'
export default function Error({ error, reset }) {
  // Log error, show retry button, link to dashboard
}
```

**Tests:** E2E test that triggers an error state and verifies the error boundary renders.

**Acceptance criteria:** No white-screen crashes. Every error shows a helpful message with a retry/back action.

---

## Step 3: Loading States & Skeleton Screens

**Why:** Server component pages have no visual feedback during data loading. The `Skeleton` shadcn/ui component exists but is unused.

**Files to create:**

### 3a. Loading skeletons for key routes
- `src/app/(protected)/(dashboard)/loading.tsx` — dashboard skeleton (5 section cards)
- `src/app/(protected)/transactions/loading.tsx` — table skeleton
- `src/app/(protected)/reports/loading.tsx` — report skeleton (filter bar + table)
- `src/app/(protected)/bank-rec/loading.tsx` — two-column skeleton
- `src/app/(protected)/payroll/loading.tsx` — table skeleton
- `src/app/(protected)/expenses/loading.tsx` — table skeleton
- `src/app/(protected)/budgets/loading.tsx` — table skeleton
- `src/app/(protected)/accounts/loading.tsx` — table skeleton
- `src/app/(protected)/vendors/loading.tsx` — table skeleton
- `src/app/(protected)/tenants/loading.tsx` — table skeleton
- `src/app/(protected)/compliance/loading.tsx` — calendar skeleton

### 3b. Shared skeleton components
- `src/components/shared/table-skeleton.tsx` — reusable rows + columns skeleton
- `src/components/shared/report-skeleton.tsx` — filter bar + table skeleton
- `src/components/shared/card-skeleton.tsx` — dashboard card skeleton

**Pattern:** Use the existing `Skeleton` component from shadcn/ui. Each loading.tsx exports a default function with the same visual structure as the page (same card layout, table shape) but with skeleton placeholders.

**Tests:** Snapshot test for each skeleton component to prevent regression.

**Acceptance criteria:** Every page shows a skeleton during data loading. No blank pages or layout shift.

---

## Step 4: Expand Unit Test Coverage — Critical Path Gaps

**Why:** Phase 21 spec requires >90% coverage on critical paths. Current coverage is good in some domains but sparse in others.

**Test files to create or expand:**

### 4a. Report generators (currently 3 test files for 29+ reports)
- `src/lib/reports/__tests__/balance-sheet.test.ts` — Statement of Financial Position
- `src/lib/reports/__tests__/activities.test.ts` — Statement of Activities (P&L)
- `src/lib/reports/__tests__/cash-flows.test.ts` — Statement of Cash Flows
- `src/lib/reports/__tests__/functional-expenses.test.ts` — Functional expense matrix
- `src/lib/reports/__tests__/fund-reports.test.ts` — Fund drawdown, fund-level P&L/BS
- `src/lib/reports/__tests__/payroll-reports.test.ts` — Reports 25–29 (register, tax liability, W-2 verify, employer cost, 941 prep)
- `src/lib/reports/__tests__/compliance-reports.test.ts` — Audit log, compliance calendar, security deposit register, late entries
- `src/lib/reports/__tests__/operational-reports.test.ts` — Cash position, AR aging, outstanding payables, rent collection

**Test approach:** Each report test creates mock GL data, calls the report generator, and asserts the output structure, totals, and fund drill-down behavior.

### 4b. API route handlers (currently 0 tests)
- `src/app/api/cron/__tests__/depreciation.test.ts`
- `src/app/api/cron/__tests__/interest-accrual.test.ts`
- `src/app/api/cron/__tests__/rent-accrual.test.ts`
- `src/app/api/cron/__tests__/prepaid-amortization.test.ts`
- `src/app/api/cron/__tests__/compliance-reminders.test.ts`
- `src/app/api/cron/__tests__/plaid-sync.test.ts`
- `src/app/api/cron/__tests__/ramp-sync.test.ts`
- `src/app/api/cron/__tests__/staging-processor.test.ts`
- `src/app/api/cron/__tests__/security-deposit-interest.test.ts`

**Test approach:** Mock the database layer, verify each cron handler:
- Handles the happy path (creates correct GL entries)
- Handles failures gracefully (returns error status, doesn't crash)
- Is idempotent (running twice doesn't double-post)
- Respects Vercel cron auth header

### 4c. Assets & depreciation (currently 0 dedicated test file)
- `src/lib/assets/__tests__/depreciation.test.ts` — monthly depreciation calculations
- `src/lib/assets/__tests__/cip-conversion.test.ts` — CIP-to-fixed-asset conversion logic

### 4d. Fund accounting logic
- `src/lib/fund-accounting/__tests__/multi-fund-split.test.ts` — multi-fund transaction splits
- `src/lib/fund-accounting/__tests__/net-asset-rollup.test.ts` — restricted/unrestricted rollups

**Acceptance criteria:** All 15 system invariants (INV-001 through INV-015) have explicit test cases. >90% line coverage on: GL engine, payroll calculations, bank rec matcher, depreciation, tax withholding, fund accounting, budget variance.

---

## Step 5: E2E Test Suite — Primary User Workflows

**Why:** Phase 21 spec requires E2E coverage of 5 primary workflows. Current E2E tests cover individual modules but not end-to-end flows.

**Files to create:**

### 5a. Monthly accounting cycle (the most important E2E test)
- `e2e/monthly-cycle.spec.ts`
  - Record rent revenue (accrual entries)
  - Process an expense report (staging → GL)
  - Run a payroll cycle
  - Categorize Ramp transactions
  - Reconcile bank transactions
  - Generate and verify Report #1 (Balance Sheet) and Report #2 (Activities)

### 5b. New vendor/PO/invoice/payment flow
- `e2e/vendor-po-invoice-flow.spec.ts`
  - Create vendor with 1099 eligibility
  - Create PO with contract reference
  - Submit invoice against PO
  - Mark payment in process
  - Verify AR aging and outstanding payables reports

### 5c. Ramp categorization flow
- `e2e/ramp-categorization-flow.spec.ts`
  - View uncategorized queue
  - Categorize transaction (select GL account + fund)
  - Create auto-categorization rule
  - Verify rule applies to next transaction
  - Verify Ramp cross-check on settlement

### 5d. Budget creation and variance review
- `e2e/budget-variance-flow.spec.ts`
  - Create new budget with spread modes (even, seasonal, one-time)
  - Approve budget
  - Post transactions against budgeted accounts
  - Verify variance colors on reports (green/yellow/red)
  - Verify cash projection auto-fill from budget

### 5e. CIP conversion wizard
- `e2e/cip-conversion-flow.spec.ts`
  - Review CIP balances by sub-account
  - Launch conversion wizard
  - Allocate to fixed asset components
  - Set useful lives
  - Review and commit
  - Verify reclassification JE created
  - Verify fixed asset records created with depreciation schedules

### 5f. Accessibility smoke test
- `e2e/accessibility.spec.ts`
  - Run axe-core on: dashboard, transaction form, report page, bank rec workspace
  - Verify no critical or serious WCAG AA violations

**Acceptance criteria:** All 5 primary workflows pass end-to-end. Accessibility tests show no critical violations.

---

## Step 6: Form Validation & Error Messages

**Why:** Every Zod validation error should map to a user-friendly message. Currently, some forms show raw Zod errors.

**Approach:**
1. Audit all form components for validation error display
2. Ensure every Zod schema in `src/lib/validators/` has `.message()` on each field
3. Create a `formatValidationErrors()` utility that transforms Zod errors into user-friendly messages
4. Verify all forms display inline validation errors (not toasts for field-level errors)

**Files to modify:**
- All dialog forms in `src/app/(protected)/*/create-*-dialog.tsx`
- Journal entry form (`transactions/new/journal-entry-form.tsx`)
- Budget edit form (`budgets/[id]/edit/`)
- PO creation form (`expenses/purchase-orders/new/create-po-form.tsx`)

**Files to create:**
- `src/lib/validators/format-errors.ts` — shared validation error formatter
- `src/lib/validators/__tests__/format-errors.test.ts` — tests for error formatting

**Acceptance criteria:** Every form shows clear, specific, actionable error messages. No raw Zod error strings visible to users.

---

## Step 7: HelpTooltip Completeness Audit

**Why:** Phase 21 spec requires every non-obvious field has a tooltip. The `<HelpTooltip>` component exists and is tested, but coverage across pages is unknown.

**Approach:**
1. Audit all form pages and report headers for HelpTooltip usage
2. Cross-reference with `src/lib/help/terms.ts` dictionary
3. Add missing terms for: fund concepts, CIP terminology, compliance fields, payroll tax terms, budget spread modes

**Files to modify:**
- `src/lib/help/terms.ts` — add missing terms
- Various page components — add `<HelpTooltip>` where missing

**Key areas needing tooltips:**
- Fund selection fields (restricted vs unrestricted)
- CIP sub-account fields (Hard Costs, Soft Costs, etc.)
- Payroll fields (FICA, withholding, gross vs net)
- Budget spread mode selector (even, seasonal, one-time, custom)
- Bank rec match types (auto, manual, rule)
- Compliance calendar categories
- 990 line mapping fields
- Functional allocation percentages (Program/Admin/Fundraising)

**Tests:** Verify terms.ts has entries for all standard help terms (add to existing `terms.test.ts`).

**Acceptance criteria:** Every non-obvious field and heading has a `<HelpTooltip>`. No "unknown term" returns null.

---

## Step 8: Breadcrumb & Navigation Verification

**Why:** 88 page routes exist. Breadcrumbs should work on all nested routes with entity name resolution.

**Approach:**
1. Verify breadcrumb rendering on all multi-segment routes
2. Verify entity name resolution: vendor name (not ID), tenant name (not ID), PO number, etc.
3. Verify clickable navigation for each breadcrumb segment

**Key routes to verify:**
- `/vendors/[id]` → "Vendors > Greenfield Construction"
- `/expenses/purchase-orders/[id]` → "Expenses > Purchase Orders > PO-0042"
- `/expenses/purchase-orders/[id]/invoices/new` → full chain
- `/revenue/grants/[id]` → "Revenue > Grants > AHP Fund"
- `/reports/balance-sheet` → "Reports > Balance Sheet"
- `/transactions/[id]/edit` → "Transactions > TXN-00123 > Edit"

**Files to modify:** `src/components/shared/breadcrumbs.tsx` if entity name resolution is missing.

**Tests:** Expand `breadcrumbs.test.tsx` with route resolution test cases.

**Acceptance criteria:** All nested routes display correct breadcrumbs with human-readable names. All segments are clickable.

---

## Step 9: Performance Audit

**Why:** Phase 21 spec requires all 29 reports load within 2 seconds for expected data volume.

**Approach:**

### 9a. Report query performance
- Profile all 29 report SQL queries against a test dataset (~12,000 transaction rows)
- Add database indexes where needed (likely on: `transaction_lines.account_id`, `transaction_lines.fund_id`, `transactions.date`, `bank_transactions.date`)
- Verify query execution time <500ms for each report

### 9b. Dashboard load time
- Profile all 5 dashboard section queries
- Target: all 5 sections render within 1 second
- Consider parallel data fetching with `Promise.all()` if sequential

### 9c. TanStack Table performance
- Test table rendering with 1000+ rows (transaction history, vendor list)
- Enable virtualization if scrolling is laggy (`@tanstack/react-virtual`)
- Verify sort/filter operations are responsive

### 9d. Cron job timing
- Verify all 9 cron jobs complete within Vercel's 60-second timeout
- Profile: depreciation (iterates all active assets), Plaid sync (API round-trips), compliance reminders (deadline queries)

**Files to create:**
- `src/lib/db/indexes.ts` — additional database indexes if needed (add to Drizzle schema)

**Acceptance criteria:** All reports load <2s. Dashboard loads <1s. Tables handle 1000+ rows smoothly. Cron jobs complete <60s.

---

## Step 10: Cron Job Review & Hardening

**Why:** Phase 21 spec requires cron jobs handle failures gracefully, don't overlap, and log results.

**Approach:**
1. Review all 9 cron job routes for:
   - Idempotency (running twice doesn't double-post)
   - Error handling (catches exceptions, returns meaningful error responses)
   - Auth verification (checks Vercel cron secret header)
   - Logging (records what was processed, skipped, and failed)
2. Add `CRON_SECRET` verification to all cron routes if missing
3. Verify monthly jobs use date guards (don't rerun for same month)

**Files to review/modify:**
- `src/app/api/cron/depreciation/route.ts`
- `src/app/api/cron/interest-accrual/route.ts`
- `src/app/api/cron/rent-accrual/route.ts`
- `src/app/api/cron/prepaid-amortization/route.ts`
- `src/app/api/cron/compliance-reminders/route.ts`
- `src/app/api/cron/plaid-sync/route.ts`
- `src/app/api/cron/ramp-sync/route.ts`
- `src/app/api/cron/staging-processor/route.ts`
- `src/app/api/cron/security-deposit-interest/route.ts`

**Acceptance criteria:** All cron jobs are idempotent, auth-gated, and log their results. Failures produce actionable error messages.

---

## Step 11: Audit Log Completeness Spot-Check

**Why:** Audit log is the compensating control for no RBAC (INV-012). Must be airtight.

**Approach:**
1. List all mutation endpoints (API routes + server actions)
2. Verify each produces an audit log entry
3. Spot-check: create a transaction, edit it, void it — verify 3 audit log entries
4. Spot-check: create vendor, update vendor — verify 2 audit log entries
5. Spot-check: bank rec sign-off — verify audit entry
6. Spot-check: budget change — verify audit entry

**Files to create:**
- `src/lib/audit/__tests__/completeness.test.ts` — integration test that exercises mutations and checks audit log output

**Acceptance criteria:** Every mutation to financial data produces an audit log entry with: timestamp, user, action, entity_id, before/after state.

---

## Step 12: TypeScript Strict Mode & Console Cleanup

**Why:** Phase 21 spec requires fixing all console errors and TypeScript strict mode warnings.

**Approach:**
1. Run `npx tsc --noEmit` and fix all TypeScript errors
2. Run the app and check browser console for errors/warnings
3. Fix any `any` types in critical paths (GL engine, payroll, reports)
4. Remove any `console.log` debug statements

**Acceptance criteria:** Zero TypeScript errors. Zero console errors in development. Zero `console.log` statements (except intentional logging in cron jobs).

---

## Step 13: Security Review

**Why:** Phase 21 spec requires verification of authentication, encryption, and secret management.

**Checklist:**

### 13a. No secrets in client-side code
- Grep for API keys, tokens, connection strings in client components
- Verify all env vars used client-side are prefixed with `NEXT_PUBLIC_` only for non-sensitive values
- Verify Plaid tokens, Ramp keys, Anthropic key are server-only

### 13b. API route authentication
- Verify all API routes under `/api/` (except `/api/auth/`) check for authenticated session
- Verify cron routes check `CRON_SECRET` header

### 13c. Encrypted fields
- Verify Plaid access tokens are AES-256-GCM encrypted at rest (SYS-P0-017)
- Verify vendor tax_id field is encrypted (DM-P0-014)

### 13d. Restricted Postgres roles
- Document expected role permissions for `timesheets_role`, `expense_reports_role`, `financial_system_reader`
- Verify INSERT-only on `audit_log` (INV-012)

**Files to create:**
- `src/lib/security/__tests__/auth-check.test.ts` — verify API routes reject unauthenticated requests

**Acceptance criteria:** No secrets in client bundles. All API routes authenticated. Encrypted fields verified. Security model matches design.md Section 7.

---

## Step 14: Mobile Responsiveness Check

**Why:** Not primary use case but Heather sometimes checks from tablet. No broken layouts.

**Approach:**
1. Test dashboard, transaction list, and report pages at tablet breakpoint (768px)
2. Verify sidebar collapses properly
3. Verify tables scroll horizontally (not overflow or clip)
4. Verify forms are usable at reduced width
5. Fix any layout breaks

**Acceptance criteria:** No broken layouts at tablet width. Core pages are usable (not necessarily optimized) on tablet.

---

## Summary: Files Created/Modified

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Session user fix | 1 (hook) | 12 |
| Error boundaries | ~10 | 0 |
| Loading states | ~14 | 0 |
| Unit tests | ~20 | ~5 |
| E2E tests | 6 | 0 |
| Validation | 2 | ~10 |
| HelpTooltip | 0 | ~15 |
| Breadcrumbs | 0 | ~2 |
| Performance | ~1 | ~5 |
| Cron hardening | 0 | 9 |
| Audit completeness | 1 | 0 |
| Security tests | 1 | 0 |
| **Total** | **~56** | **~58** |

## Execution Order & Parallelization

```
Step 1 (session user)     ─── independent, do first (fixes real bugs)
Step 2 (error boundaries) ─┐
Step 3 (loading states)   ─┤─ can parallel (both are new files, no conflicts)
Step 6 (form validation)  ─┘
Step 4 (unit tests)       ─┐
Step 5 (E2E tests)        ─┤─ can parallel (different test files)
Step 7 (tooltips)         ─┘
Step 8 (breadcrumbs)      ─── quick verification pass
Step 9 (performance)      ─── needs running app + test data
Step 10 (cron hardening)  ─┐
Step 11 (audit check)     ─┤─ can parallel (different concerns)
Step 12 (TS cleanup)      ─┘
Step 13 (security review) ─── final pass
Step 14 (mobile check)    ─── final pass
```

## Acceptance Criteria Satisfied

| Requirement | How |
|------------|-----|
| INV-001–015 | Step 4: explicit test for each invariant |
| INV-012 (audit log) | Steps 1, 11: real user IDs, completeness check |
| RPT-P0-001–008 | Steps 4, 9: report tests + performance verification |
| SYS-P0-017 | Step 13: encrypted field verification |
| SYS-P0-018 | Step 8: breadcrumb verification |
| SYS-P0-021 | Step 7: HelpTooltip completeness |
| D-041 (audit) | Step 11: every mutation logged |
| D-053 (corrections) | Step 4: edit/reversal/void test coverage |
