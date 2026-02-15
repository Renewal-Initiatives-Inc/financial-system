# QBO Data Extraction Guide — Renewal Initiatives

Step-by-step instructions for pulling everything we need out of QuickBooks Online
to feed into our financial system's migration engine.

**Who should do this:** QBO Admin (only admins see the Export Data tool)
**Time estimate:** 30–45 minutes
**Output:** A folder of Excel/CSV files ready for import

---

## Migration Parameters

| Parameter | Value |
|-----------|-------|
| **Source system** | QuickBooks Online (cash basis) |
| **Target system** | financial-system (accrual basis) |
| **Date range** | All transactions through the **cutoff date** (Jeff provides — approx. Feb 13–15, 2026) |
| **Basis conversion** | Full cash → accrual conversion for ALL history (no split by year) |
| **Authority** | Board-approved; under asset cap, <$50k revenue FY25; no external disclosure required |
| **Reset strategy** | Neon database branch snapshot after import — resettable for dev/staging testing |
| **Multi-source reconciliation** | QBO + Ramp + UMass Five bank — all three must match before go-live |

---

## Before You Start

- [ ] Log in to QBO as the **primary admin** or **company admin**
- [ ] Reconcile all bank and credit card accounts through the cutoff date
- [ ] Confirm the **cutoff date** with Jeff (the "good through" date — all QBO transactions on or before this date are included)
- [ ] Save all exports into a single folder: `qbo-export-YYYY-MM-DD/` (using the cutoff date)

---

## Step 1: Bulk Export (Reports + Lists)

This bundles the core financial data into one zip file.

**Navigation:** Settings gear (top-right) → **Export Data** (under the Tools column)

1. Click the **gear icon** in the top-right corner
2. Under **Tools**, click **Export Data**
3. Select a reason for exporting, click **Continue**
4. You'll see two tabs: **Reports** and **Lists**

### Reports Tab

5. Set the date range dropdown to **All Dates**
6. Turn ON all five reports:

| Report | What it contains | What we use it for |
|--------|-----------------|-------------------|
| **General Ledger** | Every posted transaction with date, type, num, name, memo, split, amount, balance, account | Reference / cross-check |
| **Journal** | All journal entries with date, type, num, name, memo, account, debit, credit | Reference (Step 3 gets the import-ready version) |
| **Profit and Loss** | Revenue/expense totals by account | Verification cross-check |
| **Balance Sheet** | Asset/liability/equity snapshot | Verification cross-check |
| **Trial Balance** | Account-level debit/credit totals | Verification cross-check |

### Lists Tab

7. Turn ON all three lists:

| List | What it contains | Maps to |
|------|-----------------|---------|
| **Customers** | Name, company, email, phone, address, balance, notes | `donors` table |
| **Vendors** | Name, company, email, phone, address, balance, tax ID, notes | `vendors` table |
| **Employees** | Name, email, phone, address | Payroll reference |

8. Click **Export to Excel** at the bottom
9. Click **OK** to confirm
10. A `.zip` file downloads — unzip into your export folder

> **Note:** Excel files may open in Protected View. Click **Enable Editing** to see data. To convert to CSV: File → Save As → CSV (Comma Delimited).

---

## Step 2: Chart of Accounts Export

**Navigation:** Left sidebar → **Accounting** → **Chart of Accounts**

1. Click the **Run Report** button (top-right of the Chart of Accounts page)
2. This opens the Account List report
3. Click the **Export** icon (box with arrow, top-right of report) → **Export to Excel**
4. Save as `chart-of-accounts.xlsx`

**Fields you'll get:** Account Name, Type, Detail Type, Description, Balance, Account Number (if enabled)

**Why we need this:** Verifies our `QBO_ACCOUNT_MAPPING` in [account-mapping.ts](../src/lib/migration/account-mapping.ts) covers every QBO account. Any unmapped accounts will error during dry-run.

---

## Step 3: Journal Report (The Import File)

This is the specific report our import engine parses.

**Navigation:** Left sidebar → **Reports** → search "Journal"

