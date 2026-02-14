# Phase 12: Bank Reconciliation — Execution Plan

**Goal:** Build the Plaid bank feed integration, trust-escalation matching engine, and reconciliation workspace.

**Dependencies:** Phase 5 (GL Engine), Phase 8 (Expenses & POs), Phase 9 (Ramp) — all complete.

**Deliverable:** Full bank reconciliation system. Daily Plaid sync operational. Trust-escalation matching with rules. Two-way reconciliation workspace with split transactions, inline GL creation, persistent sessions, and formal sign-off.

---

## Requirements Satisfied

| ID | Requirement |
|----|------------|
| REC-P0-001 | Plaid `/transactions/sync` for bank feeds. Two accounts initially (checking, savings). Third (escrow) addable later. |
| REC-P0-002 | Daily scheduled sync via cron. Manual "Sync Now" button. |
| REC-P0-003 | Plaid sign convention handling (positive = money out, negative = money in). |
| REC-P0-004 | Pending transactions displayed but not matchable. |
| REC-P0-005 | Full history rebuild from $0 starting balance. |
| REC-P0-006 | Trust-escalation matching model (suggest → confirm → rule → auto-approve). |
| REC-P0-007 | Match criteria: exact amount, ±3 days, merchant name tiebreaker. |
| REC-P0-008 | Multi-transaction matching: 1:many and many:1. Split transactions. |
| REC-P0-009 | Inline GL creation from reconciliation screen for bank-originated items. |
| REC-P0-010 | Two-way reconciliation: bank-to-GL AND GL-to-bank. |
| REC-P0-011 | GL-only categories (depreciation, opening balance, interest accrual, net asset releases, loan forgiveness). |
| REC-P0-012 | Outstanding items with visible dates. No automated stale check. |
| REC-P0-013 | Formal sign-off: who, when, reconciled balance. Edit with mandatory change note. |
| REC-P0-014 | Ramp settlement cross-check within bank rec. |
| REC-P0-015 | Persistent reconciliation sessions. Save progress, resume later. |
| INT-P0-013 | Plaid `/transactions/sync` with cursor-based incremental sync. |
| INT-P0-017 | Sync failure: dashboard notification + Postmark email alert. |
| SYS-P0-017 | Plaid access tokens encrypted at rest (AES-256-GCM). |

---

## Execution Steps

### Step 1: Database Schema — New enums & tables

**Files to create:**
- `src/lib/db/schema/bank-accounts.ts`
- `src/lib/db/schema/bank-transactions.ts`
- `src/lib/db/schema/bank-matches.ts`
- `src/lib/db/schema/matching-rules.ts`
- `src/lib/db/schema/reconciliation-sessions.ts`

**Files to modify:**
- `src/lib/db/schema/enums.ts` — Add new enums:
  - `bankMatchTypeEnum`: `auto`, `manual`, `rule`
  - `reconciliationStatusEnum`: `in_progress`, `completed`
  - `bankTransactionStatusEnum`: `pending`, `posted`
- `src/lib/db/schema/index.ts` — Export new tables, define relations

**Schema details per design.md §2.3:**

