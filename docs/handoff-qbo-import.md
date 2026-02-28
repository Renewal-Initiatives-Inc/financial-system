# QBO Import — Progress Tracker

**Date:** 2026-02-28
**Status:** Per-line memo enrichment in progress. Next session starts here.

---

## Completed

- [x] **Plan cleanup** — Deleted 4 completed plan docs (verified against code)
- [x] **Migration 0018 applied to prod** — `import_review_items` table live in Neon
- [x] **QBO CSV parser updated** — BOM stripping, metadata row detection, summary row skipping, column aliases
- [x] **Account mapping complete** — 13 new QBO → GL account mappings added
- [x] **Insurance account renamed** — `5410` "Property Insurance" → "Insurance" (seed, reports, accrual adjustments)
- [x] **Dry run validated** — 39 transactions, $137,287.16, debits = credits, all mapped
- [x] **39 review items loaded to prod** — batch `import-1772304668229` in `import_review_items`
- [x] **Summary page updated** — shows QBO memo + vendor name per row instead of generic description
- [x] **Detail page updated** — QBO Source column + Memo column added to GL Mapping table

## In Progress — Per-Line Memo Enrichment

### The Problem
The Journal.csv only has ONE memo per transaction (e.g., "Website hosting" for a $629 transaction with 6 GL lines). Each line needs its own description to support IRS audit trail.

### The Solution
The `Renewal Initiatives_Transaction List by Date.csv` has per-line descriptions:
- "Domain name purchase" ($6.68, Technology/Software)
- "IRS 501c3 application" ($600, Taxes & Licenses)
- "Website hosting" ($19.13, Technology/Software)

### The Script
`src/lib/migration/enrich-line-memos.ts` — cross-walks Transaction List memos into `parsedData.lines[].lineMemo` on each review item. First run got 43/104 lines matched. Needs fixes:

**Issue 1: Double-consumption.** The Transaction List has ONE row per expense but Journal has TWO lines (DR + CR). The CR line (Employee Reimbursements Payable) matches first and consumes the row, leaving the DR line unmatched.
**Fix:** Match only against `accountFull` column (the expense/category side), not `accountName` (the payment side). The payment-side line can inherit its paired expense line's memo.

**Issue 2: Date mismatch.** Journal groups multiple expenses under one transaction date (e.g., all under 06/28) while Transaction List shows each with its actual date (07/01). Some lines are off by days.
**Fix:** Allow date tolerance (±14 days) or match without date — the combo of amount + expense account name is usually unique enough.

### After Enrichment
1. Update the UI Memo column to read `(line as any).lineMemo` instead of `parsedData.memo`
2. Ensure the per-line memo flows through to the GL transaction on approval (in `buildGlInput`)
3. Continue the interactive review at `/migration-review`

## After Review

- [ ] **Verification:** Trial Balance totals match QBO exports
- [ ] **Multi-source reconciliation** (QBO vs Plaid vs Ramp)
- [ ] **Neon branch snapshot** as resettable baseline
- [ ] **Commit all changes**

---

## Key Context

- **Cutoff date:** December 31, 2025
- **QBO Classes:** Ignored/stripped (Heather abandoned them; all default to General Fund)
- **AHP Fund:** Folds into General Fund per board resolution
- **Parallel run:** Heather entering in both QBO and new system for Jan-Feb 2026+
- **Bank recon:** Heather did on paper, not in QBO. Cross-check via Plaid data + Trial Balance.
- **No AR/AP aging:** Simplifies accrual conversion (no open receivables/payables)
- **Known accrual adjustment:** Prepaid insurance $501 (DR 1200 Prepaid / CR 5410 Insurance)
- **Pre-existing test failure:** `plaid-history-sync.test.ts` — `syncTransactions` signature changed for multi-account, test not updated. Unrelated.

## Files Modified This Session (Uncommitted)

### From prior session (still uncommitted):
- `src/lib/migration/qbo-csv-parser.ts` — BOM, metadata rows, summary rows, column aliases
- `src/lib/migration/__tests__/qbo-csv-parser.test.ts` — updated for skip behavior
- `src/lib/migration/account-mapping.ts` — 13 new QBO mappings
- `src/lib/db/seed/accounts.ts` — 5410 renamed to "Insurance"
- `src/lib/reports/property-expenses.ts` — Insurance rename
- `src/lib/migration/accrual-adjustments.ts` — Insurance rename
- 4 plan docs deleted

### This session:
- `src/app/(protected)/migration-review/migration-review-client.tsx` — summary table shows QBO memo + vendor
- `src/app/(protected)/migration-review/[id]/review-item-client.tsx` — GL Mapping table has QBO Source + Memo columns, parsedData prop added
- `src/lib/migration/enrich-line-memos.ts` — enrichment script (needs fixes per above)
- `docs/handoff-qbo-import.md` — this file

## QBO Export Files
Located at `docs/qbo-export-20251231/`:
- `Journal.csv` — **the import file** (bulk export, has Account column)
- `Renewal Initiatives_Journal.csv` — alternate export (has Class column, "Full name" for account)
- `Renewal Initiatives_Transaction List by Date.csv` — **per-line descriptions** (the enrichment source)
- `General_ledger.csv`, `Trial_balance.csv`, `Balance_sheet.csv`, `Profit_and_loss.csv` — verification
- `Vendors.csv` / `Vendors.xls` — vendor reference
- `Renewal Initiatives_Account List.csv` — QBO chart of accounts
- Missing (empty in QBO): customers, AR aging, AP aging, bank recon reports
