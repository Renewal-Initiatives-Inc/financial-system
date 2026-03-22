# Phase: Invoice-to-Payment Matching

## Summary

| # | Task | Requirements |
|---|------|-------------|
| 1 | Schema migration: simplify invoice status enum + add bank linkage | TXN-P0-029, DM-P0-024 |
| 2 | Code cleanup: strip manual status toggling | TXN-P0-029 |
| 3 | Invoice matcher module with vendor fuzzy matching | TXN-P0-029, REC-P0-006 |
| 4 | Integrate invoice matching into bank rec classification | TXN-P0-029, REC-P0-006 |
| 5 | Invoice match confirmation action (clearing JE + status update) | TXN-P0-029, DM-P0-024 |
| 6 | Bank rec UI: invoice match suggestions | TXN-P0-029, REC-P0-006 |

## Dependencies

- [x] Phase 11 (Bank Reconciliation) — matcher.ts, bank_matches table, tier classification
- [x] Phase 14 (Purchase Orders & Invoicing) — invoices table, PO workflow
- [x] Phase 22 (Go-Live) — Plaid sync live, bank transactions flowing in
- [ ] PO-1 test invoice exists in DB (created by user — will be used for smoke testing)

---

## Tasks

### Task 1: Schema migration — simplify invoice status enum + add bank linkage

**What:** Migrate the `invoice_payment_status` enum from 5 values to 2 (POSTED, PAID), and add columns to link invoices to bank transactions and the clearing GL entry.

**Files:**
- Create: `src/lib/db/migrations/0029_invoice_payment_simplify.sql`
- Modify: `src/lib/db/schema/enums.ts` — update invoicePaymentStatusEnum to ['POSTED', 'PAID']
- Modify: `src/lib/db/schema/invoices.ts` — add `bankTransactionId` (FK → bankTransactions), `clearingTransactionId` (FK → transactions), `paidAt` (timestamp)

**AC:**
- [ ] Migration renames enum values: PENDING → POSTED, PAYMENT_IN_PROCESS → POSTED, MATCHED_TO_PAYMENT → POSTED (all collapse to POSTED; any already PAID stay PAID)
- [ ] Migration adds `bank_transaction_id`, `clearing_transaction_id`, `paid_at` columns to invoices table (all nullable)
- [ ] Migration removes unused enum values from PostgreSQL enum type
- [ ] Drizzle schema matches migration (invoicePaymentStatusEnum has exactly ['POSTED', 'PAID'])
- [ ] `npx drizzle-kit generate` produces no diff after migration + schema update

---

### Task 2: Code cleanup — strip manual status toggling

**What:** Remove the `markPaymentInProcess` server action and the "Mark Payment In Process" button from the PO detail UI. Update `createInvoice` to set initial status as POSTED (skip PENDING).

**Files:**
- Modify: `src/app/(protected)/expenses/actions.ts` — remove `markPaymentInProcess()` function; update `createInvoice()` to set paymentStatus directly to 'POSTED' (remove PENDING intermediate)
- Modify: `src/app/(protected)/expenses/purchase-orders/[id]/po-detail-client.tsx` — remove the "Mark Payment In Process" button and its handler; remove `paymentStatusLabels` entries for deleted statuses
- Modify: `src/lib/reports/activities.ts` — if any references to PAYMENT_IN_PROCESS or MATCHED_TO_PAYMENT, update to use simplified statuses

**AC:**
- [ ] No references to `PENDING`, `PAYMENT_IN_PROCESS`, or `MATCHED_TO_PAYMENT` remain in codebase (except migration SQL)
- [ ] `createInvoice()` sets `paymentStatus: 'POSTED'` immediately (no PENDING state)
- [ ] PO detail invoice table no longer shows status-change action buttons
- [ ] Invoice table still shows payment status badge (POSTED or PAID)
- [ ] TypeScript compiles cleanly (`npx tsc --noEmit`)

---

### Task 3: Invoice matcher module with vendor fuzzy matching

**What:** Create a new module that finds outstanding invoices matching a bank transaction by amount, vendor name (fuzzy), date proximity, and description. This runs as the "step 1" quick-check before normal GL matching.

**Files:**
- Create: `src/lib/bank-rec/invoice-matcher.ts`