```
bankAccounts:
  id (serial PK)
  name (varchar 255)
  institution (varchar 255)
  last4 (varchar 4)
  plaidAccessToken (text, encrypted)
  plaidItemId (varchar 255)
  plaidCursor (text, nullable)        — cursor for incremental sync
  glAccountId (FK → accounts)         — links to Checking/Savings GL account
  isActive (boolean, default true)
  createdAt (timestamp)

bankTransactions:
  id (serial PK)
  bankAccountId (FK → bankAccounts)
  plaidTransactionId (varchar 255, UNIQUE)
  amount (numeric 15,2)               — Plaid convention normalized: positive = outflow
  date (date)
  merchantName (varchar 500, nullable)
  category (varchar 255, nullable)    — Plaid personal_finance_category
  isPending (boolean, default false)
  paymentChannel (varchar 50, nullable)
  rawData (jsonb, nullable)           — full Plaid response for audit
  createdAt (timestamp)
  updatedAt (timestamp)

  Indexes: (bankAccountId, date), (plaidTransactionId UNIQUE)

bankMatches:
  id (serial PK)
  bankTransactionId (FK → bankTransactions)
  glTransactionLineId (FK → transactionLines)
  matchType (enum: auto/manual/rule)
  confidenceScore (numeric 5,2, nullable)
  confirmedBy (varchar 255, nullable)
  confirmedAt (timestamp, nullable)
  ruleId (FK → matchingRules, nullable)
  reconciliationSessionId (FK → reconciliationSessions, nullable)
  createdAt (timestamp)

  Indexes: (bankTransactionId), (glTransactionLineId), (reconciliationSessionId)

matchingRules:
  id (serial PK)
  criteria (jsonb)                    — {merchantPattern?, amountExact?, description?}
  action (jsonb)                      — {glAccountId, fundId}
  createdBy (varchar 255)
  hitCount (integer, default 0)
  isActive (boolean, default true)
  createdAt (timestamp)

reconciliationSessions:
  id (serial PK)
  bankAccountId (FK → bankAccounts)
  statementDate (date)
  statementBalance (numeric 15,2)
  status (enum: in_progress/completed)
  signedOffBy (varchar 255, nullable)
  signedOffAt (timestamp, nullable)
  notes (text, nullable)
  createdAt (timestamp)
  updatedAt (timestamp)
```

**Drizzle relations:**
- bankAccounts → bankTransactions (one:many)
- bankAccounts → reconciliationSessions (one:many)
- bankAccounts → accounts (many:one via glAccountId)
- bankTransactions → bankMatches (one:many, supports split matching)
- bankMatches → transactionLines (many:one)
- bankMatches → matchingRules (many:one, nullable)
- bankMatches → reconciliationSessions (many:one, nullable)

**Run migration:** `npx drizzle-kit generate` then `npx drizzle-kit migrate`

**Acceptance criteria:**
- All tables created with correct constraints and indexes
- Relations wired in schema/index.ts
- Types exported (InsertBankAccount, SelectBankAccount, etc.)

---

### Step 2: Encryption Utilities for Plaid Tokens (SYS-P0-017)

**File to create:**
- `src/lib/encryption.ts`

**Implementation:**
- AES-256-GCM using Node.js `crypto` module
- Key from `PLAID_ENCRYPTION_KEY` env var (32 bytes, hex-encoded)
- `encrypt(plaintext: string): string` — returns `iv:authTag:ciphertext` (all base64)
- `decrypt(encrypted: string): string` — parses and decrypts
- Key validation on module load (fail fast if misconfigured)

**Pattern:** Simple, tested utility. No over-engineering — two functions, one module.

**Acceptance criteria:**
- Round-trip encrypt/decrypt works
- Different IVs per call (nonce uniqueness)
- Throws clear error if key is missing or wrong length

---

### Step 3: Zod Validators for Bank Reconciliation

**File to create:**
- `src/lib/validators/bank-reconciliation.ts`

**Schemas:**
- `insertBankAccountSchema` — name, institution, last4, glAccountId
- `insertBankTransactionSchema` — bankAccountId, plaidTransactionId, amount, date, merchantName, isPending
- `createMatchSchema` — bankTransactionId, glTransactionLineId, matchType
- `splitMatchSchema` — bankTransactionId, splits: [{glTransactionLineId, amount}] (amounts must sum to bank txn amount)
- `createMatchingRuleSchema` — criteria (JSONB), action (JSONB)
- `createReconciliationSessionSchema` — bankAccountId, statementDate, statementBalance
- `signOffReconciliationSchema` — reconciliationSessionId, userId
- `inlineGlEntrySchema` — date, memo, accountId, fundId, amount, bankTransactionId (for creating GL entries from bank rec)

**File to modify:**
- `src/lib/validators/index.ts` — Export new schemas

---

### Step 4: Plaid Client Integration (INT-P0-013)

**File to create:**
- `src/lib/integrations/plaid.ts`

**Implementation (following ramp.ts pattern):**
- Initialize `PlaidApi` with `Configuration` from `plaid` SDK
- Environment: Sandbox for dev, Production for prod (via `PLAID_ENV` env var)
- Required env vars: `PLAID_CLIENT_ID`, `PLAID_SECRET`, `PLAID_ENV`

