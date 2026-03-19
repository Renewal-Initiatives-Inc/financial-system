# Phase 23: Smart Reconciliation, Cash Forecasting & Ramp Intelligence

## Summary

Three sub-phases that upgrade bank reconciliation from one-at-a-time manual matching to a three-tier daily close workflow, extend cash forecasting from 3-month/monthly to 13-week/weekly, and add AI-assisted Ramp categorization.

| Sub-phase | Focus | Tasks |
|-----------|-------|-------|
| 23a | Foundation — schema, matching engine, daily close notifications | 5 |
| 23b | UI rethink — bank rec dashboard, Ramp AI intelligence, consistent patterns | 5 |
| 23c | 13-week rolling cash forecast — weekly granularity, richer data sources | 5 |

| # | Task | Sub-phase | Requirements |
|---|------|-----------|-------------|
| 1 | Recurring expectations schema + CRUD | 23a | REC-P0-006 (trust-escalation extension) |
| 2 | Matching rules enhancements (settlementDayOffset, tier thresholds) | 23a | REC-P0-007 |
| 3 | Three-tier auto-match engine | 23a | REC-P0-006, REC-P0-007 |
| 4 | Integrate auto-match into Plaid sync cron | 23a | REC-P0-002, SYS-P0-014 |
| 5 | Daily close notification via Postmark | 23a | INT-P0-016, INT-P0-017 |
| 6 | Bank rec dashboard UI — summary cards + batch review | 23b | REC-P0-006, REC-P0-010 |
| 7 | Bank rec exception queue + running balance | 23b | REC-P0-009, REC-P0-012, REC-P0-013 |
| 8 | Ramp AI categorization engine | 23b | TXN-P0-027, SYS-P0-002 |
| 9 | Ramp page UI — AI suggestions + summary cards | 23b | TXN-P0-027, TXN-P0-032 |
| 10 | Shared smart-dashboard component library | 23b | — |
| 11 | Weekly cash projection schema + migration | 23c | BDG-P0-008 |
| 12 | Weekly projection generation engine | 23c | BDG-P0-008, D-091 |
| 13 | 13-week cash forecast report page | 23c | BDG-P0-008, Report #15 |
| 14 | Weekly cash projection editor | 23c | BDG-P0-008 |
| 15 | Threshold alerts + restricted/unrestricted split | 23c | BDG-P0-008 |

## Dependencies

- [x] Phase 12 (Bank Reconciliation) — complete, matcher.ts + reconciliation.ts exist
- [x] Phase 9 (Ramp Integration) — complete, categorization engine + rules exist
- [x] Phase 14 (Budgeting & Cash Projection) — complete, cash_projections + cash_projection_lines tables exist
- [x] Phase 18 (AI Copilot) — complete, Anthropic SDK integration pattern established
- [x] Phase 22 Step 6 (Plaid connected) — complete, daily sync operational
- [x] Phase 22 Step 7 (Ramp connected) — complete, OAuth2 + daily sync operational
- [ ] Postmark API key in Vercel env vars (already configured for donor acknowledgments)
- [ ] ANTHROPIC_API_KEY in Vercel env vars (already configured for copilot)

---

## Sub-Phase 23a: Foundation — Schema, Matching Engine, Daily Close Notifications

### Task 1: Recurring Expectations Schema + CRUD

**What:** Create a `recurring_expectations` table for predictable transactions (rent, utilities, insurance, loan payments) that feed into both auto-matching and cash forecasting.

**Files:**
- Create: `src/lib/db/schema/recurring-expectations.ts`
- Modify: `src/lib/db/schema/index.ts` — export new table
- Create: `drizzle/0025_recurring_expectations.sql` — migration
- Create: `src/app/(protected)/settings/recurring-expectations/page.tsx` — management UI
- Create: `src/app/(protected)/settings/recurring-expectations/recurring-expectations-client.tsx` — CRUD form
- Create: `src/app/(protected)/settings/recurring-expectations/actions.ts` — server actions

