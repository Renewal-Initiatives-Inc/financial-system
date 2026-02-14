# Phase 9: Ramp Credit Card Integration — Execution Plan

**Depends on:** Phase 5 (Manual Journal Entry & Transaction List) — **COMPLETE** ✅
**Source:** implementation_plan.md Section 11, design.md Section 2.8, requirements.md TXN-P0-024 through TXN-P0-028
**Estimated scope:** 2 new DB tables, 1 API client, 1 cron route, 3 UI pages, ~20 files

---

## Pre-Flight Checks

Before starting, verify:
- [ ] `RAMP` already exists in `sourceTypeEnum` in `src/lib/db/schema/enums.ts` — **confirmed**
- [ ] GL engine `createTransaction()` accepts `sourceType: 'RAMP'` — **confirmed**
- [ ] `Credit Card Payable` account exists in seed data (code lookup) — **verify at build time**
- [ ] Transaction list page shows Ramp badge in source type column — **confirmed** (columns.tsx has color-coded badges)

---

## Step 1: Database Schema — Ramp Tables

**Files to create:**
- `src/lib/db/schema/ramp-transactions.ts`
- `src/lib/db/schema/categorization-rules.ts`

**Files to modify:**
- `src/lib/db/schema/index.ts` — add exports + relations
- `src/lib/db/schema/enums.ts` — add `rampTransactionStatusEnum`

### 1a. New enum: `ramp_transaction_status`

```
pgEnum('ramp_transaction_status', ['uncategorized', 'categorized', 'posted'])
```

### 1b. `ramp_transactions` table

Per design.md Section 2.8:

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| ramp_id | varchar(255) | UNIQUE, NOT NULL — external Ramp transaction ID |
| date | varchar(10) | NOT NULL — YYYY-MM-DD |
| amount | numeric(15,2) | NOT NULL — always positive (Ramp amounts converted on sync) |
| merchant_name | varchar(500) | NOT NULL |
| description | text | nullable |
| cardholder | varchar(255) | NOT NULL |
| status | ramp_transaction_status | NOT NULL, default 'uncategorized' |
| gl_account_id | integer | FK → accounts, nullable (set on categorization) |
| fund_id | integer | FK → funds, nullable (set on categorization) |
| gl_transaction_id | integer | FK → transactions, nullable (set on GL posting) |
| categorization_rule_id | integer | FK → categorization_rules, nullable |
| synced_at | timestamp | NOT NULL, default now() |
| created_at | timestamp | NOT NULL, default now() |

**Indexes:** `ramp_id` (unique), `status`, `date`, `gl_transaction_id`

### 1c. `categorization_rules` table

| Column | Type | Constraints |
|--------|------|-------------|
| id | serial | PK |
| criteria | jsonb | NOT NULL — `{ merchantPattern?: string, descriptionKeywords?: string[] }` |
| gl_account_id | integer | FK → accounts, NOT NULL |
| fund_id | integer | FK → funds, NOT NULL |
| auto_apply | boolean | NOT NULL, default true |
| hit_count | integer | NOT NULL, default 0 |
| created_by | varchar(255) | NOT NULL |
| created_at | timestamp | NOT NULL, default now() |

**Indexes:** `auto_apply` (for quick filtering of active rules)

### 1d. Relations

- `rampTransactions` → `accounts` (via gl_account_id)
- `rampTransactions` → `funds` (via fund_id)
- `rampTransactions` → `transactions` (via gl_transaction_id)
- `rampTransactions` → `categorizationRules` (via categorization_rule_id)
- `categorizationRules` → `accounts` (via gl_account_id)
- `categorizationRules` → `funds` (via fund_id)

### 1e. Migration

Run `npx drizzle-kit generate` and `npx drizzle-kit push` to create tables in dev DB.

### Acceptance criteria:
- INV-009: `status = 'uncategorized'` transactions cannot have gl_transaction_id set
- Unique constraint on `ramp_id` prevents duplicate syncs

---

## Step 2: Zod Validators

**Files to create:**
- `src/lib/validators/ramp-transactions.ts`
- `src/lib/validators/categorization-rules.ts`

### 2a. Ramp transaction schemas