**Exported functions:**
- `createLinkToken(userId: string): Promise<string>` — Creates Plaid Link token for account setup
- `exchangePublicToken(publicToken: string): Promise<{accessToken: string, itemId: string}>` — Exchanges public token after Link success
- `syncTransactions(accessToken: string, cursor: string | null): Promise<PlaidSyncResult>` — Calls `/transactions/sync`, returns {added, modified, removed, nextCursor, hasMore}
- `getAccounts(accessToken: string): Promise<PlaidAccount[]>` — Gets account info (name, mask, type)

**Plaid sign convention (REC-P0-003):**
- Plaid: positive = money out, negative = money in
- Our storage: store as-is (positive = outflow, negative = inflow) to match GL convention where debits to cash are positive
- Display layer handles formatting

**File to create:**
- `src/lib/integrations/plaid-sync-notification.ts` — Following `ramp-sync-notification.ts` pattern for sync failure email alerts (INT-P0-017)

---

### Step 5: Plaid Connection Setup UI

**Files to create:**
- `src/app/(protected)/bank-rec/settings/page.tsx` — Server page: list connected bank accounts
- `src/app/(protected)/bank-rec/settings/bank-accounts-client.tsx` — Client component: shows accounts, add new, sync status
- `src/app/(protected)/bank-rec/settings/connect-bank-dialog.tsx` — Dialog: Plaid Link initialization
- `src/app/(protected)/bank-rec/settings/actions.ts` — Server actions for bank account management

**Implementation:**
1. "Connect Bank Account" button opens Plaid Link (via `@plaid/link` or `react-plaid-link`)
2. On success: exchange public token → encrypt access token → store in bankAccounts
3. List connected accounts with: name, institution, last4, last sync date, status
4. "Disconnect" soft-deletes (isActive = false)
5. "Sync Now" button per account for on-demand refresh (REC-P0-002)

**Package to add:** `react-plaid-link` — Plaid Link React component

**Server actions:**
- `getBankAccounts(): Promise<BankAccountRow[]>`
- `addBankAccount(data): Promise<{id}>` — Encrypts access token, stores
- `deactivateBankAccount(id): Promise<void>`
- `triggerManualSync(bankAccountId): Promise<SyncResult>` — On-demand sync

---

### Step 6: Daily Plaid Sync Cron Job

**File to create:**
- `src/app/api/cron/plaid-sync/route.ts`

**File to modify:**
- `vercel.json` — Add cron entry: `{ "path": "/api/cron/plaid-sync", "schedule": "0 7 * * *" }` (7 AM UTC daily)

**Implementation (following ramp-sync/route.ts pattern):**
1. Verify `CRON_SECRET` bearer token
2. For each active bankAccount:
   a. Decrypt access token
   b. Call `syncTransactions()` with stored cursor
   c. Loop while `hasMore` is true
   d. Handle `added`: upsert bankTransactions (ON CONFLICT DO NOTHING via plaidTransactionId UNIQUE)
   e. Handle `modified`: update existing bank transactions
   f. Handle `removed`: delete bank transactions (or mark removed)
   g. Update cursor on bankAccount after successful sync
3. Handle pending-to-posted transitions (REC-P0-004, REC-P0-005):
   - Pending transactions: `isPending = true`
   - When Plaid reports removed+re-added as posted: update `isPending = false`
4. On failure: send Postmark alert (INT-P0-017), log error, continue with next account
5. Return summary: `{success, accountsSynced, transactionsAdded, transactionsModified, errors}`

**Full history rebuild (REC-P0-005):**
- First sync with `cursor = null` fetches all available history (up to 24 months)
- Starting balance = $0 per D-102 (accounts opened when company had $0)

---

### Step 7: Matching Engine

**File to create:**
- `src/lib/bank-rec/matcher.ts`