1. Click **Journal** (under "For My Accountant" category)
2. Set date range: **01/01/2025** to **[CUTOFF DATE]**
3. Click **Customize** button
4. Under **Rows/Columns**, ensure these columns are checked:
   - Date
   - Transaction Type
   - Num (this is the Trans No)
   - Name
   - Memo/Description
   - Account
   - **Class** ← critical — maps to our funds
   - Debit
   - Credit
5. Click **Run Report**
6. Click **Export** icon → **Export to Excel**
7. Save as `journal-all.xlsx`
8. Open in Excel → **File → Save As → CSV (Comma Delimited)** → save as `journal-all.csv`

**This CSV is what you feed to the import script:**
```bash
npx tsx src/lib/migration/run-import.ts --csv-path ./qbo-export-YYYY-MM-DD/journal-all.csv --dry-run
```

### Expected CSV Columns

Our parser ([qbo-csv-parser.ts](../src/lib/migration/qbo-csv-parser.ts)) expects these column headers (case-insensitive):

| Required | Optional |
|----------|----------|
| Date | Type / Transaction Type |
| Trans No / Num | Memo / Memo/Description / Description |
| Account / Account Name | Name |
| Debit | Class |
| Credit | |

> **Important:** QBO's Journal report uses blank rows for continuation lines (same transaction, additional account splits). Our parser handles this — it carries forward the date, trans no, type, and memo from the previous non-blank row.

---

## Step 4: Transaction List by Date (Backup/Cross-Reference)

A flat list of every transaction — useful if the Journal export has issues.

**Navigation:** Left sidebar → **Reports** → search "Transaction List by Date"

1. Click **Transaction List by Date** (under "For My Accountant")
2. Set date range: **All Dates**
3. Click **Customize** → ensure **Class** column is included
4. Click **Run Report**
5. Click **Export** icon → **Export to Excel**
6. Save as `transaction-list-by-date.xlsx`

---

## Step 5: Vendor List (Detailed)

The bulk export gives you vendors, but we want the detailed version with 1099 info.

**Navigation:** Left sidebar → **Expenses** → **Vendors**

1. Click the **Export** icon at the top of the vendor list → **Export to Excel**
2. Save as `vendors-detailed.xlsx`

Then also grab the 1099 detail:

**Navigation:** Left sidebar → **Reports** → search "1099"

3. Click **1099 Transaction Detail Report**
4. Set date range: **01/01/2025** to **[CUTOFF DATE]**
5. Export to Excel
6. Save as `1099-detail.xlsx`

**Maps to:** `vendors` table — `name`, `address`, `tax_id`, `is_1099_eligible`, `entity_type`

---

## Step 6: Customer/Donor List

**Navigation:** Left sidebar → **Sales** → **Customers**

1. Click the **Export** icon at the top → **Export to Excel**
2. Save as `customers-donors.xlsx`

**Maps to:** `donors` table — `name`, `address`, `email`, `type`

> **Note:** You'll need to manually flag donor type (INDIVIDUAL, CORPORATE, FOUNDATION, GOVERNMENT) and first_gift_date — QBO doesn't track these natively.

---

## Step 7: Open A/R and A/P (Carry-Forward Balances)

These identify what's owed at cutoff — critical for the cash-to-accrual conversion.

**Navigation:** Left sidebar → **Reports**

### A/R Aging
1. Search "A/R Aging Detail"
2. Set report date: **[CUTOFF DATE]**
3. Export to Excel → save as `ar-aging-cutoff.xlsx`

### A/P Aging
4. Search "A/P Aging Detail"
5. Set report date: **[CUTOFF DATE]**
6. Export to Excel → save as `ap-aging-cutoff.xlsx`

**Why:** Even though QBO is cash-basis, these reports show any open invoices/bills at cutoff that will become accrual adjustment entries in our system.

---

## Step 8: Bank Reconciliation Reports

**Navigation:** Left sidebar → **Reports** → search "Reconciliation"

1. Click **Reconciliation Reports** (under "For My Accountant")
2. You'll see a list of past reconciliations by account
3. For each bank account (Checking, Savings, Escrow):
   - Click the most recent completed reconciliation
   - Export to Excel
   - Save as `recon-checking-YYYY-MM.xlsx`, etc.