**Schema:**
```
recurring_expectations:
  id: serial PK
  merchantPattern: varchar(255) — regex pattern matching merchant name
  description: varchar(255) — human label (e.g., "Eversource Electric")
  expectedAmount: numeric(15,2) — expected transaction amount
  amountTolerance: numeric(5,2) default 0.00 — allowed variance ($)
  frequency: enum('weekly', 'biweekly', 'monthly', 'quarterly', 'annual')
  expectedDay: integer — day of month (1-31) or day of week (1-7)
  glAccountId: integer FK → accounts
  fundId: integer FK → funds
  bankAccountId: integer FK → bank_accounts
  isActive: boolean default true
  lastMatchedAt: timestamp nullable
  createdAt, updatedAt: timestamps
```

**AC:**
- [ ] Migration creates table with all columns, FKs, and indexes
- [ ] Settings page lists all recurring expectations with edit/delete/toggle active
- [ ] Create form validates: merchantPattern is valid regex, expectedDay within range for frequency, account and fund exist
- [ ] Seed 3-5 known recurring transactions (if data available from existing matching_rules)

---

### Task 2: Matching Rules Enhancements

**What:** Add `settlementDayOffset` and configurable auto-match thresholds to `matching_rules`, plus an `app_settings` row for global tier thresholds.

**Files:**
- Create: `drizzle/0026_matching_rules_enhancements.sql` — add columns
- Modify: `src/lib/db/schema/matching-rules.ts` — add `settlementDayOffset` (integer, default 0), `autoMatchEligible` (boolean, default false)
- Modify: `src/lib/db/schema/app-settings.ts` — add settings keys for tier thresholds if not using a dedicated config
- Create: `src/app/(protected)/settings/matching-thresholds/page.tsx` — admin config for auto-match thresholds
- Create: `src/app/(protected)/settings/matching-thresholds/actions.ts`

**Threshold settings (stored in app_settings or constants):**
```
autoMatchMinHitCount: 5 (default)
autoMatchMinConfidence: 0.95 (default)
autoMatchMaxAmount: 500.00 (default)
reviewMinConfidence: 0.70 (default)
```

**AC:**
- [ ] Migration adds columns without breaking existing matching_rules data
- [ ] settlementDayOffset used by matcher to widen date window per-rule (e.g., +2 days for a vendor that always clears 2 days late)
- [ ] Threshold settings page allows Jeff/Heather/Damien to adjust all four values
- [ ] Existing matching rules default to autoMatchEligible=false (opt-in)

---

### Task 3: Three-Tier Auto-Match Engine

**What:** Extend `matcher.ts` with tier classification and batch auto-match capability. Each bank transaction gets classified into Tier 1 (auto), Tier 2 (review), or Tier 3 (exception).

**Files:**
- Modify: `src/lib/bank-rec/matcher.ts` — add `classifyMatchTier()`, `runAutoMatch()`, `getBatchReviewCandidates()`, `getExceptions()`
- Modify: `src/lib/bank-rec/reconciliation.ts` — add `recordAutoMatch()` that creates bank_match with matchType='auto' and logs to audit_log

**Tier Classification Logic:**
```
Tier 1 (auto-match) — ALL must be true:
  - Match candidate exists with confidence >= autoMatchMinConfidence
  - Matching rule has hitCount >= autoMatchMinHitCount AND autoMatchEligible=true
  - |transaction amount| <= autoMatchMaxAmount
  - OR: recurring_expectation matches (merchantPattern + amount within tolerance + expected timing)

Tier 2 (batch review) — ANY:
  - Match candidate exists with confidence >= reviewMinConfidence AND < autoMatchMinConfidence
  - Match candidate exists but rule hitCount < autoMatchMinHitCount
  - Match candidate exists but amount > autoMatchMaxAmount

Tier 3 (exception) — ANY:
  - No match candidates with confidence >= reviewMinConfidence
  - Multiple candidates with similar confidence (ambiguous)
  - Transaction requires split (detected by: amount doesn't match any single GL line but matches sum of 2+ lines)
  - Merchant never seen before (no matching_rule and no recurring_expectation)
```

