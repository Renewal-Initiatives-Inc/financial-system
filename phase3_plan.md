# Phase 3: GL Engine & Audit Logging — Execution Plan

**Goal:** Build the central GL write path that every transaction — manual, automated, or integrated — flows through. Every write operation produces audit trail entries.

**Depends on:** Phase 2 (schema, seed data, validators) — verified complete.

---

## Phase 2 Verification Checklist

Before executing, confirm these Phase 2 artifacts are in place:

- [x] 7 tables defined: `accounts`, `funds`, `transactions`, `transaction_lines`, `cip_cost_codes`, `audit_log` + enums
- [x] Drizzle relations defined in `src/lib/db/schema/index.ts`
- [x] Zod validators: `insertTransactionSchema`, `transactionLineSchema`, `editTransactionSchema`, `insertAuditLogSchema`
- [x] Seed data: 69 accounts (with CIP parent/child + building pairs), 6 funds, 17 cost codes
- [x] Net Asset accounts: code `3000` (Without Donor Restrictions), code `3100` (With Donor Restrictions)
- [x] DB client in `src/lib/db/index.ts` (Neon HTTP + Drizzle with proxy pattern)
- [x] `npm run db:push` and `npm run db:seed` scripts ready

---

## Architecture Overview

```
External callers (API routes, cron jobs, staging processor, Ramp categorizer)
  │
  ▼
┌────────────────────────────────────────────────┐
│  GL Engine  (src/lib/gl/engine.ts)              │
│                                                 │
│  createTransaction(input) → Transaction         │
│  editTransaction(id, updates, userId) → Txn     │
│  reverseTransaction(id, userId) → Txn           │
│  voidTransaction(id, userId) → void             │
│                                                 │
│  Validation pipeline:                           │
│    1. Zod schema validation                     │
│    2. Balance check (INV-001)                   │
│    3. Account existence + active (INV-002/004)  │
│    4. Fund existence (INV-003)                  │
│    5. Source provenance (INV-011)               │
│    6. Restricted fund → auto-release (INV-007)  │
│    7. System-generated flag (INV-008)           │
│                                                 │
│  All operations wrapped in DB transaction       │
│  All operations call audit logger               │
└────────────────────────────────────────────────┘
  │
  ▼
┌────────────────────────────────────────────────┐
│  Audit Logger  (src/lib/audit/logger.ts)        │
│                                                 │
│  logAudit({ userId, action, entityType,         │
│    entityId, beforeState?, afterState,           │
│    metadata? }) → void                          │
│                                                 │
│  Append-only INSERT to audit_log table          │
└────────────────────────────────────────────────┘
```

---

## Step-by-Step Execution Plan

### Step 1: Audit Logger (`src/lib/audit/logger.ts`)

**Why first:** The GL engine calls the audit logger on every operation. Build the dependency first.

**Create file:** `src/lib/audit/logger.ts`

```typescript
// Key exports:
logAudit(params: AuditLogParams): Promise<void>
// Where AuditLogParams matches insertAuditLogSchema input
```

**Implementation details:**
- Import `db` from `@/lib/db` and `auditLog` from `@/lib/db/schema`
- Import and use `insertAuditLogSchema` for input validation
- Single INSERT into `audit_log` table
- Never throws on audit failure — log to console.error and continue (audit should not block transactions, but this is a tradeoff we should document)
- Actually: **audit failure SHOULD throw** in this system because audit is the compensating control (INV-012). If audit fails, the transaction must not commit. The audit INSERT will be part of the same DB transaction as the GL write.

**Type definitions:**
```typescript
type AuditLogParams = {
  userId: string
  action: 'created' | 'updated' | 'voided' | 'reversed' | 'deactivated' | 'signed_off' | 'imported' | 'posted'
  entityType: string  // 'transaction' | 'account' | 'fund' | etc.
  entityId: number
  beforeState?: Record<string, unknown> | null
  afterState: Record<string, unknown>
  metadata?: Record<string, unknown> | null
}
```