```typescript
// Insert schema (for sync upsert)
insertRampTransactionSchema = z.object({
  rampId: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().positive(),
  merchantName: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  cardholder: z.string().min(1).max(255),
})

// Categorize schema (for manual/auto categorization)
categorizeRampTransactionSchema = z.object({
  rampTransactionId: z.number().int().positive(),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
})

// Bulk categorize schema
bulkCategorizeSchema = z.object({
  rampTransactionIds: z.array(z.number().int().positive()).min(1),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
})
```

### 2b. Categorization rule schemas

```typescript
insertCategorizationRuleSchema = z.object({
  criteria: z.object({
    merchantPattern: z.string().min(1).optional(),
    descriptionKeywords: z.array(z.string()).optional(),
  }).refine(d => d.merchantPattern || d.descriptionKeywords?.length,
    { message: 'At least one criterion required' }),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  autoApply: z.boolean().default(true),
  createdBy: z.string().min(1),
})

updateCategorizationRuleSchema = insertCategorizationRuleSchema.partial().omit({ createdBy: true })
```

---

## Step 3: Ramp API Client

**File to create:** `src/lib/integrations/ramp.ts`

### 3a. Authentication

Ramp uses OAuth2 Client Credentials flow:
- `POST https://api.ramp.com/developer/v1/token` with `client_id` + `client_secret`
- Returns Bearer token with configurable scopes
- Required scope: `transactions:read`

**Environment variables:**
- `RAMP_CLIENT_ID` — OAuth2 client ID
- `RAMP_CLIENT_SECRET` — OAuth2 client secret
- `RAMP_BASE_URL` — defaults to `https://api.ramp.com` (allows staging override)

### 3b. Client functions

```typescript
// Token management
getAccessToken(): Promise<string>
  // Cache token in module scope, refresh when expired

// Transaction fetching
fetchTransactions(params?: {
  from_date?: string,     // ISO date
  to_date?: string,       // ISO date
  state?: 'CLEARED',      // Only cleared transactions
  start?: string,         // Cursor for pagination
  page_size?: number,     // Default 100
}): Promise<{ data: RampTransaction[], page: { next: string } }>

// Single transaction
fetchTransaction(transactionId: string): Promise<RampTransaction>
```

### 3c. Ramp API response mapping

Map Ramp API response to our schema:

| Ramp field | Our field | Notes |
|-----------|-----------|-------|
| `id` | `rampId` | External ID |
| `user_transaction_time` or `accounting_date` | `date` | Prefer user_transaction_time, fall back to accounting_date |
| `amount` | `amount` | Ramp returns negative for charges — take `Math.abs()`. Amount is in dollars (divide by `minor_unit_conversion_rate` if needed) |
| `merchant_name` | `merchantName` | Direct mapping |
| `memo` | `description` | Direct mapping, nullable |
| `card_holder.first_name + card_holder.last_name` | `cardholder` | Concatenate |
| `state` | — | Filter: only sync `CLEARED` and `COMPLETION` states, skip `PENDING`, `DECLINED`, `ERROR` |

### 3d. Error handling

- Network errors: catch and return descriptive error for dashboard notification
- 401 errors: clear cached token, retry once with fresh token
- Rate limits: respect `Retry-After` header if present
- All errors logged with timestamp for debugging

### Acceptance criteria:
- INT-P0-015: Daily polling via API client
- Client handles pagination (follow `page.next` until no more pages)
- Only cleared/completed transactions synced (pending excluded)

---

## Step 4: Daily Sync Cron Job

**File to create:** `src/app/api/cron/ramp-sync/route.ts`

### 4a. Route handler

```typescript
export async function POST(req: Request) {
  // 1. Verify CRON_SECRET header (Vercel cron security)
  // 2. Call Ramp API to fetch transactions since last sync
  // 3. For each transaction:
  //    a. Check if ramp_id already exists (skip if duplicate)
  //    b. Insert into ramp_transactions with status = 'uncategorized'
  //    c. Run auto-categorization rules (Step 5)
  // 4. Record sync result (count synced, count auto-categorized, errors)
  // 5. On error: send Postmark alert email (INT-P0-017)
  // 6. Return { success, synced, autoCategorized, errors }
}
```

### 4b. Sync strategy