**AC:**
- [ ] `classifyMatchTier(bankTransaction, candidates, rules, expectations)` returns `{ tier: 1|2|3, reason: string, candidate?: MatchCandidate }`
- [ ] `runAutoMatch(bankAccountId)` processes all unmatched bank transactions, auto-matches Tier 1, returns counts per tier
- [ ] Auto-matched transactions get bank_match record with matchType='auto', confidenceScore, ruleId
- [ ] Audit log entry for every auto-match: `{ action: 'auto_match', bankTransactionId, glTransactionLineId, confidence, ruleId }`
- [ ] Recurring expectations matched by: merchantPattern regex test + amount within tolerance + date within expected window (expectedDay ±3 days adjusted by frequency)
- [ ] `getBatchReviewCandidates(bankAccountId)` returns Tier 2 items with suggested match + one-line reasoning string
- [ ] `getExceptions(bankAccountId)` returns Tier 3 items with reason code

---

### Task 4: Integrate Auto-Match into Plaid Sync Cron

**What:** After Plaid sync completes, run auto-match for each synced bank account, then trigger daily close notification.

**Files:**
- Modify: `src/app/api/cron/plaid-sync/route.ts` — after sync loop, call `runAutoMatch()` per account, collect results, call notification
- Create: `src/lib/bank-rec/daily-close.ts` — orchestrator: runs auto-match across all active bank accounts, aggregates results into a summary

**Flow:**
```
1. Existing Plaid sync (unchanged)
2. For each bank account with new/modified transactions:
   a. Run rule-based matching (existing applyMatchingRules)
   b. Run recurring expectation matching (new)
   c. Classify remaining unmatched into tiers
   d. Execute Tier 1 auto-matches
3. Aggregate results across all accounts
4. Send daily close notification (Task 5)
5. Log cron_run with details: { autoMatched, pendingReview, exceptions, errors }
```

**AC:**
- [ ] Auto-match runs after every successful Plaid sync (daily 7 AM UTC)
- [ ] If Plaid sync fails, auto-match still runs on previously synced transactions
- [ ] cron_runs record includes: `{ cronJob: 'plaid_sync', details: { synced: N, autoMatched: N, pendingReview: N, exceptions: N } }`
- [ ] Auto-match errors don't crash the cron — caught and logged, notification still sent
- [ ] Existing rule-based matching (applyMatchingRules) runs BEFORE tier classification

---

### Task 5: Daily Close Notification via Postmark

**What:** After auto-match completes, email Jeff/Heather/Damien with a summary and link to the bank rec page.

**Files:**
- Create: `src/lib/notifications/daily-close.ts` — build and send email
- Modify: `src/lib/notifications/postmark.ts` — add daily close template (or use existing sendEmail pattern)

**Email content:**
```
Subject: Daily Close — [date] — [N] auto-matched, [N] need review, [N] exceptions

Body:
Bank Reconciliation Summary for [date]:

✓ [N] transactions auto-matched
⟳ [N] transactions need your review
✕ [N] exceptions require manual handling

[If exceptions > 0:]
Exceptions:
- $[amount] from [merchant] on [date] — [reason]
- ...

Review pending items: [link to /bank-rec?filter=pending]

---
Renewal Initiatives Financial System
```

**AC:**
- [ ] Email sent to all active users after daily auto-match completes
- [ ] Email skipped if no new bank transactions were synced (nothing to report)
- [ ] Link in email points to bank-rec page (production URL from env var)
- [ ] Postmark delivery logged to audit_log
- [ ] Email includes exception details (up to 10 items, truncated with "and N more")

---

## Sub-Phase 23b: UI Rethink — Bank Rec Dashboard, Ramp AI, Consistent Patterns

### Task 6: Bank Rec Dashboard UI — Summary Cards + Batch Review