**Why:** Confirms the bank balance we should expect after import. Also feeds the multi-source reconciliation with UMass Five.

---

## Step 9: Ramp Transaction Export

We need the full Ramp history to reconcile against QBO credit card entries.

**Navigation:** Log in to Ramp at ramp.com

1. Go to **Transactions** → set date range: **All time** (or 01/01/2025 to [CUTOFF DATE])
2. Click **Export** → **CSV**
3. Save as `ramp-transactions.csv`

Also export:
4. **Statements** → download all monthly statements as PDFs
5. Save into `ramp-statements/` subfolder

**Maps to:** `ramp_transactions` table — `date`, `amount`, `merchant_name`, `cardholder`

**Reconciliation use:** Each Ramp transaction should have a matching QBO entry in Credit Card Payable (2020) or the expense account it was coded to.

---

## Step 10: UMass Five Bank Statement Export

We need bank statements to reconcile against both QBO and Plaid.

**Option A — Download from online banking:**
1. Log in to UMass Five online banking
2. For each account (Checking, Savings, Escrow):
   - Download transaction history as **CSV** or **OFX/QFX** for the full date range
   - Save as `umass5-checking.csv`, `umass5-savings.csv`, `umass5-escrow.csv`

**Option B — If Plaid is already connected:**
Our system will pull this automatically via [plaid-history-sync.ts](../src/lib/migration/plaid-history-sync.ts). But download the CSVs anyway as a reconciliation cross-check.

**Reconciliation use:** Bank statement balances must match QBO reconciled balances AND our imported GL cash account balances.

---

## Step 11: Products and Services List (If Applicable)

Only needed if QBO tracks inventory or service items.

**Navigation:** Settings gear → **Products and Services** (under Lists column)

1. Click **Export** icon → **Export to Excel**
2. Save as `products-services.xlsx`

**Maps to:** Not directly imported — reference only for account coding verification.

---

## Step 12: Attachments (Receipts, Contracts, PDFs)

**Navigation:** Settings gear → **Attachments** (under Lists column)

1. Select all attachments (checkbox at top)
2. Click **Batch Actions** → **Export**
3. Downloads as a `.zip` of actual files

**Why:** Contract PDFs may be needed for purchase orders (`contract_pdf_url` field). Not imported programmatically — manual reference.

---

## Final Checklist

Your `qbo-export-YYYY-MM-DD/` folder should contain:

| # | File | Source | Status |
|---|------|--------|--------|
| 1 | `bulk-export.zip` (unzipped: GL, Journal, P&L, BS, TB, Customers, Vendors, Employees) | QBO Export Data tool | [ ] |
| 2 | `chart-of-accounts.xlsx` | QBO Accounting → CoA → Run Report | [ ] |
| 3 | `journal-all.csv` — **the import file** | QBO Reports → Journal → Export → Save as CSV | [ ] |
| 4 | `transaction-list-by-date.xlsx` | QBO Reports → Transaction List by Date | [ ] |
| 5 | `vendors-detailed.xlsx` | QBO Expenses → Vendors → Export | [ ] |
| 6 | `1099-detail.xlsx` | QBO Reports → 1099 Transaction Detail | [ ] |
| 7 | `customers-donors.xlsx` | QBO Sales → Customers → Export | [ ] |
| 8 | `ar-aging-cutoff.xlsx` | QBO Reports → A/R Aging Detail | [ ] |
| 9 | `ap-aging-cutoff.xlsx` | QBO Reports → A/P Aging Detail | [ ] |
| 10 | `recon-*.xlsx` (one per bank account) | QBO Reports → Reconciliation Reports | [ ] |
| 11 | `ramp-transactions.csv` | Ramp → Transactions → Export | [ ] |
| 12 | `ramp-statements/` (monthly PDFs) | Ramp → Statements → Download | [ ] |
| 13 | `umass5-checking.csv` (+ savings, escrow) | UMass Five online banking → Download | [ ] |
| 14 | `products-services.xlsx` (if applicable) | QBO Settings → Products & Services | [ ] |
| 15 | `attachments.zip` (if applicable) | QBO Settings → Attachments → Export | [ ] |

