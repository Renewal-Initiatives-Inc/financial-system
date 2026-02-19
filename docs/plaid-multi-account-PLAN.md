# Plaid Multi-Account Support & Update Mode — Plan

**Status:** Code Complete — Awaiting Deploy
**Last Updated:** 2026-02-19
**Author:** Jeff + Claude
**Traces to:** INT-P0-013 (Bank Feed Integration), REC-P0-002 (Transaction Sync)

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/plaid-multi-account-PLAN.md Continue.`

---

## 1. Problem Statement

The Plaid integration assumes 1 Item = 1 bank account, but UMass Five returned 2 accounts (checking + savings) under one Item — causing mislabeled transactions, missing account discrimination, and no reconnection flow for broken connections.

---

## 2. Discovery

### Questions

1. How does Plaid `/transactions/sync` support per-account filtering?
2. How does Plaid update mode (re-auth) work?
3. What's the current schema's limitation for multi-account Items?
4. Which downstream code already scopes by `bankAccountId` (safe from this change)?
5. What data needs to be wiped before the fix?

### Responses

1. Pass `options: { account_id: "..." }` to `/transactions/sync` — creates independent per-account cursor, must start with `null` cursor when switching modes
2. Pass `access_token` (not `products`) to `/link/token/create` — frontend opens Link in re-auth mode, on success access_token stays the same, no token exchange needed
3. `bank_accounts` table has no `plaid_account_id` column — all accounts under one Item collapse to one row
4. Bank rec client, actions, matcher, reconciliation — all already filter by `bankAccountId` (no changes needed)
5. 1 `bank_accounts` row (id=1) and 7 mislabeled `bank_transactions` rows

### Synthesis

The fix requires: (a) schema column addition, (b) per-account sync filtering, (c) multi-account connect flow, (d) update mode for reconnection. All downstream bank rec code is already account-scoped and won't need changes.

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Add `plaid_account_id` column (nullable) to `bank_accounts` | Discriminates accounts within a single Plaid Item; nullable for backward compat |
| D2 | Unique index on `(plaid_item_id, plaid_account_id)` | Prevents duplicate account connections from the same Item |
| D3 | Open Plaid Link first, then show account assignment grid | Users shouldn't pick GL accounts before knowing what Plaid returns; multi-account assignment in one step |
| D4 | Exchange token ONCE, insert N rows sharing the same `plaid_access_token` + `plaid_item_id` | One Plaid Item = one access token, multiple account rows |
| D5 | Per-account cursor (not Item-level) | Plaid creates separate cursor per `account_id` filter — each `bank_accounts` row maintains its own cursor |
| D6 | Update mode uses existing access_token, no DB changes on success | Plaid's update flow restores the connection silently — no token rotation |
| D7 | Wipe existing data before migration | Current data is mislabeled (7 txns under wrong account) — cleaner than migration fixup |

---

## 4. Requirements

### P0: Must Have

| ID | Requirement |
|----|-------------|
| REQ-01 | `bank_accounts.plaid_account_id` column + unique index |
| REQ-02 | Connect flow opens Plaid Link first, then shows per-account GL assignment grid |
| REQ-03 | `addBankAccounts()` action — exchange once, insert N rows in a transaction |
| REQ-04 | `syncTransactions()` accepts `accountId` param for per-account filtering |
| REQ-05 | Cron and manual sync pass `plaidAccountId` to `syncTransactions()` |
| REQ-06 | `PlaidTransactionRecord` includes `plaidAccountId` field |
| REQ-07 | Wipe existing mislabeled data (1 account, 7 transactions) |

### P1: Nice to Have

| ID | Requirement |
|----|-------------|
| REQ-08 | "Reconnect" button on bank accounts list — opens Plaid Link in update mode |
| REQ-09 | `createUpdateLinkToken()` + `getUpdateLinkToken()` server action |

### P2: Future

| ID | Requirement |
|----|-------------|
| REQ-10 | Plaid webhook for `PENDING_EXPIRATION` / `ITEM_LOGIN_REQUIRED` to proactively flag stale connections |
| REQ-11 | `account_selection_enabled: true` in update mode to allow adding new accounts to existing Item |

---

## 5. Data Model

### Schema Change: `bank_accounts`

```
Current columns:
  id, name, institution, last_4, plaid_access_token, plaid_item_id,
  plaid_cursor, gl_account_id, is_active, created_at

