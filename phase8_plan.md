# Phase 8: Expense Processing & Purchase Orders — Execution Plan

**Goal:** Build the expense recording paths — vendor invoices with PO system, AI contract extraction, manual expenses, and the payment execution workflow.

**Dependencies (verified):**
- Phase 5 (Journal Entry & Transactions) — GL engine, transaction/transaction_lines schema, audit logger, correction workflows
- Phase 6 (Vendors/Tenants/Donors) — vendor CRUD, vendor detail page, account/fund selectors, CIP cost code selector

**Requirements satisfied:** TXN-P0-019 through TXN-P0-029, DM-P0-023, DM-P0-024, DM-P0-028

---

## Step 1: New Database Schema (purchase_orders + invoices)

### 1a. Add new enums

**File:** `src/lib/db/schema/enums.ts`

Add two new enums:
```
poStatusEnum: 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
invoicePaymentStatusEnum: 'PENDING' | 'POSTED' | 'PAYMENT_IN_PROCESS' | 'MATCHED_TO_PAYMENT' | 'PAID'
```

### 1b. Create purchase_orders table

**New file:** `src/lib/db/schema/purchase-orders.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| vendorId | integer FK → vendors.id | NOT NULL |
| description | text | NOT NULL |
| contractPdfUrl | text | Nullable — Vercel Blob URL |
| totalAmount | numeric(15,2) | NOT NULL |
| glDestinationAccountId | integer FK → accounts.id | NOT NULL — CIP sub-account or expense account |
| fundId | integer FK → funds.id | NOT NULL |
| cipCostCodeId | integer FK → cip_cost_codes.id | Nullable — required when destination is CIP sub-account |
| status | poStatusEnum | NOT NULL, default 'DRAFT' |
| extractedMilestones | jsonb | Nullable |
| extractedTerms | jsonb | Nullable |
| extractedCovenants | jsonb | Nullable |
| createdBy | varchar(255) | NOT NULL |
| createdAt | timestamp | defaultNow() |
| updatedAt | timestamp | defaultNow() |

Indexes: `vendorId`, `status`, `fundId`

### 1c. Create invoices table

**New file:** `src/lib/db/schema/invoices.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| purchaseOrderId | integer FK → purchase_orders.id | NOT NULL |
| vendorId | integer FK → vendors.id | NOT NULL (denormalized for faster queries) |
| invoiceNumber | varchar(100) | Nullable — vendor's invoice reference |
| amount | numeric(15,2) | NOT NULL |
| invoiceDate | date | NOT NULL |
| dueDate | date | Nullable |
| glTransactionId | integer FK → transactions.id | Nullable — set when GL entry posted |
| paymentStatus | invoicePaymentStatusEnum | NOT NULL, default 'PENDING' |
| createdBy | varchar(255) | NOT NULL |
| createdAt | timestamp | defaultNow() |
| updatedAt | timestamp | defaultNow() |

Indexes: `purchaseOrderId`, `vendorId`, `paymentStatus`

### 1d. Update schema/index.ts

- Export new tables
- Add relations:
  - `vendors` → many `purchaseOrders`, many `invoices`
  - `purchaseOrders` → one `vendor`, one `glDestinationAccount`, one `fund`, one `cipCostCode`, many `invoices`
  - `invoices` → one `purchaseOrder`, one `vendor`, one `glTransaction`

### 1e. Run migration

`npx drizzle-kit generate` then `npx drizzle-kit migrate`

**Acceptance criteria:**
- Tables exist in DB
- FK constraints enforced
- Relations queryable via Drizzle

---

## Step 2: Validators (Zod schemas)

### 2a. Purchase order validators

**New file:** `src/lib/validators/purchase-orders.ts`

- `insertPurchaseOrderSchema` — validates all required fields, ensures totalAmount > 0
- `updatePurchaseOrderSchema` — all fields optional for partial updates
- Custom refinement: if `glDestinationAccountId` points to a CIP sub-account, `cipCostCodeId` is required (business rule from DM-P0-028)

### 2b. Invoice validators

**New file:** `src/lib/validators/invoices.ts`