**Logic:**
```
getOutstandingInvoices():
  SELECT invoices + vendor name + PO number
  WHERE paymentStatus = 'POSTED' (i.e., unpaid)

matchBankTransactionToInvoices(bankTxn):
  1. Quick check: any outstanding invoices? If none → return empty (skip to GL matching)
  2. For each outstanding invoice:
     a. Amount score (40%): exact match (±$0.01) = 100, else 0
     b. Vendor score (30%): normalize both strings (lowercase, strip LLC/Inc/Corp,
        collapse whitespace/punctuation) → Jaro-Winkler similarity
     c. Date score (15%): days between bank txn date and invoice date,
        decay over 30 days (invoices may be paid weeks later)
     d. Description score (15%): Jaro-Winkler of bank description vs PO description
  3. Compute composite score, filter ≥ 60
  4. Return ranked candidates with invoice details (invoice #, PO #, vendor, amount)
```

**AC:**
- [ ] `getOutstandingInvoices()` returns invoices with status POSTED, joined to vendor name and PO number
- [ ] `matchBankTransactionToInvoices()` returns empty array immediately when no outstanding invoices exist (fast path)
- [ ] Vendor fuzzy matching: "EXPENSES R US LLC" matches "Expenses-R-Us" with score ≥ 80
- [ ] Amount must be exact (±$0.01) for any candidate to score above threshold
- [ ] Candidates returned with: invoiceId, purchaseOrderId, poNumber, vendorName, invoiceAmount, invoiceDate, confidenceScore, matchReason (human-readable)
- [ ] Unit tests cover: exact match, fuzzy vendor match, no-invoices fast path, amount mismatch rejection

---

### Task 4: Integrate invoice matching into bank rec classification

**What:** Modify the bank rec classification flow so that invoice matching runs first (when outstanding invoices exist), then normal GL matching runs as usual. Invoice match suggestions are stored on the bank transaction for UI consumption.

**Files:**
- Modify: `src/lib/bank-rec/matcher.ts` — in `classifyBankTransactions()` and `reclassifyUnmatched()`, call invoice matcher before GL matching
- Modify: `src/lib/db/schema/bank-transactions.ts` — add `suggestedInvoiceId` (FK → invoices), `invoiceMatchConfidence` (numeric) columns

**Logic:**
```
classifyBankTransactions(bankAccountId):
  // Existing: fetch unmatched bank transactions

  // NEW: Step 1 — invoice pre-check
  outstandingInvoices = getOutstandingInvoices()
  if (outstandingInvoices.length > 0):
    for each unmatched bank txn:
      invoiceCandidates = matchBankTransactionToInvoices(bankTxn)
      if (best candidate score ≥ 60):
        bankTxn.suggestedInvoiceId = candidate.invoiceId
        bankTxn.invoiceMatchConfidence = candidate.score
        bankTxn.suggestedReason = "Matches Invoice #{X} on PO-{Y} (vendor: {Z})"

  // Step 2 — normal GL matching (runs for ALL transactions, including those with invoice suggestions)
  // ... existing GL matching logic unchanged ...
```

**AC:**
- [ ] Migration adds `suggested_invoice_id` and `invoice_match_confidence` to bank_transactions
- [ ] When no outstanding invoices exist, zero additional queries are executed (fast path verified)
- [ ] Invoice suggestions don't block or replace GL suggestions — both can coexist on a bank transaction
- [ ] `suggestedInvoiceId` is populated during Plaid sync classification
- [ ] Reclassify flow also runs invoice matching

---

### Task 5: Invoice match confirmation action (clearing JE + status update)

**What:** Create a server action that, when the user confirms an invoice match, automatically creates the clearing journal entry (DR AP / CR Cash), updates the invoice to PAID, and links everything together.

**Files:**
- Create or modify: `src/app/(protected)/bank-rec/actions.ts` — add `confirmInvoiceMatch()` server action