- **Date window:** Fetch transactions from last 7 days (covers weekends, holidays, retries)
- **Dedup:** `ramp_id` UNIQUE constraint — use `ON CONFLICT DO NOTHING` for upsert
- **Last sync cursor:** Store nothing — idempotent by always fetching recent window and deduplicating via unique constraint. Simpler than cursor tracking for <1,000 txns/month.
- **Refunds:** Ramp API returns refunds as separate transactions with negative amounts. Store as-is — they'll be categorized separately. On GL posting, a refund creates the reverse entry (CR expense, DR Credit Card Payable).

### 4c. Error notification

On sync failure, send Postmark email to configured admin email:
- Subject: "Ramp sync failed — [date]"
- Body: error message, timestamp, retry info

**File to create:** `src/lib/integrations/ramp-sync-notification.ts` (or reuse a shared notification pattern if one exists)

### 4d. Vercel cron configuration

Add to `vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/ramp-sync",
    "schedule": "0 6 * * *"
  }]
}
```
Runs daily at 6 AM UTC (1 AM EST).

### Acceptance criteria:
- TXN-P0-024: Transactions synced daily via API
- INT-P0-017: Sync failures produce dashboard notification + email alert
- Duplicate prevention via ramp_id unique constraint
- Failed syncs retry on next daily poll (no data loss — transactions persist in Ramp)

---

## Step 5: Auto-Categorization Engine

**File to create:** `src/lib/ramp/categorization.ts`

### 5a. Rule matching logic

```typescript
matchRule(
  transaction: RampTransaction,
  rules: CategorizationRule[]
): CategorizationRule | null

// Matching algorithm:
// 1. Filter rules where auto_apply = true
// 2. For each rule, check criteria:
//    a. merchantPattern: case-insensitive substring match on merchant_name
//    b. descriptionKeywords: any keyword found in description (case-insensitive)
// 3. If multiple rules match, pick the one with highest hit_count (most used = most trusted)
// 4. Return matching rule or null
```

### 5b. Auto-categorize on sync

Called during the sync cron job for each new transaction:
1. Fetch all rules with `auto_apply = true`
2. Run `matchRule()` against new transaction
3. If match found:
   - Set `gl_account_id`, `fund_id`, `status = 'categorized'`, `categorization_rule_id`
   - Increment `hit_count` on the matched rule
4. If no match: leave as `uncategorized` (goes to manual queue)

### 5c. GL posting on categorization

```typescript
postCategorizedTransaction(rampTxnId: number, userId: string): Promise<TransactionResult>

// 1. Fetch ramp_transaction by ID
// 2. Verify status = 'categorized' (not already posted)
// 3. Determine GL entry direction:
//    - Positive amount (purchase): DR [Expense Account], CR Credit Card Payable
//    - Negative amount (refund):   DR Credit Card Payable, CR [Expense Account]
// 4. Call GL engine createTransaction():
//    - sourceType: 'RAMP'
//    - sourceReferenceId: ramp_id
//    - memo: "Ramp: {merchantName} - {description}"
//    - lines: [debit line, credit line]
//    - createdBy: userId (or 'system-ramp-auto' for auto-categorized)
// 5. Update ramp_transaction: status = 'posted', gl_transaction_id = result.id
// 6. Audit log entry created automatically by GL engine
```

### 5d. Batch posting

After sync + auto-categorization, batch-post all newly auto-categorized transactions:
- Query `ramp_transactions WHERE status = 'categorized' AND gl_transaction_id IS NULL`
- Post each in a loop (not a single DB transaction — each is independent)
- Log results

### Acceptance criteria:
- TXN-P0-026: User-defined auto-categorization rules apply to new transactions
- TXN-P0-027: On categorization: DR [GL Expense], CR Credit Card Payable
- INV-009: Only categorized transactions post to GL
- INV-008: Auto-categorized entries are NOT system-generated (user created the rule)

---

## Step 6: Categorization Queue UI

**Files to create:**
- `src/app/(protected)/expenses/ramp/page.tsx` — server component
- `src/app/(protected)/expenses/ramp/ramp-queue-client.tsx` — client component
- `src/app/(protected)/expenses/ramp/columns.tsx` — TanStack Table column defs
- `src/app/(protected)/expenses/ramp/actions.ts` — server actions
- `src/app/(protected)/expenses/ramp/categorize-dialog.tsx` — categorization modal
- `src/app/(protected)/expenses/ramp/bulk-categorize-dialog.tsx` — bulk action modal