- `insertInvoiceSchema` — validates required fields, ensures amount > 0
- `updateInvoiceSchema` — partial updates (mainly for status transitions)

### 2c. Export from validators/index.ts

### 2d. Unit tests

**New file:** `src/lib/validators/__tests__/purchase-orders.test.ts`
**New file:** `src/lib/validators/__tests__/invoices.test.ts`

Test cases:
- Valid PO creation
- PO without required CIP cost code when destination is CIP → rejection
- PO with CIP cost code when destination is non-CIP → allowed (cost code ignored)
- Valid invoice creation
- Invoice with amount ≤ 0 → rejection

---

## Step 3: File Upload (Vercel Blob)

### 3a. Install @vercel/blob

`npm install @vercel/blob`

### 3b. Upload API route

**New file:** `src/app/api/upload/route.ts`

Server-side route using `put()` from `@vercel/blob`. Accepts multipart form data, returns blob URL. Restrict to PDF files, enforce reasonable max size (10MB).

### 3c. Environment variable

Add `BLOB_READ_WRITE_TOKEN` to `.env.local` and Vercel environment settings.

**Acceptance criteria:**
- PDF files upload to Vercel Blob
- URL returned and storable in `contractPdfUrl`

---

## Step 4: Purchase Order Server Actions

**New file:** `src/app/(protected)/expenses/actions.ts`

### Actions:

1. **`getPurchaseOrders(filters?)`** — List POs with vendor name joined, filterable by vendor, status, fund
2. **`getPurchaseOrderById(id)`** — Detail view with vendor info, invoices, remaining budget
3. **`createPurchaseOrder(data, userId)`** — Validate via Zod, insert, audit log. Status = DRAFT
4. **`updatePurchaseOrder(id, data, userId)`** — Partial update, audit log
5. **`updatePurchaseOrderStatus(id, status, userId)`** — Status transitions: DRAFT→ACTIVE, ACTIVE→COMPLETED, ACTIVE→CANCELLED
6. **`getInvoicesByPO(poId)`** — List invoices for a PO
7. **`createInvoice(data, userId)`** — Validate, create invoice record, post GL entry via GL engine (DR destination account, CR Accounts Payable), inherit CIP cost code from PO, set payment_status = POSTED, audit log
8. **`markPaymentInProcess(invoiceId, userId)`** — Transition POSTED → PAYMENT_IN_PROCESS (TXN-P0-029)
9. **`getOutstandingPayables()`** — Aggregate all unpaid AP, Reimbursements Payable, Credit Card Payable
10. **`getVendorPaymentSummary(vendorId, year?)`** — Total paid YTD, payments by calendar year (for 1099)

### Key business logic in createInvoice:

```
1. Look up PO → get glDestinationAccountId, fundId, cipCostCodeId
2. Look up "Accounts Payable" account by code (system-locked)
3. Create GL entry via createTransaction():
   - DR: glDestinationAccountId (amount) — fund from PO, cipCostCodeId from PO
   - CR: Accounts Payable (amount) — same fund
   - sourceType: 'MANUAL'
   - sourceReferenceId: `invoice:${invoiceId}`
   - memo: `Invoice ${invoiceNumber} from ${vendorName} against PO-${poId}`
4. Update invoice: glTransactionId, paymentStatus = 'POSTED'
5. Audit log
```

**Acceptance criteria:**
- Invoice posting creates balanced GL entry
- CIP cost code inherited from PO (DM-P0-028)
- Restricted fund expenses trigger automatic net asset release (INV-007 — handled by GL engine)
- All mutations audit-logged

---

## Step 5: AI Contract Extraction

### 5a. Contract extraction utility

**New file:** `src/lib/ai/contract-extraction.ts`

Function: `extractContractTerms(pdfUrl: string): Promise<ExtractedTerms>`

- Download PDF from Vercel Blob URL
- Send to Anthropic API with structured extraction prompt
- Extract: milestones (name, date, description), payment terms (schedule, amounts, conditions), deliverables, covenants (insurance, bonding, reporting requirements)
- Return typed object matching `extractedMilestones`, `extractedTerms`, `extractedCovenants` JSONB structure

### 5b. Extraction API route