**Exported functions:**
- `findMatchCandidates(bankTransaction: BankTransactionRow): Promise<MatchCandidate[]>` — Core matching algorithm
- `applyMatchingRules(bankTransactionId: number): Promise<boolean>` — Check rules, auto-match if applicable
- `createMatch(params: CreateMatchParams): Promise<number>` — Creates match record, audit logs
- `createSplitMatches(params: SplitMatchParams): Promise<number[]>` — Split matching with sum validation
- `removeMatch(matchId: number, userId: string): Promise<void>` — Unmatch with audit

**Matching algorithm (REC-P0-007):**
1. Query unmatched GL transaction lines where:
   - Amount matches bank transaction amount exactly (absolute value comparison)
   - Sign alignment: bank outflow matches GL debit to cash; bank inflow matches GL credit to cash
   - GL transaction date within ±3 days of bank transaction date
   - GL transaction is not voided, not already fully matched
2. Score candidates:
   - Base score: 1.0 for exact amount + date match
   - Merchant name tiebreaker: +0.1 for merchant name substring match (case-insensitive) in GL memo or linked vendor name
   - Date proximity: +0.05 for same-day, +0.03 for ±1 day
3. Return sorted by score descending

**Rule matching (REC-P0-006, trust-escalation):**
1. For each matching rule, test criteria against bank transaction:
   - `merchantPattern`: case-insensitive substring or regex on merchantName
   - `amountExact`: exact match on amount (optional)
2. If rule matches AND rule is active: auto-create match using rule's action
3. Increment rule `hitCount`

**Split transaction support (REC-P0-008):**
- Validate: sum of split GL line amounts = bank transaction amount
- Create one `bankMatch` per split piece
- All splits linked to same `bankTransactionId`

---

### Step 8: GL-Only Categories & Outstanding Items

**File to create:**
- `src/lib/bank-rec/gl-only-categories.ts`

**Implementation (REC-P0-011):**
- Static configuration of GL entry sourceTypes that have no bank counterpart:
  ```
  SYSTEM (depreciation, net asset releases, interest accrual)
  FY25_IMPORT (opening balances)
  ```
- Plus specific account-based exclusions:
  - Entries to Accumulated Depreciation accounts
  - Entries to Net Assets With/Without Donor Restrictions
  - Entries to Accrued Interest Payable (accrual side)
  - AHP Loan Payable (forgiveness entries)
- Function: `isGlOnlyEntry(transaction: TransactionWithLines): boolean`
- Function: `getUnmatchedGlEntries(bankAccountId, dateRange): Promise<GlEntryRow[]>` — Filters out GL-only entries from "unmatched" list
- Function: `getOutstandingItems(bankAccountId, dateRange): Promise<OutstandingItem[]>` — GL entries with no bank match, not GL-only (REC-P0-012)

---

### Step 9: Reconciliation Session Management

**File to create:**
- `src/lib/bank-rec/reconciliation.ts`

**Exported functions:**
- `createReconciliationSession(params): Promise<{id}>` — New session (REC-P0-015)
- `getActiveSession(bankAccountId): Promise<ReconciliationSession | null>` — Find in-progress session
- `getReconciliationSummary(sessionId): Promise<ReconciliationSummary>` — Matched count, unmatched count, outstanding, variance
- `signOffReconciliation(sessionId, userId): Promise<void>` — Formal sign-off (REC-P0-013), records who + when + reconciled balance, audit logged
- `editReconciledItem(matchId, changes, changeNote, userId): Promise<void>` — Edit previously reconciled match with mandatory change note (REC-P0-013)
- `calculateReconciliationBalance(sessionId): Promise<{bankBalance, glBalance, variance, isReconciled}>` — Two-way balance check

**Reconciliation balance calculation (REC-P0-010):**
```
GL Balance = Sum of cash account GL entries through statement date
Bank Balance = Statement balance from session
Reconciling Items:
  + Outstanding deposits (GL entries with no bank match, inflow)
  - Outstanding checks (GL entries with no bank match, outflow)
  + Bank items not in GL (bank entries with no GL match, pending categorization)
Adjusted Bank Balance = Bank Balance ± Reconciling Items
Reconciled when: GL Balance = Adjusted Bank Balance
```

---

### Step 10: Reconciliation Workspace Page