---

## What Happens Next

### Phase 1: Import & Validate

#### 1. Dry Run
```bash
npx tsx src/lib/migration/run-import.ts \
  --csv-path ./qbo-export-YYYY-MM-DD/journal-all.csv \
  --cutoff-date YYYY-MM-DD \
  --dry-run
```

This will:
- Parse the CSV (all dates through cutoff)
- Check every QBO account name maps to our 69-account chart
- Check every QBO class maps to our 6 funds
- Verify every transaction balances (debits = credits)
- Report any unmapped accounts or classes

#### 2. Fix Unmapped Accounts
If the dry run reports unmapped QBO accounts, add them to `QBO_ACCOUNT_MAPPING` in [account-mapping.ts](../src/lib/migration/account-mapping.ts). Compare against `chart-of-accounts.xlsx`.

#### 3. Live Import
```bash
npx tsx src/lib/migration/run-import.ts \
  --csv-path ./qbo-export-YYYY-MM-DD/journal-all.csv \
  --cutoff-date YYYY-MM-DD \
  --env dev
```

#### 4. Verify (Cash-Basis Check)
Before accrual adjustments, verify the imported data matches QBO:
- Trial Balance totals match QBO Trial Balance export
- Transaction count matches CSV row groups
- Cash account balances match QBO + bank statements

### Phase 2: Cash → Accrual Conversion

After importing the cash-basis QBO data, the system generates accrual adjustment journal entries. These are posted as of the **cutoff date** with `sourceType = 'ACCRUAL_CONVERSION'`.

**What the conversion engine reviews:**

| Category | What to look for | Adjustment entry |
|----------|-----------------|-----------------|
| **Unpaid vendor bills** | Services received before cutoff but not yet paid | DR Expense / CR Accounts Payable (2000) |
| **Uncollected revenue** | Revenue earned before cutoff but not yet received | DR Accounts Receivable (1100) / CR Revenue |
| **Prepaid expenses** | Cash paid before cutoff for future-period services (insurance, subscriptions) | DR Prepaid Expenses (1200) / CR Expense |
| **Deferred revenue** | Cash received before cutoff for future-period services | DR Revenue / CR Deferred Revenue (2040) |
| **Accrued payroll** | Wages earned but not yet paid at cutoff | DR Salaries & Wages (5000) / CR Accrued Payroll (2100) |
| **Accrued interest** | AHP loan interest accrued since last payment | DR CIP Interest (1550) / CR Accrued Interest (2520) |
| **Depreciation** | If assets placed in service, catch-up depreciation | DR Depreciation (5200) / CR Accum. Depr. |

> **Decision (confirmed):** After the cash-basis import, we propose accrual adjustments **one at a time**. Each one shows the journal entry, explains why it's needed, and waits for Jeff's approval before posting. This is more hands-on but builds understanding of the accrual model. When in doubt, we ask.

### Phase 3: Snapshot for Testing

After import + accrual conversion, we create a **Neon database branch** as a resettable baseline.

**How it works:**
- Neon (our Postgres host) supports instant **database branching** — a point-in-time copy of the entire database
- After the clean import, we create a branch called `baseline-import-YYYY-MM-DD`
- Dev and staging test against this branch
- When you want to reset: delete the working branch, create a new one from baseline
- The original QBO export files are never re-processed

```bash
# Create baseline snapshot (after verified import)
neonctl branches create --name baseline-import-YYYY-MM-DD --project-id $NEON_PROJECT_ID

# Reset to baseline (after testing)
neonctl branches delete --name dev-testing --project-id $NEON_PROJECT_ID
neonctl branches create --name dev-testing --parent baseline-import-YYYY-MM-DD --project-id $NEON_PROJECT_ID
```

**What this gives you:**
- Import QBO data once
- Test, break things, fix bugs in dev/staging
- Reset to clean imported state in seconds
- No re-export from QBO needed
- When ready for go-live, promote the baseline to production

### Phase 4: Multi-Source Reconciliation