**New file:** `src/app/api/extract-contract/route.ts`

POST endpoint that accepts `{ pdfUrl }`, calls extraction utility, returns parsed terms. Keeps Anthropic API key server-side only.

**Acceptance criteria:**
- PDF content extracted and structured
- User can review/edit before saving to PO
- Graceful failure if extraction fails (user can enter terms manually)

---

## Step 6: Purchase Order UI Pages

### 6a. PO list page

**New file:** `src/app/(protected)/expenses/purchase-orders/page.tsx` (server component)
**New file:** `src/app/(protected)/expenses/purchase-orders/po-list-client.tsx` (TanStack Table)
**New file:** `src/app/(protected)/expenses/purchase-orders/columns.tsx`

Columns: PO# (auto-generated display: PO-{id}), vendor name, description, total amount, invoiced amount, remaining, status, fund, created date.

Filters: vendor, status, fund.

Link to create new PO. Each row links to PO detail.

### 6b. Create PO form

**New file:** `src/app/(protected)/expenses/purchase-orders/new/page.tsx` (server component — loads vendors, accounts, funds, CIP cost codes)
**New file:** `src/app/(protected)/expenses/purchase-orders/new/create-po-form.tsx`

Form fields:
- Vendor selector (searchable dropdown of active vendors)
- Description (textarea)
- Contract PDF upload (file input → Vercel Blob → shows uploaded filename)
- Total amount (currency input)
- GL destination account (account selector filtered to CIP sub-accounts + expense accounts)
- Fund (fund selector)
- CIP cost code (CIP cost code selector — conditionally shown when GL destination is a CIP sub-account)

On contract upload: "Extract Terms" button → calls AI extraction → populates milestones/terms/covenants fields as editable JSON cards. User reviews and edits before saving.

Save creates PO in DRAFT status. "Save & Activate" option to create directly in ACTIVE status.

### 6c. PO detail page

**New file:** `src/app/(protected)/expenses/purchase-orders/[id]/page.tsx` (server component)
**New file:** `src/app/(protected)/expenses/purchase-orders/[id]/po-detail-client.tsx`

Sections:
1. **Header:** PO number, vendor name, status badge, total amount, remaining budget
2. **Contract terms:** Milestones (with date, status indicators), payment terms, covenants
3. **Compliance warnings** (TXN-P0-021):
   - Time deadline warnings (milestones with approaching/passed dates)
   - Budget capacity warning (invoiced amount ≥ 90% or > 100% of PO total)
   - Covenant alerts (displayed from extracted covenants)
4. **Invoices list:** TanStack Table of invoices against this PO — invoice #, amount, date, payment status, GL entry link
5. **Actions:** "Add Invoice" button, status transition buttons (Activate, Complete, Cancel)
6. **Contract PDF:** Link to view/download original PDF

### 6d. Create invoice form

**New file:** `src/app/(protected)/expenses/purchase-orders/[id]/invoices/new/page.tsx` (server)
**New file:** `src/app/(protected)/expenses/purchase-orders/[id]/invoices/new/create-invoice-form.tsx`