**Key design decision:** The audit logger is a thin wrapper around an INSERT. It does NOT use its own DB transaction — it participates in the caller's transaction. The GL engine passes its Drizzle transaction context to the logger.

---

### Step 2: GL Engine — Core `createTransaction` (`src/lib/gl/engine.ts`)

**Create file:** `src/lib/gl/engine.ts`

This is the central write path. Every transaction in the system flows through this function.

**Function signature:**
```typescript
export async function createTransaction(
  input: InsertTransaction,
  txContext?: DrizzleTransaction  // optional: for wrapping in caller's transaction
): Promise<TransactionResult>
```

**Validation pipeline (in order):**

1. **Zod validation** — Parse input through `insertTransactionSchema`. This catches:
   - Missing required fields
   - Invalid source_type enum values
   - Lines with both debit and credit (or neither)
   - Fewer than 2 lines
   - Unbalanced debits/credits (INV-001)

2. **Account validation (INV-002 + INV-004)** — For each line, query `accounts` table:
   - Account must exist → error: "Account ID {id} does not exist"
   - Account must be active (`isActive = true`) → error: "Account {code} ({name}) is inactive"
   - Batch query: single SELECT with `WHERE id IN (...)` for all unique account IDs in the transaction

3. **Fund validation (INV-003)** — For each line, query `funds` table:
   - Fund must exist → error: "Fund ID {id} does not exist"
   - Batch query: single SELECT with `WHERE id IN (...)` for all unique fund IDs

4. **Source provenance (INV-011)** — `sourceType` and `sourceReferenceId` set from input, immutable after creation

5. **Restricted fund detection (INV-007)** — For each line where:
   - The line has a **debit** (expense side)
   - The account type is `EXPENSE`
   - The fund's `restrictionType` is `RESTRICTED`
   → Generate a net asset release entry with the same amount:
   - DR `Net Assets With Donor Restrictions` (code `3100`)
   - CR `Net Assets Without Donor Restrictions` (code `3000`)
   - Same fund as the triggering line
   - These release lines are added to a **separate transaction** (linked via metadata, `isSystemGenerated = true`, source_type = `SYSTEM`)

6. **System-generated flag (INV-008)** — If `isSystemGenerated = true`, set on the transaction header. These entries cannot be edited later.

**Database write (single Drizzle transaction):**
```
BEGIN
  INSERT INTO transactions → get new transaction ID
  INSERT INTO transaction_lines (batch) → all lines with transaction_id
  INSERT INTO audit_log → 'created' action with full transaction as afterState

  IF restricted fund release needed:
    INSERT INTO transactions → release transaction (isSystemGenerated = true)
    INSERT INTO transaction_lines → release lines (DR 3100, CR 3000)
    INSERT INTO audit_log → 'created' action for release transaction
COMMIT
```

**Return type:**
```typescript
type TransactionResult = {
  transaction: {
    id: number
    date: string
    memo: string
    sourceType: string
    lines: Array<{
      id: number
      accountId: number
      fundId: number
      debit: string | null
      credit: string | null
      cipCostCodeId: number | null
      memo: string | null
    }>
  }
  releaseTransaction?: TransactionResult['transaction']  // if INV-007 fired
}
```

**Important: Neon HTTP driver limitation.** The Neon serverless HTTP driver (`@neondatabase/serverless` with `neon()`) does NOT support interactive transactions (`db.transaction()`). For atomic multi-table writes, we have two options:

- **Option A:** Switch to Neon WebSocket driver (`@neondatabase/serverless` with `Pool` + `drizzle-orm/neon-serverless`) which supports real transactions
- **Option B:** Use raw SQL `BEGIN/COMMIT/ROLLBACK` via the HTTP driver

**Recommended: Option A.** Add `ws` package for local dev, configure Neon Pool for transaction support. This is a one-time infrastructure change that benefits all future phases. Create a `src/lib/db/transaction.ts` utility that provides the transaction context.

---

### Step 3: GL Engine — Account & Fund Lookup Helpers (`src/lib/gl/lookups.ts`)