**Files to create:**
- `src/app/(protected)/bank-rec/page.tsx` — Replace stub. Server page: fetch session data, bank accounts
- `src/app/(protected)/bank-rec/bank-rec-client.tsx` — Main client component
- `src/app/(protected)/bank-rec/actions.ts` — Server actions
- `src/app/(protected)/bank-rec/columns-bank.tsx` — Column defs for bank transactions table
- `src/app/(protected)/bank-rec/columns-gl.tsx` — Column defs for GL entries table
- `src/app/(protected)/bank-rec/components/` — Subdirectory for workspace components:
  - `bank-account-selector.tsx` — Dropdown to select account
  - `match-suggestion-panel.tsx` — Shows ranked match suggestions for selected bank txn
  - `confirm-match-dialog.tsx` — Confirm match + "Create rule?" prompt (trust-escalation)
  - `split-transaction-dialog.tsx` — Split bank transaction into parts
  - `inline-gl-entry-dialog.tsx` — Create GL entry from bank rec screen (REC-P0-009)
  - `reconciliation-summary.tsx` — Running totals, variance, status
  - `sign-off-dialog.tsx` — Formal reconciliation sign-off
  - `outstanding-items-panel.tsx` — GL entries without bank match
  - `ramp-cross-check.tsx` — Ramp settlement verification (REC-P0-014)
  - `pending-transactions.tsx` — Greyed-out pending items (REC-P0-004)

**Layout (design.md §5.4):**
```
┌─────────────────────────────────────────────────────────┐
│ Bank Account: [Checking ▾]  Session: [Jan 2026 ▾]      │
│ Statement Balance: $XX,XXX   GL Balance: $XX,XXX        │
│ Variance: $X,XXX            Status: In Progress         │
├────────────────────────┬────────────────────────────────┤
│  BANK TRANSACTIONS     │  GL ENTRIES                    │
│                        │                                │
│  ✓ Matched (collapsed) │  ✓ Matched (collapsed)         │
│  ⚠ Unmatched           │  ⚠ Unmatched                   │
│    → Suggested matches │    → Outstanding               │
│    → No match found    │    → GL-Only (auto-excluded)   │
│  ⏳ Pending (greyed)   │                                │
├────────────────────────┴────────────────────────────────┤
│ [Sync Now]  [Sign Off Reconciliation]                   │
└─────────────────────────────────────────────────────────┘
```

**Server actions (`actions.ts`):**
- `getBankAccountsForSelector(): Promise<BankAccountOption[]>`
- `getBankTransactions(bankAccountId, dateRange): Promise<BankTransactionRow[]>`
- `getMatchableGlEntries(bankAccountId, dateRange): Promise<GlEntryRow[]>`
- `getMatchSuggestions(bankTransactionId): Promise<MatchSuggestion[]>`
- `confirmMatch(bankTransactionId, glTransactionLineId, userId): Promise<void>`
- `splitAndMatch(bankTransactionId, splits, userId): Promise<void>`
- `rejectMatch(bankTransactionId, matchId, userId): Promise<void>`
- `markOutstanding(glTransactionLineId, sessionId, userId): Promise<void>`
- `createInlineGlEntry(data, bankTransactionId, userId): Promise<void>` — Creates GL entry + auto-matches
- `createMatchingRule(criteria, action, userId): Promise<void>`
- `getReconciliationSession(bankAccountId): Promise<SessionData>`
- `startReconciliationSession(bankAccountId, statementDate, statementBalance, userId): Promise<void>`
- `signOffReconciliation(sessionId, userId): Promise<void>`
- `triggerManualSync(bankAccountId, userId): Promise<SyncResult>`
- `getRampCrossCheck(periodStart, periodEnd, settlementAmount): Promise<CrossCheckResult>`

---

### Step 11: Inline GL Entry Creation (REC-P0-009)

**Implemented within:** `src/app/(protected)/bank-rec/components/inline-gl-entry-dialog.tsx`

**Behavior:**
1. User selects unmatched bank transaction (fee, interest, surprise ACH)
2. Opens dialog with:
   - Date pre-filled from bank transaction date
   - Amount pre-filled from bank transaction amount
   - Memo pre-filled from merchant name / description
   - Account selector (required)
   - Fund selector (required, defaults to General Fund)