Form fields:
- Invoice number (vendor's reference)
- Amount (currency input)
- Invoice date
- Due date (optional)

Pre-filled context: PO description, vendor name, remaining budget. Warning if amount would exceed PO total.

On save: creates invoice + GL entry atomically. Shows success with link to GL transaction.

### 6e. Update expenses landing page

**Modify:** `src/app/(protected)/expenses/page.tsx`

Replace stub with a hub page linking to:
- Purchase Orders
- Outstanding Payables

---

## Step 7: Outstanding Payables View

### 7a. Payables page

**New file:** `src/app/(protected)/expenses/payables/page.tsx` (server component)
**New file:** `src/app/(protected)/expenses/payables/payables-client.tsx`

Aggregate view of all unpaid items:
- **Accounts Payable** (from invoices with paymentStatus != 'PAID')
- **Reimbursements Payable** (from transaction_lines on Reimbursements Payable account, unmatched)
- **Credit Card Payable** (from transaction_lines on Credit Card Payable account, unmatched)

Group by vendor. Show aging buckets: Current, 30 days, 60 days, 90+ days. This is the data foundation for Report #7.

Each payable row has a "Mark Payment in Process" button (TXN-P0-029) for invoice-backed payables.

**Acceptance criteria:**
- All three payable types aggregated
- Aging calculated from invoice date / transaction date
- Payment status transitions work

---

## Step 8: Vendor Detail Page Enhancements

### 8a. Add PO section to vendor detail

**Modify:** `src/app/(protected)/vendors/[id]/vendor-detail-client.tsx`

Add new Card section: "Purchase Orders" — list all POs for this vendor with status, total, remaining. Link to PO detail page.

### 8b. Add payment summary to vendor detail

**Modify:** `src/app/(protected)/vendors/[id]/vendor-detail-client.tsx`

Replace the stub "1099 Tracking" card with real data:
- Total paid this calendar year (from posted invoices)
- 1099 threshold status (from `getVendor1099Summary`)
- Payment history list

### 8c. Wire up getVendor1099Summary

**Modify:** `src/app/(protected)/vendors/actions.ts`

Replace the stub `getVendor1099Summary` with real query: sum all invoice amounts for this vendor where `paymentStatus = 'PAID'` (or 'MATCHED_TO_PAYMENT') within the calendar year.

---

## Step 9: Help Tooltips

**Modify:** `src/lib/help/terms.ts`

Add terms:
- `purchase-order` — "A commitment to pay a vendor for goods or services. Tracks contract terms, budget capacity, and payment progress."
- `invoice` — "A vendor's bill against a purchase order. Posting an invoice creates a GL entry (DR Expense or CIP, CR Accounts Payable)."
- `payment-in-process` — "An invoice payment has been initiated outside the system (e.g., via UMass Five portal). The Plaid bank feed will pick up the debit for reconciliation."
- `outstanding-payables` — "All unpaid amounts owed — Accounts Payable (vendor invoices), Reimbursements Payable (employee expenses), and Credit Card Payable (Ramp)."
- `po-compliance-warning` — "Warnings when PO milestones approach/pass deadlines, invoiced amounts approach/exceed budget, or covenant requirements are at risk."
- `contract-extraction` — "AI-assisted extraction of milestones, payment terms, and covenants from uploaded contract PDFs. Always review extracted data before saving."
- `cip-cost-code-inheritance` — "When a PO targets a CIP sub-account, its cost code automatically flows to every invoice posted against it."

---

## Step 10: Unit Tests

### 10a. PO budget capacity calculation

**New file:** `src/lib/expenses/po-budget.test.ts`

Test cases:
- Remaining budget = PO total - sum(invoice amounts)
- Budget warning at 90% capacity
- Over-budget warning when invoices exceed PO total (warn, don't block per Design Principle #5)

### 10b. CIP cost code inheritance

**New file:** `src/lib/expenses/invoice-posting.test.ts`

Test cases:
- Invoice created against PO with CIP destination → GL entry line carries cipCostCodeId from PO
- Invoice created against PO with non-CIP destination → GL entry line has null cipCostCodeId
- Invoice posting creates balanced GL entry (debits = credits)
- Invoice posting to restricted fund triggers net asset release

### 10c. Payment status transitions

Test cases:
- PENDING → POSTED (on GL entry creation)
- POSTED → PAYMENT_IN_PROCESS (manual marking)
- Valid/invalid transitions rejected

### 10d. Outstanding payables aggregation

Test cases:
- Payables grouped by vendor
- Aging buckets calculated correctly
- Paid invoices excluded

---

## Step 11: E2E Test

**New file:** `e2e/purchase-orders.spec.ts`

Scenario:
1. Navigate to expenses → purchase orders
2. Create a new PO for an existing vendor (with CIP sub-account as destination)
3. Upload a contract PDF (mock the Anthropic API to return predefined extracted terms)
4. Review extracted terms, save PO
5. Navigate to PO detail, verify compliance sections visible
6. Create an invoice against the PO
7. Verify GL entry created (navigate to transactions, find the entry)
8. Verify CIP cost code inherited on GL entry lines
9. Verify PO remaining budget updated
10. Mark invoice as "Payment in Process"
11. Verify outstanding payables page shows the payable

---

## File Summary

### New files (21):
| File | Purpose |
|------|---------|
| `src/lib/db/schema/purchase-orders.ts` | PO table definition |
| `src/lib/db/schema/invoices.ts` | Invoice table definition |
| `src/lib/validators/purchase-orders.ts` | PO Zod schemas |
| `src/lib/validators/invoices.ts` | Invoice Zod schemas |
| `src/lib/validators/__tests__/purchase-orders.test.ts` | Validator tests |
| `src/lib/validators/__tests__/invoices.test.ts` | Validator tests |
| `src/lib/ai/contract-extraction.ts` | AI contract term extraction |
| `src/lib/expenses/po-budget.test.ts` | Budget capacity tests |
| `src/lib/expenses/invoice-posting.test.ts` | Invoice posting + CIP inheritance tests |
| `src/app/api/upload/route.ts` | Vercel Blob upload endpoint |
| `src/app/api/extract-contract/route.ts` | AI extraction endpoint |
| `src/app/(protected)/expenses/purchase-orders/page.tsx` | PO list (server) |
| `src/app/(protected)/expenses/purchase-orders/po-list-client.tsx` | PO list (client) |
| `src/app/(protected)/expenses/purchase-orders/columns.tsx` | PO table columns |
| `src/app/(protected)/expenses/purchase-orders/new/page.tsx` | Create PO (server) |
| `src/app/(protected)/expenses/purchase-orders/new/create-po-form.tsx` | Create PO form |
| `src/app/(protected)/expenses/purchase-orders/[id]/page.tsx` | PO detail (server) |
| `src/app/(protected)/expenses/purchase-orders/[id]/po-detail-client.tsx` | PO detail (client) |
| `src/app/(protected)/expenses/purchase-orders/[id]/invoices/new/page.tsx` | Create invoice (server) |
| `src/app/(protected)/expenses/purchase-orders/[id]/invoices/new/create-invoice-form.tsx` | Create invoice form |
| `src/app/(protected)/expenses/payables/page.tsx` | Outstanding payables |
| `src/app/(protected)/expenses/payables/payables-client.tsx` | Payables client |
| `e2e/purchase-orders.spec.ts` | E2E test |

### Modified files (6):
| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add poStatusEnum, invoicePaymentStatusEnum |
| `src/lib/db/schema/index.ts` | Export new tables + relations |
| `src/lib/validators/index.ts` | Export new validators |
| `src/app/(protected)/expenses/page.tsx` | Replace stub with hub page |
| `src/app/(protected)/vendors/[id]/vendor-detail-client.tsx` | Add PO list + payment summary sections |
| `src/app/(protected)/vendors/actions.ts` | Wire real 1099 summary query |
| `src/lib/help/terms.ts` | Add PO/invoice/payable terms |

### New dependency:
- `@vercel/blob` — contract PDF storage

---

## Execution Order

The steps above are ordered for minimal rework:

1. **Schema + migration** (Step 1) — everything else depends on tables existing
2. **Validators** (Step 2) — needed by all server actions
3. **File upload** (Step 3) — needed by PO creation form
4. **Server actions** (Step 4) — business logic layer
5. **AI extraction** (Step 5) — independent module, can parallel with UI
6. **PO UI pages** (Step 6) — the main build, depends on 1-5
7. **Outstanding payables** (Step 7) — independent from PO UI
8. **Vendor detail enhancements** (Step 8) — hooks into vendor pages
9. **Help tooltips** (Step 9) — quick addition
10. **Unit tests** (Step 10) — validate business logic
11. **E2E test** (Step 11) — end-to-end validation

Steps 5, 7, and 9 can be parallelized with Step 6.

---

## Phase 12 Integration Note

The payment execution workflow (TXN-P0-029) is partially built here — the "Mark as Payment in Process" status transition. The final closure (PAYMENT_IN_PROCESS → MATCHED_TO_PAYMENT → PAID) happens in Phase 12 (Bank Reconciliation) when Plaid bank feed picks up the debit and the user confirms the match. This phase builds the AP-side tracking; Phase 12 builds the bank-side matching.