+ plaid_account_id  VARCHAR(255)  NULLABLE
+ UNIQUE INDEX on (plaid_item_id, plaid_account_id)
```

### Migration 0008

```sql
ALTER TABLE "bank_accounts" ADD COLUMN "plaid_account_id" varchar(255);
CREATE UNIQUE INDEX "bank_accounts_item_account_idx"
  ON "bank_accounts" ("plaid_item_id", "plaid_account_id");
```

### Data Cleanup (pre-migration, against prod)

```sql
DELETE FROM bank_transactions WHERE bank_account_id = 1;
DELETE FROM bank_accounts WHERE id = 1;
```

---

## 6. Implementation Plan

### Phase 1: Schema + Data Cleanup

| Task | Status | Notes |
|------|--------|-------|
| Wipe prod data (SQL: delete txns + account id=1) | 🔲 | Manual SQL against Neon prod |
| Add `plaidAccountId` to `src/lib/db/schema/bank-accounts.ts` | 🔲 | Nullable varchar(255) |
| Add unique index on `(plaidItemId, plaidAccountId)` | 🔲 | In schema definition |
| Generate Drizzle migration (0008) | 🔲 | `npx drizzle-kit generate` |
| Apply migration to prod | 🔲 | `npx drizzle-kit push` or manual |
| Update `insertBankAccountSchema` validator if needed | 🔲 | `src/lib/validators.ts` |

### Phase 2: Plaid Client Updates

| Task | Status | Notes |
|------|--------|-------|
| `syncTransactions()` — add optional `accountId` param | 🔲 | `options: { account_id }` in request |
| `PlaidTransactionRecord` — add `plaidAccountId` field | 🔲 | From `txn.account_id` |
| `mapPlaidTransaction()` — extract `account_id` | 🔲 | Already in `rawData`, make explicit |
| Add `createUpdateLinkToken()` function | 🔲 | `access_token` instead of `products` |

### Phase 3: Connect Flow Redesign

| Task | Status | Notes |
|------|--------|-------|
| Redesign `connect-bank-dialog.tsx` — Link first, then account grid | 🔲 | Remove `select-account` step; add multi-account assignment |
| Account assignment UI — table with Name, Type, Last 4, GL dropdown | 🔲 | One row per `metadata.accounts[]` |
| New `addBankAccounts()` server action (plural) | 🔲 | Exchange once, insert N rows, audit log each |
| Keep old `addBankAccount()` or replace entirely | 🔲 | Replace — new flow supersedes |

### Phase 4: Sync Fix (Cron + Manual)

| Task | Status | Notes |
|------|--------|-------|
| Cron `plaid-sync/route.ts` — pass `account.plaidAccountId` to sync | 🔲 | Per-account cursor via `plaidAccountId` |
| Manual `triggerManualSync()` — same change | 🔲 | In `settings/actions.ts` |

### Phase 5: Update Mode (Reconnect)

| Task | Status | Notes |
|------|--------|-------|
| `getUpdateLinkToken()` server action | 🔲 | Fetch account → decrypt token → call `createUpdateLinkToken()` |
| "Reconnect" button in `bank-accounts-client.tsx` | 🔲 | Opens Plaid Link in update mode |
| Reconnect dialog/flow — success = toast, no DB changes | 🔲 | Inline in existing component or new dialog |

### Phase 6: Verification + Deploy

| Task | Status | Notes |
|------|--------|-------|
| `npx tsc --noEmit` — zero errors | 🔲 | |
| `npm run lint` — zero errors | 🔲 | |
| Deploy to Vercel | 🔲 | Push to main → auto-deploy |
| Connect UMass Five — verify both accounts in assignment step | 🔲 | Manual prod test |
| Assign GL accounts (1000=Checking, 1010=Savings) | 🔲 | Manual prod test |
| Trigger manual sync on each → verify correct transactions | 🔲 | Manual prod test |
| Test reconnect button opens Plaid Link in update mode | 🔲 | Manual prod test |

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/lib/db/schema/bank-accounts.ts` | Add `plaidAccountId` column + unique index |
| `drizzle/0008_*.sql` | New migration |
| `src/lib/integrations/plaid.ts` | `syncTransactions()` accountId param, `createUpdateLinkToken()`, `PlaidTransactionRecord.plaidAccountId`, `mapPlaidTransaction()` |
| `src/app/(protected)/bank-rec/settings/connect-bank-dialog.tsx` | Full redesign: Link first → account assignment grid → confirm |
| `src/app/(protected)/bank-rec/settings/actions.ts` | New `addBankAccounts()`, `getUpdateLinkToken()` actions; update `triggerManualSync()` |
| `src/app/(protected)/bank-rec/settings/bank-accounts-client.tsx` | Add "Reconnect" button |
| `src/app/api/cron/plaid-sync/route.ts` | Pass `plaidAccountId` to `syncTransactions()` |
| `src/lib/validators.ts` | Update schema if needed for new fields |