**Create file:** `src/lib/gl/lookups.ts`

Shared lookup functions used by the GL engine and correction functions.

```typescript
// Batch-fetch accounts by ID, return map for O(1) lookup
export async function getAccountsById(ids: number[]): Promise<Map<number, Account>>

// Batch-fetch funds by ID, return map for O(1) lookup
export async function getFundsById(ids: number[]): Promise<Map<number, Fund>>

// Get the two net asset accounts (3000 and 3100) — cached after first call
export async function getNetAssetAccounts(): Promise<{
  unrestricted: Account  // code 3000
  restricted: Account     // code 3100
}>

// Get a transaction with all its lines and related data
export async function getTransactionWithLines(id: number): Promise<TransactionWithLines | null>
```

These helpers keep the main engine.ts focused on business logic.

---

### Step 4: GL Engine — Transaction Corrections

Add three correction functions to `src/lib/gl/engine.ts`:

#### 4a. `editTransaction` (INV-006 — unmatched only)

```typescript
export async function editTransaction(
  id: number,
  updates: EditTransaction,
  userId: string
): Promise<TransactionResult>
```

**Guards:**
- Transaction must exist → error: "Transaction {id} not found"
- Transaction must NOT be voided → error: "Cannot edit a voided transaction"
- Transaction must NOT be system-generated (INV-008) → error: "System-generated transactions cannot be edited"
- Transaction must NOT be bank-matched (INV-006) → error: "Bank-matched transactions cannot be edited; use reversal instead"
  - **Note:** Bank matching doesn't exist yet (Phase 12). For now, this check is a no-op but the guard structure is in place. We'll add the `matches` table check when Phase 12 ships.
- Transaction must NOT have been reversed → error: "Reversed transactions cannot be edited"

**On success:**
- Capture before_state (full transaction + lines)
- If lines provided: DELETE existing lines, INSERT new lines (within same DB transaction)
- If date/memo provided: UPDATE transaction header
- Audit log: action = 'updated', before_state and after_state both populated

#### 4b. `reverseTransaction` (INV-006 — for matched transactions)

```typescript
export async function reverseTransaction(
  id: number,
  userId: string
): Promise<TransactionResult>
```

**Implementation:**
- Fetch original transaction with lines
- Transaction must exist, not be voided, not already reversed
- Create new transaction with:
  - `reversalOfId` = original transaction ID
  - `sourceType` = original's sourceType
  - `memo` = "Reversal of: {original memo}"
  - `createdBy` = userId
  - Lines: swap debits/credits from original (debit → credit, credit → debit, same accounts/funds)
- UPDATE original transaction: set `reversedById` = new transaction ID
- Audit log:
  - 'reversed' action on original transaction
  - 'created' action on new reversal transaction

#### 4c. `voidTransaction`

```typescript
export async function voidTransaction(
  id: number,
  userId: string
): Promise<void>
```

**Implementation:**
- Transaction must exist, not already voided
- UPDATE transaction: set `isVoided = true`
- Audit log: action = 'voided', beforeState shows `isVoided: false`, afterState shows `isVoided: true`

---

### Step 5: GL Engine — Types & Errors (`src/lib/gl/types.ts`, `src/lib/gl/errors.ts`)

**Create file:** `src/lib/gl/types.ts`
```typescript
// TransactionResult — returned by createTransaction, editTransaction, reverseTransaction
// TransactionWithLines — internal type for fetched transactions
// TransactionLineWithRelations — line with account/fund names
```

**Create file:** `src/lib/gl/errors.ts`
```typescript
// GLValidationError — base class for all GL validation errors
// UnbalancedTransactionError — INV-001
// InvalidAccountError — INV-002/004
// InvalidFundError — INV-003
// ImmutableTransactionError — INV-006 (matched), INV-008 (system-generated)
// VoidedTransactionError — attempt to edit/reverse a voided transaction
// AlreadyReversedError — attempt to reverse an already-reversed transaction
```