3. Threshold prompt: if amount > configurable limit (default $500), show warning: "This bank-originated entry exceeds $[limit]. Confirm?"
4. On submit:
   a. Create GL entry via GL engine (`sourceType: 'BANK_FEED'`)
   b. Auto-create match between bank transaction and new GL entry
   c. Audit log both operations
5. Entry flagged as bank-originated in sourceReferenceId

---

### Step 12: Trust-Escalation Rule Creation

**Implemented within:** `confirm-match-dialog.tsx`

**Flow (design.md §5.4):**
1. User confirms a suggested match
2. Dialog asks: "Create a rule to auto-match similar transactions?"
   - Shows proposed rule criteria: merchant name pattern
   - Shows proposed action: GL account + fund (from the matched GL entry)
3. If user confirms: create `matchingRule` with criteria + action
4. Future syncs: `applyMatchingRules()` runs first, auto-matching before suggestions

---

### Step 13: Ramp Settlement Cross-Check (REC-P0-014)

**Existing foundation:** `src/lib/ramp/settlement-crosscheck.ts` — Already has `getRampSettlementSummary()`

**File to create within bank-rec components:** `ramp-cross-check.tsx`

**Implementation:**
1. When reconciling, user identifies the Ramp autopay settlement bank transaction
2. User marks it as "Ramp Settlement" (tags the bank transaction)
3. System calls `getRampSettlementSummary()` for the settlement period
4. Displays: Settlement amount vs. Sum of categorized Ramp transactions
5. If mismatch: flag with warning badge + variance amount
6. If match: green checkmark confirmation
7. Match the settlement bank transaction to the single GL entry for Credit Card Payable payment

---

### Step 14: Sync Failure Handling (INT-P0-017)

**File to create:**
- `src/lib/integrations/plaid-sync-notification.ts`

**Implementation (mirrors `ramp-sync-notification.ts`):**
- `sendPlaidSyncFailureEmail(error: string, bankAccountName?: string): Promise<void>`
- Uses Postmark template
- Sends to `ADMIN_EMAIL`
- Includes error details and bank account name

**Dashboard notification:**
- Bank rec workspace shows sync status per account
- Red badge if last sync > 36 hours ago or last sync failed
- Error message from last failed sync displayed

---

### Step 15: Help Tooltips for Bank Rec

**File to modify:**
- `src/lib/help/terms.ts` — Add bank reconciliation terms

**Terms to add:**
- `bank-reconciliation` — "Process of comparing bank statement transactions to GL entries to ensure they match and identify timing differences."
- `matching-rule` — "User-created rule that auto-matches future bank transactions to GL entries based on merchant name, amount, or other criteria."
- `outstanding-item` — "A GL entry (like an uncleared check) that has not yet appeared on the bank statement. Normal during reconciliation — resolves when the bank processes the transaction."
- `bank-originated-entry` — "A GL entry created directly from the bank reconciliation screen for items that appeared on the bank statement but have no corresponding GL entry (e.g., bank fees, interest credits)."
- `trust-escalation` — "Matching model where the system suggests matches, the user confirms, and can create rules for future auto-matching. Each confirmation builds the system's ability to auto-match."
- `reconciliation-sign-off` — "Formal confirmation that bank reconciliation is complete. Records who reconciled, when, and the reconciled balance for audit purposes."
- `plaid-sync` — "Daily automated download of bank transactions via the Plaid API. Transactions arrive in the reconciliation workspace for matching to GL entries."
- `split-transaction` — "When a single bank transaction corresponds to multiple GL entries (e.g., a combined payment), it can be split into parts, each matched to a different GL entry."
- `gl-only-entry` — "A GL entry with no expected bank counterpart (e.g., depreciation, net asset releases, interest accrual). Automatically excluded from unmatched warnings."
- `pending-transaction` — "A bank transaction that has been authorized but not yet fully processed. Shown as informational in reconciliation but cannot be matched until posted."

---

### Step 16: Copilot Context Update

**File to modify:**
- `src/lib/copilot/contexts/bank-rec.ts` — Enhance with actual data and tools