### 6a. Queue page layout

**Route:** `/expenses/ramp`

**Header:** "Ramp Credit Card" with tabs:
- "Uncategorized" (default) — count badge
- "Categorized" (awaiting posting or recently posted)
- "All"

**Table columns (TanStack Table):**
| Column | Sortable | Notes |
|--------|----------|-------|
| Checkbox | — | For bulk selection |
| Date | Yes | Default sort descending |
| Merchant | Yes | |
| Amount | Yes | Formatted as currency |
| Description | No | Truncated with tooltip |
| Cardholder | Yes | |
| Status | Yes | Badge: uncategorized (yellow), categorized (blue), posted (green) |
| GL Account | No | Shows assigned account name or "—" |
| Fund | No | Shows assigned fund name or "—" |
| Actions | No | "Categorize" button for uncategorized rows |

**Bulk actions bar** (appears when rows selected):
- "Categorize Selected" — opens bulk categorize dialog
- Selection count indicator

### 6b. Categorization dialog

When user clicks "Categorize" on a row or "Categorize Selected" for bulk:

```
┌──────────────────────────────────────────┐
│  Categorize Ramp Transaction             │
│                                          │
│  Merchant: Home Depot                    │
│  Amount: $247.50                         │
│  Date: 2026-02-10                        │
│                                          │
│  GL Account: [Account Selector ▾]        │
│  Fund:       [Fund Selector ▾]           │
│                                          │
│  ☐ Always categorize "Home Depot" as     │
│    this account + fund                   │
│                                          │
│  [Cancel]  [Categorize & Post to GL]     │
└──────────────────────────────────────────┘
```

- **Account Selector:** Reuse existing `<AccountSelector>` component, filtered to expense accounts only
- **Fund Selector:** Reuse existing `<FundSelector>` component, default to General Fund
- **"Always categorize" checkbox:** If checked, creates a categorization rule on confirm (TXN-P0-026)
- **On submit:**
  1. Set `gl_account_id` + `fund_id` + `status = 'categorized'`
  2. Call `postCategorizedTransaction()` to create GL entry
  3. Optionally create categorization rule
  4. Show success toast
  5. Refresh table

### 6c. Server actions

```typescript
// Queries
getRampTransactions(filters: { status?, search?, dateFrom?, dateTo?, page? }): Promise<{ rows, total }>
getRampTransactionById(id: number): Promise<RampTransactionDetail | null>
getRampStats(): Promise<{ uncategorized: number, categorized: number, posted: number }>

// Mutations
categorizeRampTransaction(data: CategorizeInput, userId: string): Promise<void>
  // 1. Validate via Zod
  // 2. Update ramp_transaction: gl_account_id, fund_id, status = 'categorized'
  // 3. Call postCategorizedTransaction() to create GL entry
  // 4. revalidatePath

bulkCategorizeRampTransactions(data: BulkCategorizeInput, userId: string): Promise<{ succeeded: number, failed: number }>
  // Loop through IDs, categorize + post each
  // Return success/failure counts

triggerRampSync(userId: string): Promise<{ synced: number, autoCategorized: number }>
  // Manual "Sync Now" button — calls same logic as cron job
```

### Acceptance criteria:
- TXN-P0-024: Uncategorized queue visible, user can categorize
- TXN-P0-025: AI auto-suggestion based on merchant patterns (via rule matching — if a rule exists for this merchant, pre-select its account/fund)
- TXN-P0-028: No approval workflow — GL posting immediate on categorization

---

## Step 7: Rule Management UI

**Files to create:**
- `src/app/(protected)/expenses/ramp/rules/page.tsx`
- `src/app/(protected)/expenses/ramp/rules/rules-client.tsx`
- `src/app/(protected)/expenses/ramp/rules/columns.tsx`
- `src/app/(protected)/expenses/ramp/rules/actions.ts`
- `src/app/(protected)/expenses/ramp/rules/create-rule-dialog.tsx`
- `src/app/(protected)/expenses/ramp/rules/edit-rule-dialog.tsx`

### 7a. Rules page layout

**Route:** `/expenses/ramp/rules`