Custom error classes with descriptive messages. All extend a base `GLError` class so callers can catch GL-specific errors.

---

### Step 6: Database Transaction Support (`src/lib/db/transaction.ts`)

**Create file:** `src/lib/db/transaction.ts`

The current `db/index.ts` uses Neon HTTP driver which may not support `db.transaction()`. We need to verify and potentially add transaction support.

**Approach:** Check if `drizzle-orm/neon-http` supports `db.transaction()`. According to Drizzle docs, `neon-http` DOES support `db.transaction()` via Neon's HTTP transaction API (batched queries). This should work without switching drivers.

**If HTTP transactions work:** No new file needed. Use `db.transaction(async (tx) => { ... })` directly.

**If HTTP transactions don't work:** Create a WebSocket-based transaction utility:
```typescript
import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import ws from 'ws'

export async function withTransaction<T>(
  fn: (tx: DrizzleTransaction) => Promise<T>
): Promise<T>
```

**Resolution:** Test during Step 2 implementation. If `db.transaction()` works with Neon HTTP, we're done. If not, implement the Pool-based fallback.

---

### Step 7: GL Engine — Fund Restriction Logic (`src/lib/gl/restricted-fund-release.ts`)

**Create file:** `src/lib/gl/restricted-fund-release.ts`

Encapsulates INV-007 logic separately for clarity and testability.

```typescript
export function detectRestrictedFundExpenses(
  lines: TransactionLine[],
  accountMap: Map<number, Account>,
  fundMap: Map<number, Fund>
): RestrictedFundExpense[]

export function buildReleaseLines(
  expenses: RestrictedFundExpense[],
  netAssetAccounts: { unrestricted: Account; restricted: Account }
): TransactionLine[]
```