**What:** Replace the one-at-a-time bank rec flow with a dashboard showing summary cards and a batch review table for Tier 2 items.

**Files:**
- Modify: `src/app/(protected)/bank-rec/bank-rec-client.tsx` — restructure to dashboard layout
- Create: `src/app/(protected)/bank-rec/components/summary-cards.tsx` — auto-matched / pending review / exceptions / rec status cards
- Create: `src/app/(protected)/bank-rec/components/batch-review-table.tsx` — Tier 2 items with bulk approve
- Modify: `src/app/(protected)/bank-rec/actions.ts` — add `bulkApproveMatches()`, `getDailyCloseSummary()` server actions

**Dashboard Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Bank Reconciliation                    [Sync Now]   │
├──────────┬──────────┬──────────┬────────────────────┤
│ ✓ Auto   │ ⟳ Review │ ✕ Except │ Rec Status         │
│ 22       │ 5        │ 2        │ Variance: $12.50   │
├──────────┴──────────┴──────────┴────────────────────┤
│ Pending Review (5)                  [Approve All]   │
│ ┌─ $127.50 Eversource 3/15 → Utilities 6200, GF    │
│ │  "Exact amount, merchant match, 1-day offset"     │
│ │  [✓ Approve] [✕ Reject]                           │
│ ├─ $89.00 Staples 3/14 → Office Supplies 6400, GF  │
│ │  "14 prior matches to this merchant+account"      │
│ │  [✓ Approve] [✕ Reject]                           │
│ └─ ...                                              │
├─────────────────────────────────────────────────────┤
│ Exceptions (2)                                      │
│ [Existing match/split/inline-GL workflow]            │
├─────────────────────────────────────────────────────┤
│ Recently Auto-Matched (22)          [Show/Hide]     │
│ [Collapsible table for audit visibility]             │
└─────────────────────────────────────────────────────┘
```

**AC:**
- [ ] Summary cards show counts for: auto-matched today, pending review, exceptions, current reconciliation variance
- [ ] Batch review table shows Tier 2 items with: bank txn details, suggested GL match, confidence score, one-line reasoning
- [ ] "Approve All" bulk-approves all visible Tier 2 items in a single server action
- [ ] Individual approve/reject per row; rejected items move to exception queue
- [ ] Bulk approve creates bank_match records + matching rules (if user opts in) + audit log entries
- [ ] Recently auto-matched section is collapsible, shows today's Tier 1 matches for transparency
- [ ] Existing bank account selector and statement date controls preserved at top
- [ ] Page uses SWR for real-time updates (consistent with existing pattern per D-014)

---

### Task 7: Bank Rec Exception Queue + Running Balance

**What:** Tier 3 exceptions use the existing match/split/inline-GL dialogs, plus a live running reconciliation balance.

**Files:**
- Modify: `src/app/(protected)/bank-rec/components/outstanding-items-panel.tsx` — integrate with tier system
- Create: `src/app/(protected)/bank-rec/components/reconciliation-balance-bar.tsx` — sticky bar showing GL vs bank balance
- Modify: `src/app/(protected)/bank-rec/actions.ts` — add `getReconciliationBalance()` that returns live calculation

**Balance Bar:**
```
┌──────────────────────────────────────────────────────┐
│ GL Balance: $45,230.12 | Bank Balance: $45,242.62    │
│ Variance: $12.50 | Outstanding: 2 checks, 1 deposit │
│ [Sign Off] (enabled when variance < $0.01)           │
└──────────────────────────────────────────────────────┘
```

**AC:**
- [ ] Exception queue renders Tier 3 items with existing dialogs: confirm-match, split-transaction, inline-gl-entry
- [ ] Reconciliation balance bar is sticky (visible while scrolling exception queue)
- [ ] Balance updates in real-time as matches are confirmed (SWR revalidation)
- [ ] Sign-off button enabled only when variance < $0.01 (existing logic from reconciliation.ts)
- [ ] Outstanding items panel shows GL-only items categorized as legitimate vs. problem (existing gl-only-categories.ts)
- [ ] Ramp cross-check accessible from dashboard (existing ramp-cross-check.tsx, repositioned)

---

### Task 8: Ramp AI Categorization Engine

**What:** When no categorization rule matches a Ramp transaction, use Claude to suggest GL account + fund based on merchant name, amount, cardholder, and historical patterns.

**Files:**
- Create: `src/lib/ramp/ai-categorization.ts` — Claude integration for merchant→account suggestion
- Modify: `src/app/(protected)/expenses/ramp/actions.ts` — add `getAiCategorization()` server action
- Modify: `src/lib/ramp/categorization.ts` — add AI fallback path when no rule matches

**AI Prompt Context:**
```
You are categorizing a credit card transaction for a nonprofit organization.