**Updates:**
- Add data: current session info, unmatched count, outstanding items, last sync status
- Add tools: search GL transactions by amount/date/memo, get matching rules, check Ramp settlement
- Add knowledge: `bank-reconciliation`, `trust-escalation`, `outstanding-item`

---

### Step 17: Unit Tests

**File to create:**
- `src/lib/bank-rec/matcher.test.ts`
- `src/lib/bank-rec/reconciliation.test.ts`
- `src/lib/encryption.test.ts`

**Test cases for matcher.test.ts:**
1. Exact amount match within ±3 days returns candidate
2. Amount match outside date window returns no candidate
3. Multiple candidates ranked by confidence score (merchant name tiebreaker)
4. Pending bank transactions excluded from matching
5. Already-matched GL entries excluded from candidates
6. Voided GL transactions excluded
7. GL-only entries (depreciation, system-generated) excluded
8. Split transaction validation: splits must sum to bank transaction amount
9. Split transaction rejection: sum mismatch throws error
10. Matching rule auto-applies correctly
11. Rule hitCount incremented on use

**Test cases for reconciliation.test.ts:**
1. Reconciliation balance calculation (GL vs bank with reconciling items)
2. Sign-off creates audit log entry
3. Edit reconciled item requires change note
4. Session persists across updates (in_progress → still in_progress)
5. Cannot sign off with unresolved variance

**Test cases for encryption.test.ts:**
1. Round-trip encrypt/decrypt returns original plaintext
2. Different IVs per encryption call
3. Decrypt fails with wrong key
4. Missing key throws descriptive error

---

### Step 18: E2E Test

**File to create:**
- `e2e/bank-reconciliation.spec.ts`

**Test flow:**
1. Navigate to bank rec settings, verify empty state
2. (Mock) Connect bank account via Plaid Link
3. Trigger manual sync (mock Plaid API response with 5 sample transactions)
4. Navigate to bank rec workspace
5. Verify bank transactions appear in left panel
6. Select an unmatched bank transaction → verify match suggestions appear
7. Confirm a match → verify "Create rule?" prompt
8. Create a rule → verify rule appears in rules list
9. Trigger another sync with a transaction matching the rule → verify auto-match
10. Create an inline GL entry for a bank fee → verify GL entry created + auto-matched
11. Verify pending transactions shown greyed out, not matchable
12. Start reconciliation session with statement balance
13. Complete all matches → sign off reconciliation
14. Verify audit log entries for all operations

---

## File Summary

### New Files (25)

| File | Purpose |
|------|---------|
| `src/lib/db/schema/bank-accounts.ts` | Bank accounts table definition |
| `src/lib/db/schema/bank-transactions.ts` | Bank transactions table definition |
| `src/lib/db/schema/bank-matches.ts` | Match records table definition |
| `src/lib/db/schema/matching-rules.ts` | Matching rules table definition |
| `src/lib/db/schema/reconciliation-sessions.ts` | Reconciliation sessions table definition |
| `src/lib/encryption.ts` | AES-256-GCM encrypt/decrypt for Plaid tokens |
| `src/lib/validators/bank-reconciliation.ts` | Zod schemas for bank rec inputs |
| `src/lib/integrations/plaid.ts` | Plaid API client wrapper |
| `src/lib/integrations/plaid-sync-notification.ts` | Plaid sync failure email alerts |
| `src/lib/bank-rec/matcher.ts` | Matching engine (candidates, rules, splits) |
| `src/lib/bank-rec/gl-only-categories.ts` | GL-only entry detection |
| `src/lib/bank-rec/reconciliation.ts` | Session management, sign-off, balance calc |
| `src/app/api/cron/plaid-sync/route.ts` | Daily Plaid sync cron job |
| `src/app/(protected)/bank-rec/page.tsx` | Main bank rec page (replace stub) |
| `src/app/(protected)/bank-rec/bank-rec-client.tsx` | Main client component |
| `src/app/(protected)/bank-rec/actions.ts` | Server actions for bank rec |
| `src/app/(protected)/bank-rec/columns-bank.tsx` | Bank transaction column definitions |
| `src/app/(protected)/bank-rec/columns-gl.tsx` | GL entry column definitions |
| `src/app/(protected)/bank-rec/settings/page.tsx` | Bank account settings page |
| `src/app/(protected)/bank-rec/settings/bank-accounts-client.tsx` | Bank accounts management UI |
| `src/app/(protected)/bank-rec/settings/connect-bank-dialog.tsx` | Plaid Link dialog |
| `src/app/(protected)/bank-rec/settings/actions.ts` | Bank account server actions |
| `src/app/(protected)/bank-rec/components/` | 10 workspace sub-components (see Step 10) |
| `src/lib/bank-rec/matcher.test.ts` | Matcher unit tests |
| `src/lib/bank-rec/reconciliation.test.ts` | Reconciliation unit tests |
| `src/lib/encryption.test.ts` | Encryption unit tests |
| `e2e/bank-reconciliation.spec.ts` | E2E test |