**Logic:**
1. For each input line, check if:
   - `line.debit != null` (it's a debit — expense side)
   - `accountMap.get(line.accountId).type === 'EXPENSE'`
   - `fundMap.get(line.fundId).restrictionType === 'RESTRICTED'`
2. If all three conditions met → add to release list
3. For each restricted expense, create two release lines:
   - DR `Net Assets With Donor Restrictions` (3100), same fund, amount = expense debit
   - CR `Net Assets Without Donor Restrictions` (3000), same fund, amount = expense debit
4. Multiple restricted expenses in the same transaction produce one consolidated release per fund (sum amounts, one DR/CR pair per fund)

**Edge case:** What if a single transaction has expenses across multiple restricted funds? Each fund gets its own release pair. A transaction with $100 expense to AHP Fund and $200 expense to CPA Fund produces:
- Release 1: DR 3100 $100 (AHP Fund), CR 3000 $100 (AHP Fund)
- Release 2: DR 3100 $200 (CPA Fund), CR 3000 $200 (CPA Fund)

---

### Step 8: Soft-Delete Pattern (INV-013) — Account & Fund Deactivation

**Create file:** `src/lib/gl/deactivation.ts`

```typescript
export async function deactivateAccount(
  accountId: number,
  userId: string
): Promise<void>

export async function deactivateAccount — guards:
  - Must exist
  - Must not be system-locked → error: "System-locked accounts cannot be deactivated"
  - Must not have non-zero balance → error: "Account has a balance of ${amount}; zero out before deactivating"
  - Actually: per DM-P0-003, accounts with history can be deactivated (they retain history). The requirement is they "cannot be deleted" — deactivation IS the soft-delete.
  - Correction: accounts with history CAN be deactivated. The only guard is system_locked.

export async function deactivateFund(
  fundId: number,
  userId: string
): Promise<void>

deactivateFund — guards:
  - Must exist
  - Must not be system-locked → error: "System-locked funds cannot be deactivated"
  - Must have zero balance (DM-P0-007) → calculate fund balance from transaction_lines
  - Audit log: action = 'deactivated'
```

**Fund balance calculation query:**
```sql
SELECT
  COALESCE(SUM(debit), 0) - COALESCE(SUM(credit), 0) as net_debit
FROM transaction_lines tl
JOIN transactions t ON tl.transaction_id = t.id
WHERE tl.fund_id = :fundId
  AND t.is_voided = false
```

If `net_debit != 0`, the fund has a non-zero balance and cannot be deactivated.

---

### Step 9: GL Engine Index (`src/lib/gl/index.ts`)

**Create file:** `src/lib/gl/index.ts`

Clean re-export of all public GL engine functions:
```typescript
export { createTransaction, editTransaction, reverseTransaction, voidTransaction } from './engine'
export { deactivateAccount, deactivateFund } from './deactivation'
export { logAudit } from '../audit/logger'
export * from './types'
export * from './errors'
```

---

### Step 10: Unit Tests (`src/lib/gl/engine.test.ts`)

**Create file:** `src/lib/gl/engine.test.ts`

This is a comprehensive test file. Tests use **mocked database** — we mock Drizzle queries/inserts to test business logic without a live DB connection.

**Test categories:**

#### 10a. createTransaction — happy path
1. **Balanced entry succeeds** — 2-line entry, DR/CR equal, returns transaction with ID and lines
2. **Multi-line entry succeeds** — 4-line entry (2 DR, 2 CR) balancing to same total
3. **Multi-fund entry succeeds** — lines coded to different funds, all valid
4. **CIP cost code on CIP sub-account line** — line with account 1510 (CIP Hard Costs) + cipCostCodeId passes
5. **Source provenance set correctly** — verify sourceType and sourceReferenceId on created transaction
6. **System-generated flag** — isSystemGenerated = true sets correctly
7. **Audit log created** — verify logAudit called with action='created' and correct afterState

#### 10b. createTransaction — validation failures
8. **Unbalanced entry rejected (INV-001)** — debits ≠ credits → UnbalancedTransactionError
9. **Single line rejected** — fewer than 2 lines → Zod validation error
10. **Inactive account rejected (INV-004)** — account with isActive=false → InvalidAccountError
11. **Nonexistent account rejected (INV-002)** — account ID not in DB → InvalidAccountError
12. **Invalid fund rejected (INV-003)** — fund ID not in DB → InvalidFundError
13. **Both debit and credit on one line** — caught by Zod schema
14. **Neither debit nor credit on one line** — caught by Zod schema
15. **Negative amount** — caught by Zod schema
16. **Missing memo** — caught by Zod schema

#### 10c. Restricted fund auto-release (INV-007)
17. **Expense to restricted fund triggers release** — DR Expense to restricted fund → auto-generates release transaction (DR 3100, CR 3000)
18. **Release transaction is system-generated** — verify isSystemGenerated=true on release
19. **Release uses same fund as triggering expense** — fund_id on release lines matches expense fund
20. **Release amount matches expense amount** — dollar-for-dollar
21. **Multiple restricted expenses in one transaction** — one release per fund
22. **Non-expense debit to restricted fund does NOT trigger release** — DR Asset to restricted fund → no release (only EXPENSE type triggers)
23. **Credit to restricted fund does NOT trigger release** — CR Expense (refund scenario) → no release
24. **Expense to unrestricted fund does NOT trigger release** — General Fund expense → no release

#### 10d. editTransaction
25. **Edit unmatched transaction succeeds** — update memo, verify before/after in audit
26. **Edit with new lines succeeds** — replace lines, verify old lines removed
27. **Edit voided transaction rejected** — VoidedTransactionError
28. **Edit system-generated transaction rejected (INV-008)** — ImmutableTransactionError
29. **Edit reversed transaction rejected** — ImmutableTransactionError
30. **Edit records before/after in audit log** — verify both states captured

#### 10e. reverseTransaction
31. **Reversal creates linked entry** — reversalOfId set, reversedById set on original
32. **Reversal has opposite amounts** — original DR becomes CR, original CR becomes DR
33. **Reversal memo references original** — "Reversal of: {original memo}"
34. **Reversal audit logged on both transactions** — 'reversed' on original, 'created' on reversal
35. **Cannot reverse already-reversed transaction** — AlreadyReversedError
36. **Cannot reverse voided transaction** — VoidedTransactionError

#### 10f. voidTransaction
37. **Void sets isVoided=true** — verify flag set
38. **Void audit logged** — action='voided' with before/after
39. **Cannot void already-voided transaction** — error
40. **Voided transactions excluded from GL totals** — (this is a query concern, but verify the flag is set correctly for downstream consumers)

#### 10g. Deactivation
41. **Deactivate non-locked account succeeds** — isActive set to false, audit logged
42. **Deactivate system-locked account rejected** — error
43. **Deactivate fund with zero balance succeeds** — isActive set to false
44. **Deactivate fund with non-zero balance rejected** — error with balance amount
45. **Deactivate system-locked fund rejected** — error

---

### Step 11: Restricted Fund Release Unit Tests (`src/lib/gl/restricted-fund-release.test.ts`)

**Create file:** `src/lib/gl/restricted-fund-release.test.ts`

Focused tests on the release detection and line-building logic (pure functions, no DB mocking needed):

1. Single expense line to restricted fund → one release pair
2. Multiple expenses to same restricted fund → consolidated release pair
3. Multiple expenses to different restricted funds → separate release pair per fund
4. Mixed restricted/unrestricted lines → release only for restricted
5. Non-expense accounts to restricted fund → no release
6. Credit lines (not debit) → no release
7. Edge case: $0.01 expense → $0.01 release

---

### Step 12: Audit Logger Unit Tests (`src/lib/audit/logger.test.ts`)

**Create file:** `src/lib/audit/logger.test.ts`

1. Valid audit entry inserts correctly
2. beforeState null for creation events
3. beforeState populated for update events
4. All action types accepted
5. Metadata field optional

---

## File Summary

| # | File | Action | Purpose |
|---|------|--------|---------|
| 1 | `src/lib/audit/logger.ts` | CREATE | Append-only audit log writer |
| 2 | `src/lib/gl/types.ts` | CREATE | Type definitions for GL engine |
| 3 | `src/lib/gl/errors.ts` | CREATE | Custom error classes |
| 4 | `src/lib/gl/lookups.ts` | CREATE | Account/fund/transaction lookup helpers |
| 5 | `src/lib/gl/restricted-fund-release.ts` | CREATE | INV-007 net asset release logic |
| 6 | `src/lib/gl/engine.ts` | CREATE | Core GL engine (create/edit/reverse/void) |
| 7 | `src/lib/gl/deactivation.ts` | CREATE | Soft-delete for accounts and funds |
| 8 | `src/lib/gl/index.ts` | CREATE | Public API re-exports |
| 9 | `src/lib/audit/logger.test.ts` | CREATE | Audit logger tests |
| 10 | `src/lib/gl/engine.test.ts` | CREATE | GL engine tests (45 tests) |
| 11 | `src/lib/gl/restricted-fund-release.test.ts` | CREATE | Release logic tests (7 tests) |
| 12 | `src/lib/db/index.ts` | MODIFY | Add transaction support if needed |

---

## Requirements Satisfied

| Requirement ID | Description | How Satisfied |
|----------------|-------------|---------------|
| INV-001 | Double-entry balance | Zod schema refinement + GL engine validation |
| INV-002 | Valid account reference | Batch account lookup before insert |
| INV-003 | Valid fund reference | Batch fund lookup before insert |
| INV-004 | Active account constraint | Account isActive check in validation |
| INV-006 | Transaction correction rules | editTransaction guards (unmatched only), reverseTransaction, voidTransaction |
| INV-007 | Restricted fund auto-release | detectRestrictedFundExpenses + buildReleaseLines |
| INV-008 | System-generated entry flag | isSystemGenerated on auto-entries, edit guard |
| INV-011 | Transaction source provenance | sourceType/sourceReferenceId set at creation |
| INV-012 | Immutable audit log | Append-only INSERT via logAudit, within same DB transaction |
| INV-013 | No deletions (soft delete) | deactivateAccount/deactivateFund with guards |
| TXN-P0-003 | Fund coding warning | Default to General Fund handled at UI layer (Phase 5), GL engine requires fund_id |

---

## Invariants NOT in Phase 3 Scope

| Invariant | Reason | When |
|-----------|--------|------|
| INV-005 | Fund restriction immutability | Enforced at schema level (no UPDATE on restriction_type) — already handled by Zod updateFundSchema omitting restrictionType |
| INV-009 | Ramp posting gate | Phase 9 (Ramp integration) |
| INV-010 | Fund-level trial balance | Reporting concern (Phase 15) — enforced by INV-001 at transaction level |
| INV-014 | No approval workflows | Architectural decision, not code — transactions post immediately |
| INV-015 | Accrual basis | Enforced by how transactions are created (caller responsibility), not engine logic |

---

## Execution Order

```
Step 1:  src/lib/gl/types.ts          (types first, no deps)
Step 2:  src/lib/gl/errors.ts         (error classes, no deps)
Step 3:  src/lib/audit/logger.ts      (audit writer, depends on schema)
Step 4:  src/lib/gl/lookups.ts        (DB queries, depends on schema)
Step 5:  src/lib/gl/restricted-fund-release.ts  (pure logic, depends on types)
Step 6:  src/lib/gl/engine.ts         (core engine, depends on 1-5)
Step 7:  src/lib/gl/deactivation.ts   (account/fund guards, depends on lookups + audit)
Step 8:  src/lib/gl/index.ts          (re-exports)
Step 9:  src/lib/audit/logger.test.ts (audit tests)
Step 10: src/lib/gl/restricted-fund-release.test.ts (release logic tests)
Step 11: src/lib/gl/engine.test.ts    (comprehensive GL engine tests)
Step 12: Verify db.transaction() works with Neon HTTP — adapt if needed
```

---

## Testing Strategy

**Unit tests mock the database layer.** We do NOT require a running Neon database for unit tests. Instead:

- Mock `db.insert()`, `db.select()`, `db.update()`, `db.transaction()` via `vi.mock('@/lib/db')`
- Mock return values for account/fund lookups
- Verify the correct Drizzle calls are made with correct arguments
- Test pure logic functions (restricted fund detection, balance calculation) without mocks

**Integration tests (deferred to Step 12 / CI):** Run against the dev Neon database to verify actual SQL behavior, CHECK constraints, FK constraints, and transaction atomicity. These are slower and run in CI only.

---

## Acceptance Criteria

Phase 3 is complete when:

1. `createTransaction` accepts valid input and returns a transaction with ID and lines
2. `createTransaction` rejects unbalanced entries with a descriptive error (INV-001)
3. `createTransaction` rejects inactive accounts (INV-004) and invalid funds (INV-003)
4. Expenses to restricted funds automatically generate net asset release entries (INV-007)
5. Release entries are system-generated and linked to the triggering transaction via metadata
6. `editTransaction` works for unmatched transactions with full audit trail (INV-006)
7. `editTransaction` rejects system-generated transactions (INV-008)
8. `reverseTransaction` creates a properly linked reversal entry
9. `voidTransaction` sets the voided flag and is audit-logged
10. Every GL operation produces an audit log entry with before/after state (INV-012)
11. All 45+ unit tests pass
12. No TypeScript errors (`npm run type-check` passes)

---

## Open Questions to Resolve During Execution

1. **Neon HTTP transaction support** — Does `db.transaction()` work with `drizzle-orm/neon-http`? Test early in Step 6. If not, add WebSocket Pool driver.
2. **Release transaction linking** — The release entry needs to reference the triggering transaction. Use `sourceReferenceId` = `"release-for:{originalTxnId}"` and `sourceType = SYSTEM`. This keeps the link without schema changes.
3. **Fund balance calculation for deactivation** — Need to decide: do we sum ALL transaction_lines for the fund, or only non-voided transactions? Answer: non-voided only (voided transactions are excluded from GL totals per INV-006).