**Logic:**
```
confirmInvoiceMatch(bankTransactionId, invoiceId, userId):
  1. Fetch invoice (with PO details: fund, GL account)
  2. Validate: invoice.paymentStatus === 'POSTED' (not already paid)
  3. Fetch bank account → get checking GL account ID
  4. Create clearing GL transaction via createTransaction():
     - date: bank transaction date
     - memo: "Payment: Invoice #{X} / PO-{Y} — {vendor name}"
     - sourceType: 'BANK_MATCH'
     - lines:
       - DR Accounts Payable (2000) | fund from invoice | invoice amount
       - CR Checking account | fund from invoice | invoice amount
  5. Update invoice:
     - paymentStatus → 'PAID'
     - bankTransactionId → bankTransactionId
     - clearingTransactionId → new GL transaction ID
     - paidAt → now()
  6. Create bank match record (bankMatches table):
     - bankTransactionId → bankTransactionId
     - glTransactionLineId → the cash line from the clearing JE
     - matchType → 'manual' (user confirmed)
     - confirmedBy → userId
     - confirmedAt → now()
  7. Audit log the confirmation
  8. Revalidate bank-rec and PO detail pages
```

**AC:**
- [ ] Clearing JE creates balanced 2-line entry: DR AP (2000) / CR Cash (checking account)
- [ ] Invoice status updated to PAID with bankTransactionId and clearingTransactionId populated
- [ ] Bank match record created linking bank transaction to clearing JE cash line
- [ ] Cannot confirm match on an already-PAID invoice (validation error)
- [ ] GL transaction date matches the bank transaction date (not today's date)
- [ ] Fund on clearing JE lines matches the fund from the original invoice
- [ ] Soft lock warning surfaced if bank transaction date falls in a locked fiscal year
- [ ] Revalidates `/bank-rec` and `/expenses/purchase-orders/[id]` paths

---

### Task 6: Bank rec UI — invoice match suggestions

**What:** Surface invoice match suggestions in the bank rec review UI. When a bank transaction has a `suggestedInvoiceId`, show an invoice match card above the normal GL match suggestion, with a "Confirm Invoice Match" button.

**Files:**
- Modify: `src/app/(protected)/bank-rec/bank-reconcile-client.tsx` — add invoice match rendering in Tier 2 review
- Modify: `src/app/(protected)/bank-rec/columns-bank.tsx` — add invoice match indicator column/badge
- Create: `src/app/(protected)/bank-rec/components/invoice-match-card.tsx` — card component showing invoice details + confirm button

**UI:**
```
┌─────────────────────────────────────────────────────┐
│ 🧾 Invoice Match Suggested (87% confidence)         │
│                                                     │
│ Invoice #INV-001 on PO-1 • Expenses-R-Us • $210.00 │
│ Invoice date: 2026-03-21                            │
│                                                     │
│ [Confirm Match]  [Dismiss]                          │
└─────────────────────────────────────────────────────┘
│ (normal GL match suggestions below, if any)         │
```

**AC:**
- [ ] Invoice match card appears above GL suggestions when `suggestedInvoiceId` is set
- [ ] Card shows: invoice number, PO number, vendor name, amount, invoice date, confidence score
- [ ] "Confirm Match" calls `confirmInvoiceMatch()` and shows success toast
- [ ] "Dismiss" clears the `suggestedInvoiceId` on the bank transaction (does not block GL matching)
- [ ] After confirmation, bank transaction moves to matched state and invoice shows PAID in PO detail
- [ ] If invoice was already paid by another match, card shows "Already paid" instead of confirm button

---

## Tests

| Test | File | Verifies |
|------|------|---------|
| Invoice matcher: exact match | `src/lib/bank-rec/invoice-matcher.test.ts` | Amount + vendor + date scoring produces correct composite |
| Invoice matcher: fuzzy vendor | `src/lib/bank-rec/invoice-matcher.test.ts` | "EXPENSES R US LLC" matches "Expenses-R-Us" ≥ 80 |
| Invoice matcher: no invoices fast path | `src/lib/bank-rec/invoice-matcher.test.ts` | Returns [] immediately when no outstanding invoices |
| Invoice matcher: amount mismatch | `src/lib/bank-rec/invoice-matcher.test.ts` | $210 bank txn does not match $255 invoice |
| Confirm match: clearing JE | `src/lib/bank-rec/invoice-matcher.test.ts` | Creates balanced DR AP / CR Cash entry |
| Confirm match: idempotency | `src/lib/bank-rec/invoice-matcher.test.ts` | Rejects confirmation on already-PAID invoice |
| Vendor normalization | `src/lib/bank-rec/invoice-matcher.test.ts` | Strip LLC, Inc, Corp, punctuation, whitespace |