Transaction:
- Merchant: {merchantName}
- Amount: ${amount}
- Date: {date}
- Cardholder: {cardholder}
- Description: {description}

Chart of Accounts (expense accounts only):
{list of expense accounts with codes and names}

Available Funds:
{list of active funds}

Recent similar transactions (last 20 from this merchant or similar merchants):
{glAccountName, fundName, amount, date — from ramp_transactions JOIN accounts}

Existing categorization rules:
{criteria patterns and their target accounts}

Respond with JSON:
{
  "accountId": number,
  "accountName": string,
  "fundId": number,
  "fundName": string,
  "confidence": "high" | "medium" | "low",
  "reasoning": "one sentence explanation"
}
```

**AC:**
- [ ] AI suggestion returned within 3 seconds (Claude Haiku for speed)
- [ ] Prompt includes: transaction details, expense account list, fund list, last 20 similar merchant GL postings
- [ ] Response parsed with Zod validation — malformed responses fall back to manual categorization
- [ ] AI suggestion includes confidence level and one-line reasoning
- [ ] No auto-posting — AI only suggests, human confirms
- [ ] API costs tracked in audit_log (token count per call)
- [ ] If ANTHROPIC_API_KEY is missing or API errors, gracefully degrade to manual (no crash)

---

### Task 9: Ramp Page UI — AI Suggestions + Summary Cards

**What:** Add summary cards and AI suggestion display to the Ramp transaction queue.

**Files:**
- Modify: `src/app/(protected)/expenses/ramp/ramp-queue-client.tsx` — add summary cards, AI suggestion flow
- Modify: `src/app/(protected)/expenses/ramp/categorize-dialog.tsx` — pre-fill with AI suggestion, show reasoning
- Modify: `src/app/(protected)/expenses/ramp/bulk-categorize-dialog.tsx` — add per-item AI suggestions
- Modify: `src/app/(protected)/expenses/ramp/actions.ts` — add `batchAiCategorize()` server action

**Ramp Page Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Ramp Credit Card                     [Sync Now]     │
├──────────┬──────────┬──────────┬────────────────────┤
│ ✓ Auto   │ 🤖 AI    │ ✋ Manual │ Posted Today       │
│ 15       │ 3        │ 1        │ 18                 │
├──────────┴──────────┴──────────┴────────────────────┤
│ Tabs: [Uncategorized] [Categorized] [Posted] [All]  │
│                                                     │
│ Uncategorized (4):                                  │
│ ┌─ $89.00 STAPLES 3/15 Damien                      │
│ │  🤖 Suggested: Office Supplies 6400, General Fund │
│ │  "Similar to 14 prior Staples → 6400"             │
│ │  [✓ Accept] [✎ Override] [Create Rule ☐]          │
│ ├─ $234.00 NEW VENDOR 3/14 Heather                  │
│ │  ✋ No suggestion — new merchant                   │
│ │  [Categorize]                                     │
│ └─ ...                                              │
└─────────────────────────────────────────────────────┘
```