**Table columns:**
| Column | Notes |
|--------|-------|
| Merchant Pattern | From criteria.merchantPattern |
| Description Keywords | From criteria.descriptionKeywords, comma-separated |
| GL Account | Account name |
| Fund | Fund name |
| Auto-Apply | Toggle badge (on/off) |
| Hit Count | Number of times rule matched |
| Created By | User who created the rule |
| Actions | Edit, Delete (with confirmation) |

### 7b. Create/Edit rule dialog

```
┌──────────────────────────────────────────┐
│  Create Categorization Rule              │
│                                          │
│  Merchant Pattern: [____________]        │
│  (matches transactions containing this)  │
│                                          │
│  Description Keywords:                   │
│  [keyword1] [keyword2] [+ Add]           │
│                                          │
│  GL Account: [Account Selector ▾]        │
│  Fund:       [Fund Selector ▾]           │
│                                          │
│  ☑ Auto-apply to new transactions        │
│                                          │
│  [Cancel]  [Save Rule]                   │
└──────────────────────────────────────────┘
```

### 7c. Server actions for rules

```typescript
getCategorizationRules(): Promise<CategorizationRuleWithDetails[]>
createCategorizationRule(data: InsertCategorizationRule): Promise<{ id: number }>
updateCategorizationRule(id: number, data: UpdateCategorizationRule): Promise<void>
deleteCategorizationRule(id: number): Promise<void>
```

### Acceptance criteria:
- TXN-P0-026: Rules managed, toggled, deleted
- Rule hit count visible for trust assessment

---

## Step 8: Ramp Settlement Cross-Check (Foundation)

**File to create:** `src/lib/ramp/settlement-crosscheck.ts`

This is a utility function used during bank reconciliation (Phase 12), but the data layer ships now.

### 8a. Cross-check query

```typescript
getRampSettlementSummary(periodStart: string, periodEnd: string): Promise<{
  totalCategorized: number,  // Sum of categorized+posted Ramp txns in period
  transactionCount: number,  // Count of Ramp txns in period
}>
```

When bank rec arrives (Phase 12), this is compared against the Ramp autopay settlement amount that hits the bank. Mismatch triggers a warning.

### Acceptance criteria:
- REC-P0-014: Data available for bank rec cross-check

---

## Step 9: Sync Status Dashboard Widget (Foundation)

**File to modify:** `src/app/(protected)/(dashboard)/page.tsx` (or wherever the dashboard alerts section will live)

For now, add a lightweight query that Phase 17 (Dashboard) can consume:

**File to create:** `src/lib/ramp/status.ts`

```typescript
getRampSyncStatus(): Promise<{
  lastSyncAt: Date | null,
  uncategorizedCount: number,
  syncHealthy: boolean,  // true if lastSyncAt within 36 hours
}>
```

This powers the "Alerts/Attention" dashboard section (unmatched/uncategorized Ramp transactions).

---

## Step 10: Navigation & Layout Updates

**Files to modify:**
- `src/components/layout/nav-items.ts` — add Expenses > Ramp nav item + Rules sub-item
- `src/app/(protected)/expenses/layout.tsx` — create if not exists (expenses section layout)

### Navigation structure:
```
Expenses
  ├── Ramp Credit Card     → /expenses/ramp
  └── Ramp Rules           → /expenses/ramp/rules
```

Add badge count for uncategorized transactions on the "Ramp Credit Card" nav item.

---

## Step 11: Help Tooltips

**File to modify:** `src/lib/help/terms.ts`

Add entries for:
- **"Categorization"** — "Assigning a GL account and fund to a Ramp credit card transaction so it can be posted to the general ledger."
- **"Auto-Categorization Rule"** — "A pattern-matching rule that automatically assigns GL account and fund to Ramp transactions based on merchant name or description keywords."
- **"Credit Card Payable"** — "Liability account tracking the balance owed on the Ramp credit card. Increases when expenses are categorized, decreases when Ramp autopay settlement clears the bank."

---

## Step 12: Unit Tests

**Files to create:**
- `src/lib/ramp/categorization.test.ts`
- `src/lib/integrations/ramp.test.ts`
- `src/lib/ramp/settlement-crosscheck.test.ts`

### 12a. Categorization rule matching tests