### Modified Files (6)

| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add 3 new enums (bankMatchType, reconciliationStatus, bankTransactionStatus) |
| `src/lib/db/schema/index.ts` | Export new tables, define relations |
| `src/lib/validators/index.ts` | Export bank reconciliation validators |
| `src/lib/help/terms.ts` | Add 10 bank reconciliation help terms |
| `src/lib/copilot/contexts/bank-rec.ts` | Enhance with real data and tools |
| `vercel.json` | Add plaid-sync cron entry |

### Package to Add (1)

| Package | Purpose |
|---------|---------|
| `react-plaid-link` | Plaid Link React component for bank account connection UI |

---

## Dependency Verification Checklist

Before starting, verify these Phase 5/8/9 outputs exist and work:

- [ ] GL engine creates transactions with `sourceType: 'BANK_FEED'` — `src/lib/gl/engine.ts`
- [ ] Audit logger works within db.transaction() — `src/lib/audit/logger.ts`
- [ ] `sourceTypeEnum` includes `BANK_FEED` — `src/lib/db/schema/enums.ts`
- [ ] `auditActionEnum` includes `signed_off` — `src/lib/db/schema/enums.ts`
- [ ] Ramp settlement cross-check foundation — `src/lib/ramp/settlement-crosscheck.ts`
- [ ] Ramp cron job pattern to follow — `src/app/api/cron/ramp-sync/route.ts`
- [ ] Transaction list page shows all transactions — `src/app/(protected)/transactions/`
- [ ] `plaid` package in dependencies — `package.json`
- [ ] Postmark notification pattern — `src/lib/integrations/ramp-sync-notification.ts`

---

## Build Order & Parallelization

```
Step 1 (Schema) ──────────────────────┐
Step 2 (Encryption) ──────────────────┤── Foundation (can run in parallel)
Step 3 (Validators) ──────────────────┘
         │
Step 4 (Plaid Client) ────────────────── depends on Step 2 (encryption)
         │
Step 5 (Bank Settings UI) ────────────── depends on Steps 1, 3, 4
Step 6 (Cron Job) ────────────────────── depends on Steps 1, 4
         │
Step 7 (Matching Engine) ─────────────┐
Step 8 (GL-Only Categories) ──────────┤── Core Logic (can run in parallel)
Step 9 (Reconciliation Sessions) ─────┘── depends on Step 1
         │
Step 10 (Workspace UI) ───────────────── depends on Steps 5-9 (all core logic)
Step 11 (Inline GL) ──────────────────── part of Step 10
Step 12 (Trust-Escalation) ───────────── part of Step 10
Step 13 (Ramp Cross-Check) ───────────── part of Step 10
         │
Step 14 (Sync Failure Handling) ──────── depends on Step 6
Step 15 (Help Tooltips) ──────────────── independent, can be done anytime
Step 16 (Copilot Context) ────────────── depends on Steps 7-9
         │
Step 17 (Unit Tests) ─────────────────── depends on Steps 2, 7, 9
Step 18 (E2E Test) ───────────────────── depends on all above
```

**Estimated build sequence:** Steps 1-3 → Steps 4-6 → Steps 7-9 → Steps 10-13 → Steps 14-18