**AC:**
- [ ] Summary cards show: auto-categorized (rule-matched), AI-suggested, manual required, posted today
- [ ] Uncategorized transactions with AI suggestions show: suggested account+fund, confidence badge, reasoning
- [ ] "Accept" one-click confirms AI suggestion + optionally creates categorization rule
- [ ] "Override" opens existing categorize dialog pre-filled with AI suggestion (user can change)
- [ ] Bulk categorize dialog shows AI suggestions per item where available
- [ ] "Suggest All" button triggers batch AI categorization for all uncategorized items
- [ ] Loading state while AI processes (skeleton or spinner per item)

---

### Task 10: Shared Smart-Dashboard Component Library

**What:** Extract reusable components from bank-rec and Ramp dashboards into a shared library for consistency.

**Files:**
- Create: `src/components/smart-dashboard/summary-card.tsx` — configurable card (icon, count, label, color)
- Create: `src/components/smart-dashboard/batch-review-row.tsx` — transaction + suggestion + approve/reject
- Create: `src/components/smart-dashboard/status-badge.tsx` — tier/confidence badge component
- Refactor: bank-rec and Ramp pages to import from shared components

**AC:**
- [ ] SummaryCard accepts: icon, count, label, variant (success/warning/error/info)
- [ ] BatchReviewRow accepts: transaction data, suggestion data, onApprove/onReject callbacks
- [ ] StatusBadge renders tier (auto/review/exception) or confidence (high/medium/low) with appropriate colors
- [ ] Bank-rec and Ramp pages use identical component patterns
- [ ] Components use shadcn/ui primitives (Card, Badge, Button) — no new design system

---

## Sub-Phase 23c: 13-Week Rolling Cash Forecast

### Task 11: Weekly Cash Projection Schema + Migration

**What:** Extend the cash projection system to support weekly granularity alongside existing monthly.

**Files:**
- Create: `drizzle/0027_weekly_cash_projections.sql`
- Create: `src/lib/db/schema/weekly-cash-projection-lines.ts`
- Modify: `src/lib/db/schema/cash-projections.ts` — add `projectionType` enum ('MONTHLY' | 'WEEKLY')
- Modify: `src/lib/db/schema/index.ts` — export new table

**Schema:**
```
-- Add to cash_projections:
projection_type: enum('MONTHLY', 'WEEKLY') default 'MONTHLY'

-- New table:
weekly_cash_projection_lines:
  id: serial PK
  projectionId: integer FK → cash_projections (cascade delete)
  weekNumber: integer (1-13) — week offset from projection start
  weekStartDate: date — Monday of this week
  sourceLabel: varchar(255)
  autoAmount: numeric(15,2)
  overrideAmount: numeric(15,2) nullable
  overrideNote: text nullable
  lineType: enum('INFLOW', 'OUTFLOW')
  confidenceLevel: enum('HIGH', 'MODERATE', 'LOW') — based on data source
  fundId: integer FK → funds nullable — for restricted/unrestricted split
  sortOrder: integer default 0
  createdAt: timestamp
```

**AC:**
- [ ] Migration adds projectionType to cash_projections (defaults existing rows to 'MONTHLY')
- [ ] New weekly_cash_projection_lines table created with indexes on projectionId, weekNumber
- [ ] confidenceLevel column enables UI to visually distinguish high/moderate/low confidence weeks
- [ ] fundId column enables restricted vs. unrestricted tracking per line
- [ ] Existing monthly projection functionality unaffected (backward compatible)

---

### Task 12: Weekly Projection Generation Engine

**What:** Generate 13-week cash forecast lines from multiple data sources with confidence-tiered logic.

**Files:**
- Create: `src/lib/budget/weekly-projection.ts` — generation engine
- Modify: `src/app/(protected)/budgets/cash-projection/actions.ts` — add `generateWeeklyProjectionAction()`