```
✓ matchRule returns null when no rules exist
✓ matchRule matches on merchant pattern (case-insensitive)
✓ matchRule matches on description keywords
✓ matchRule prefers highest hit_count when multiple rules match
✓ matchRule ignores rules with auto_apply = false
✓ matchRule handles empty description gracefully
✓ matchRule with partial merchant name matches (substring)
```

### 12b. GL entry generation tests

```
✓ postCategorizedTransaction creates correct debit/credit for purchase
✓ postCategorizedTransaction creates correct debit/credit for refund (negative amount)
✓ postCategorizedTransaction sets sourceType = RAMP
✓ postCategorizedTransaction sets sourceReferenceId to ramp_id
✓ postCategorizedTransaction rejects uncategorized transaction (INV-009)
✓ postCategorizedTransaction rejects already-posted transaction
✓ Categorization of restricted fund expense triggers net asset release (INV-007)
```

### 12c. Settlement cross-check tests

```
✓ getRampSettlementSummary returns correct totals for date range
✓ getRampSettlementSummary excludes uncategorized transactions
✓ getRampSettlementSummary handles empty period
```

### 12d. Ramp API client tests (mocked)

```
✓ fetchTransactions handles pagination (multiple pages)
✓ fetchTransactions maps Ramp response to internal format
✓ fetchTransactions handles negative amounts (refunds)
✓ fetchTransactions skips PENDING and DECLINED transactions
✓ getAccessToken caches token and refreshes on expiry
✓ getAccessToken retries once on 401
✓ Sync handles duplicate ramp_ids gracefully (upsert)
```

---

## Step 13: E2E Tests

**File to create:** `tests/e2e/ramp-categorization.spec.ts`

### Test scenarios:

```
✓ Ramp queue page loads and shows uncategorized transactions
✓ User categorizes a single transaction — GL entry created
✓ User bulk-categorizes multiple transactions
✓ "Always categorize" checkbox creates a rule
✓ Rule management: create, edit, toggle auto-apply, delete
✓ Categorized transaction appears in transaction list with RAMP badge
✓ Manual "Sync Now" button triggers sync (mock Ramp API)
```

**Mocking strategy:** Mock the Ramp API client at the integration boundary (`src/lib/integrations/ramp.ts`) for E2E tests. Seed test database with sample ramp_transactions records.

---

## File Summary

### New files (19):

| # | File | Purpose |
|---|------|---------|
| 1 | `src/lib/db/schema/ramp-transactions.ts` | Ramp transactions table definition |
| 2 | `src/lib/db/schema/categorization-rules.ts` | Categorization rules table definition |
| 3 | `src/lib/validators/ramp-transactions.ts` | Zod schemas for Ramp transactions |
| 4 | `src/lib/validators/categorization-rules.ts` | Zod schemas for categorization rules |
| 5 | `src/lib/integrations/ramp.ts` | Ramp API client (auth, fetch transactions) |
| 6 | `src/lib/integrations/ramp-sync-notification.ts` | Postmark alert on sync failure |
| 7 | `src/lib/ramp/categorization.ts` | Rule matching + GL posting logic |
| 8 | `src/lib/ramp/settlement-crosscheck.ts` | Settlement summary for bank rec |
| 9 | `src/lib/ramp/status.ts` | Sync health status query |
| 10 | `src/app/api/cron/ramp-sync/route.ts` | Daily sync cron job |
| 11 | `src/app/(protected)/expenses/ramp/page.tsx` | Categorization queue (server) |
| 12 | `src/app/(protected)/expenses/ramp/ramp-queue-client.tsx` | Categorization queue (client) |
| 13 | `src/app/(protected)/expenses/ramp/columns.tsx` | TanStack Table columns |
| 14 | `src/app/(protected)/expenses/ramp/actions.ts` | Server actions |
| 15 | `src/app/(protected)/expenses/ramp/categorize-dialog.tsx` | Single categorization modal |
| 16 | `src/app/(protected)/expenses/ramp/bulk-categorize-dialog.tsx` | Bulk categorization modal |
| 17 | `src/app/(protected)/expenses/ramp/rules/page.tsx` | Rule management page |
| 18 | `src/app/(protected)/expenses/ramp/rules/rules-client.tsx` | Rule management client |
| 19 | `src/app/(protected)/expenses/ramp/rules/columns.tsx` | Rule table columns |
| 20 | `src/app/(protected)/expenses/ramp/rules/actions.ts` | Rule server actions |
| 21 | `src/app/(protected)/expenses/ramp/rules/create-rule-dialog.tsx` | Create/edit rule dialog |