Three data sources must agree before go-live:

```
QBO (journal-all.csv)  ←→  UMass Five (bank CSVs)  ←→  Ramp (ramp-transactions.csv)
         ↕                          ↕                          ↕
   GL transactions            bank_transactions          ramp_transactions
   (imported)                 (Plaid or CSV)             (API or CSV)
```

**Reconciliation process:**

| Match | How | Expected result |
|-------|-----|----------------|
| **QBO cash accounts ↔ Bank statements** | Compare QBO Checking/Savings/Escrow ending balances vs. UMass Five balances at cutoff | Exact match (since QBO was reconciled) |
| **QBO credit card entries ↔ Ramp** | Match QBO Credit Card Payable (2020) transactions against Ramp export by date + amount | Every Ramp charge has a QBO entry |
| **Bank statement ↔ Imported GL** | After import, our GL cash account balances should match bank statement balances | Exact match |
| **Ramp ↔ Imported GL** | After import, Ramp transactions should map to expense entries in GL | Every Ramp charge accounted for |

**Handling discrepancies:**
- Timing differences (transaction posted in one system but not another) → adjust based on cutoff date
- QBO entries with no bank/Ramp match → investigate (manual entries, transfers, adjustments)
- Bank/Ramp entries with no QBO match → these are the cash-basis gaps that accrual adjustments may address

> **Decision (confirmed):** We build a matching script (`src/lib/migration/reconciliation.ts`) that auto-pairs transactions by date + amount across all three sources and flags exceptions. See the script for details.

### Phase 5: Manual Data Entry (Not in QBO)

After the GL import + accrual conversion, these entities need manual setup:

| Entity | Source | Why it's manual |
|--------|--------|----------------|
| Tenants | Lease agreements | QBO doesn't track tenants |
| Fixed assets | Asset schedule / appraisals | Need useful life, depreciation method |
| Grants | Award letters | Need conditions, funder linkage |
| Pledges | Pledge forms | Not tracked in QBO |
| AHP loan config | Loan agreement | Interest rate, credit limit, draw schedule |
| Budget lines | Board-approved budget | Entered via budget UI |
| Prepaid schedules | Insurance policies, subscriptions | Need coverage dates for amortization |
| Compliance deadlines | Filing calendar | Seeded at launch |

---

## Troubleshooting

### "Class" column is missing from Journal export
QBO only shows the Class column if Class Tracking is enabled:
- Settings gear → **Account and Settings** → **Advanced** → **Categories** → turn on **Track classes**
- Re-run the Journal report

### Export Data option is missing
Only the **primary admin** or **company admin** role can see it. Standard users with "all access" still can't export. Ask your admin to either:
- Export for you, or
- Upgrade your role temporarily

### Journal export has summarized amounts instead of individual lines
Click **Customize** → under **Rows/Columns**, make sure the grouping is set to show individual transaction lines, not summarized. Alternatively use the **General Ledger** report which always shows individual lines.

### QBO account name doesn't match any mapping
The dry-run will tell you exactly which names failed. Add the QBO name as a new key in `QBO_ACCOUNT_MAPPING` pointing to the correct account code. Common mismatches:
- QBO uses "Business Checking" → we map to code `1000`
- QBO uses "Accounts Receivable (A/R)" → we map to code `1100`
- QBO uses abbreviations or alternate names

---

## Timeline: Export → Go-Live

```
Day 1:  Jeff exports from QBO + Ramp + UMass Five (this guide)
        Jeff provides cutoff date
Day 1:  Claude runs dry-run, fixes any unmapped accounts
Day 1:  Live import into dev database
Day 1:  Neon snapshot created (baseline-import-YYYY-MM-DD)

Day 2+: Cash → accrual conversion entries reviewed and posted
        Multi-source reconciliation (QBO ↔ Bank ↔ Ramp)
        Dev/staging testing and bug fixes
        Reset to baseline as needed

Go-Live: Jeff manually enters any QBO transactions between cutoff and go-live
         Promote baseline to production
         Connect Plaid for ongoing bank sync
         Connect Ramp API for ongoing card sync
         QBO retired
```