**Data Sources & Confidence:**
```
HIGH confidence (weeks 1-2):
  Inflows:
  - Invoices with due dates in window (from invoices table, status='sent')
  - Pledges with expected dates in window (from pledges table, status='pending')
  - Scheduled rent by tenant (from rent accrual logic — known tenants × monthly rent)
  Outflows:
  - AP with due dates in window (from transactions with liability accounts)
  - Payroll obligations (from payroll table — next pay date)
  - Recurring expectations in window (from recurring_expectations table)
  - Loan payments (from recurring_expectations or known schedules)

MODERATE confidence (weeks 3-8):
  Inflows:
  - Budget-based revenue ÷ 4.33 (monthly → weekly)
  - Recurring expectations (if frequency matches)
  Outflows:
  - Budget-based expenses ÷ 4.33
  - Recurring expectations

LOW confidence (weeks 9-13):
  - Budget-based projections ÷ 4.33 (same as moderate but tagged low)
  - GL 3-month average ÷ 4.33 (existing fallback logic)
```

**AC:**
- [ ] `generateWeeklyProjection()` creates 13 weeks of INFLOW + OUTFLOW lines starting from next Monday
- [ ] Week 1-2 lines sourced from: invoices, pledges, rent schedule, AP, payroll, recurring_expectations
- [ ] Week 3-13 lines sourced from: budget lines (weekly amount = monthly ÷ 4.33) or GL 3-month average fallback
- [ ] Each line tagged with confidenceLevel based on source
- [ ] Lines with fundId set for restricted funds (from pledges.fundId, invoices.fundId, recurring_expectations.fundId)
- [ ] Starting cash pulled from Plaid (if available) or GL code '1010%' accounts (existing getStartingCash logic)
- [ ] Retains override_amount + override_note pattern from existing monthly projection

---

### Task 13: 13-Week Cash Forecast Report Page

**What:** New report view showing weekly cash forecast with restricted/unrestricted split and threshold alerts.

**Files:**
- Modify: `src/app/(protected)/reports/cash-projection/page.tsx` — add toggle for weekly/monthly view
- Modify: `src/app/(protected)/reports/cash-projection/cash-projection-client.tsx` — weekly table + chart
- Create: `src/lib/reports/weekly-cash-projection.ts` — query + assemble weekly report data

**Report Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Cash Forecast    [Monthly ▾ | Weekly]    [Export CSV]    │
├─────────────────────────────────────────────────────────┤
│ Starting Cash: $45,230    Unrestricted: $32,100         │
│                           Restricted:   $13,130         │
├─────┬────────┬────────┬────────┬────────┬───────────────┤
│ Wk  │ Inflow │ Outflow│ Net    │ End $  │ Unrest. $     │
├─────┼────────┼────────┼────────┼────────┼───────────────┤
│ 1 ● │ $8,200 │ $6,100 │ +2,100 │ 47,330 │ 34,200       │
│ 2 ● │ $3,500 │ $7,800 │ -4,300 │ 43,030 │ 29,900       │
│ 3 ◐ │ $5,000 │ $6,500 │ -1,500 │ 41,530 │ 28,400       │
│ ...                                                     │
│ 11◯ │ $4,200 │ $6,000 │ -1,800 │ 28,130 │ ⚠ 15,000     │
│ 12◯ │ $4,200 │ $6,000 │ -1,800 │ 26,330 │ ⚠ 13,200     │
│ 13◯ │ $4,200 │ $6,000 │ -1,800 │ 24,530 │ ⚠ 11,400     │
├─────┴────────┴────────┴────────┴────────┴───────────────┤
│ ● High confidence  ◐ Moderate  ◯ Low                    │
│ ⚠ Unrestricted cash below $20,000 threshold             │
└─────────────────────────────────────────────────────────┘
```

**AC:**
- [ ] Toggle between monthly (existing) and weekly (new) views — URL param `?view=weekly`
- [ ] Weekly table shows: week number, week start date, total inflows, total outflows, net cash flow, ending balance, unrestricted balance
- [ ] Confidence indicators per week (●/◐/◯) based on confidenceLevel of constituent lines
- [ ] Threshold warning (⚠) on weeks where unrestricted balance drops below configurable minimum
- [ ] Expandable rows show individual inflow/outflow line items with sourceLabel
- [ ] Restricted vs. unrestricted split calculated from: total ending cash - sum(restricted fund lines)
- [ ] CSV export includes all line-level detail

---

### Task 14: Weekly Cash Projection Editor

**What:** Allow users to generate and override weekly projections, preserving the existing audit trail pattern.

**Files:**
- Modify: `src/app/(protected)/budgets/cash-projection/cash-projection-client.tsx` — add weekly mode
- Modify: `src/app/(protected)/budgets/cash-projection/actions.ts` — add weekly generate + save actions

**AC:**
- [ ] "Generate 13-Week Projection" button creates weekly projection (alongside existing "Generate 3-Month Projection")
- [ ] Weekly editor shows same layout as report but with editable override fields per line
- [ ] Override requires explanatory note (existing validation pattern)
- [ ] Effective amount = overrideAmount ?? autoAmount (existing pattern)
- [ ] Save persists all overrides in a single transaction
- [ ] Only one active weekly projection per fiscal year (generating new one replaces old)

---

### Task 15: Threshold Alerts + Restricted/Unrestricted Split

**What:** Configurable cash threshold alerts and proper restricted/unrestricted separation throughout the forecast.

**Files:**
- Modify: `src/app/(protected)/settings/` — add cash threshold configuration (can be a section in existing settings)
- Modify: `src/lib/budget/weekly-projection.ts` — add restricted fund identification logic
- Modify: `src/lib/reports/weekly-cash-projection.ts` — add threshold checking

**Settings:**
```
cashThresholdWarning: numeric — unrestricted cash below this triggers ⚠ (default: $20,000)
cashThresholdCritical: numeric — unrestricted cash below this triggers 🔴 (default: $10,000)
```

**Restricted Fund Logic:**
```
For each weekly line:
  If line.fundId points to a RESTRICTED fund → count toward restricted total
  If line.fundId is null or points to UNRESTRICTED fund → count toward unrestricted total
  Unrestricted ending balance = total ending balance - restricted inflows + restricted outflows