### Modified files (4):

| # | File | Change |
|---|------|--------|
| 1 | `src/lib/db/schema/enums.ts` | Add `rampTransactionStatusEnum` |
| 2 | `src/lib/db/schema/index.ts` | Export new tables + relations |
| 3 | `src/components/layout/nav-items.ts` | Add Expenses > Ramp nav items |
| 4 | `src/lib/help/terms.ts` | Add Ramp-related help tooltip entries |

### Test files (4):

| # | File |
|---|------|
| 1 | `src/lib/ramp/categorization.test.ts` |
| 2 | `src/lib/integrations/ramp.test.ts` |
| 3 | `src/lib/ramp/settlement-crosscheck.test.ts` |
| 4 | `tests/e2e/ramp-categorization.spec.ts` |

---

## Requirements Satisfied

| Requirement | Description | How |
|-------------|-------------|-----|
| TXN-P0-024 | Ramp transactions synced daily, land in uncategorized queue | Cron job + ramp_transactions table |
| TXN-P0-025 | AI auto-suggestion for categorization | Rule matching engine + pre-fill in dialog |
| TXN-P0-026 | User-defined auto-categorization rules | categorization_rules table + "Always categorize" prompt |
| TXN-P0-027 | On categorization: DR Expense, CR Credit Card Payable | GL engine call in postCategorizedTransaction |
| TXN-P0-028 | No approval workflow for Ramp — GL posting immediate | Direct post on categorize, no pending state |
| INV-009 | Uncategorized Ramp excluded from financials | status gate — only 'posted' have gl_transaction_id |
| INV-011 | Transaction source provenance | sourceType = 'RAMP', sourceReferenceId = ramp_id |
| INV-012 | Audit log on every GL write | Automatic via GL engine |
| INT-P0-015 | Ramp REST API daily polling | Cron + API client |
| INT-P0-017 | Sync failure notification | Postmark email on error |
| REC-P0-014 | Ramp settlement cross-check (foundation) | settlement-crosscheck.ts query |

---

## Execution Order

Recommended build sequence (each step builds on the previous):

1. **Schema + validators** (Steps 1-2) — foundation, no dependencies
2. **Ramp API client** (Step 3) — can test against real Ramp API independently
3. **Categorization engine** (Step 5) — pure logic, testable with unit tests
4. **Cron job** (Step 4) — wires client + engine together
5. **Server actions** (from Steps 6-7) — data access layer for UI
6. **Categorization queue UI** (Step 6) — main user-facing page
7. **Rule management UI** (Step 7) — secondary page
8. **Cross-check + status queries** (Steps 8-9) — lightweight, no UI
9. **Nav + tooltips** (Steps 10-11) — polish
10. **Tests** (Steps 12-13) — validate everything

---

## Environment Variables Required

| Variable | Purpose | Set in |
|----------|---------|--------|
| `RAMP_CLIENT_ID` | Ramp OAuth2 client ID | Vercel env vars |
| `RAMP_CLIENT_SECRET` | Ramp OAuth2 client secret | Vercel env vars |
| `RAMP_BASE_URL` | API base URL (default: `https://api.ramp.com`) | Vercel env vars (optional) |
| `CRON_SECRET` | Vercel cron job authentication | Vercel env vars |

---

## Open Questions / Build-Time Decisions

1. **Ramp API access:** Need to create a developer app in Ramp dashboard with `transactions:read` scope. Jeff to provide API credentials before build.
2. **Credit Card Payable account ID:** Verify the seed account code for "Credit Card Payable" — the GL posting needs this account ID. Look up from seed data at runtime by name/code.
3. **Refund handling:** Ramp returns refunds as separate transactions with original_transaction_amount. Do we need to link refunds to their original purchase? For v1: no — treat as independent transactions with negative amounts. Track if this becomes a user need.
4. **Amount format:** Verify Ramp's `amount` field — is it in dollars or cents? The API uses `minor_unit_conversion_rate` which suggests cents. Confirm during build and adjust mapping accordingly.