## 8. Files NOT Changing

| File | Reason |
|------|--------|
| `src/app/(protected)/bank-rec/bank-rec-client.tsx` | Already filters by `bankAccountId` |
| `src/app/(protected)/bank-rec/actions.ts` | Already scoped by `bankAccountId` |
| `src/lib/bank-rec/matcher.ts` | Already scoped by `bankAccountId` |
| `src/lib/bank-rec/reconciliation.ts` | Already scoped by `bankAccountId` |
| `src/lib/db/schema/bank-transactions.ts` | No changes needed |
| `src/lib/db/schema/reconciliation-sessions.ts` | No changes needed |

---

## 9. Key Plaid API Details

### Per-account sync (`/transactions/sync`)
```typescript
client.transactionsSync({
  access_token: accessToken,
  cursor: cursor ?? undefined,
  options: { account_id: plaidAccountId }  // NEW
})
```
- Creates separate cursor per account (independent from Item-level)
- Must start with `null` cursor when switching to per-account mode

### Update mode (`/link/token/create`)
```typescript
client.linkTokenCreate({
  user: { client_user_id: userId },
  client_name: 'Renewal Initiatives Finance',
  country_codes: [CountryCode.Us],
  language: 'en',
  access_token: accessToken,  // Pass this INSTEAD of products
})
```
- Frontend opens Link in re-auth mode
- On success: `access_token` stays the same, no token exchange

---

## 10. Session Progress

### Session 1: 2026-02-19 (Plan Creation)

**Completed:**
- [x] Created plan document with full discovery, design decisions, and implementation phases
- [x] Verified current schema, Plaid client, connect flow, sync code, and UI components
- [x] Confirmed downstream bank rec code is already account-scoped (no changes needed)
- [x] Identified migration will be 0008 (8 existing migrations: 0000–0007)

### Session 2: 2026-02-19 (Implementation)

**Completed:**
- [x] Phase 1: Schema — added `plaidAccountId` column + unique index, generated migration 0008
- [x] Phase 2: Plaid client — `syncTransactions()` accepts `accountId`, added `createUpdateLinkToken()`, `PlaidTransactionRecord.plaidAccountId`, updated `mapPlaidTransaction()`
- [x] Phase 3: Connect flow — full redesign: Plaid Link first → account assignment grid → confirm. New `addBankAccounts()` (plural) action. Wider dialog (640px) with table UI.
- [x] Phase 4: Sync fix — cron route and `triggerManualSync()` pass `plaidAccountId` to `syncTransactions()`
- [x] Phase 5: Update mode — `getUpdateLinkToken()` action, `ReconnectBankDialog` component, "Reconnect" button in bank accounts table
- [x] Phase 6: Verification — `tsc --noEmit` zero errors, `lint --quiet` zero errors
- [x] Fixed plaid-history-sync migration script to also pass `plaidAccountId`
- [x] Fixed test file (`plaid-history-sync.test.ts`) — added `plaidAccountId` to mock records
- [x] Fixed Plaid SDK type: `options.account_id` (singular string), not `account_ids` (array)

**Next Steps:**
- [ ] `/commit-phase` for git workflow
- [ ] Wipe prod data (manual SQL)
- [ ] Apply migration 0008 to prod
- [ ] Deploy + reconnect UMass Five