```

**AC:**
- [ ] Threshold values configurable in settings
- [ ] Report and editor both show warning/critical indicators on threshold-breaching weeks
- [ ] Restricted fund lines correctly identified from fundId → fund.type mapping
- [ ] Unrestricted balance calculation accounts for restricted inflows that don't increase operating cash
- [ ] If no restricted funds are active, unrestricted balance = total balance (graceful)

---

## Tests

| Test | File | Verifies |
|------|------|---------|
| classifyMatchTier unit tests | `src/__tests__/bank-rec/matcher.test.ts` | Tier 1/2/3 classification logic with edge cases |
| runAutoMatch integration | `src/__tests__/bank-rec/auto-match.test.ts` | End-to-end auto-match with DB records |
| recurring expectations matching | `src/__tests__/bank-rec/recurring-expectations.test.ts` | Pattern + amount tolerance + timing window |
| bulk approve server action | `src/__tests__/bank-rec/bulk-approve.test.ts` | Multiple matches created atomically |
| AI categorization prompt | `src/__tests__/ramp/ai-categorization.test.ts` | Prompt assembly, response parsing, error fallback |
| weekly projection generation | `src/__tests__/budget/weekly-projection.test.ts` | 13 weeks generated, confidence levels correct |
| restricted/unrestricted split | `src/__tests__/budget/restricted-split.test.ts` | Fund-based split calculation |
| threshold alerts | `src/__tests__/budget/threshold-alerts.test.ts` | Warning/critical triggers at correct levels |
| daily close notification | `src/__tests__/notifications/daily-close.test.ts` | Email content, skip-if-empty, error handling |
| bank-rec dashboard E2E | `e2e/bank-rec-dashboard.spec.ts` | Summary cards render, batch approve flow, balance bar |
| ramp AI suggestion E2E | `e2e/ramp-ai-categorization.spec.ts` | AI suggestion display, accept flow, rule creation |
| weekly forecast E2E | `e2e/weekly-cash-forecast.spec.ts` | Generate, view, override, threshold display |
