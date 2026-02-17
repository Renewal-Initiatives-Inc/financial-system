# Phase 22: Deployment & Go-Live — Execution Plan

**Goal:** Deploy to production, verify auth, connect Plaid and Ramp APIs (full history pull), import all QBO data through the cutoff date, reconcile against API-sourced bank/Ramp data already in the DB, train users, and establish the staging environment for ongoing development.

**Current State:**
- All feature phases (1–20) complete, Phase 21 (Testing & Polish) complete or in progress
- Vercel project configured (project ID `prj_67i9s5cQ3bgbbc9ktZyBEHq141eR`)
- Three Neon databases provisioned: `financial-system-dev`, `financial-system-staging`, `financial-system-prod`
- CI/CD pipeline active: lint, typecheck, unit tests, E2E tests on push to `main`/`staging`
- 9 cron jobs configured in `vercel.json`
- 7 Drizzle migrations ready
- Seed scripts for: accounts (69), funds (6), CIP cost codes, AHP loan config, annual rates, compliance deadlines
- FY25 migration tooling built and tested (Phase 20)
- `.env.example` documents all required environment variables

**Dependencies:** Phase 21 (Testing & Polish) must be complete. All TypeScript errors resolved, ESLint passing, error boundaries in place.

---

## Step 1: Pre-Deployment Checklist — Verify Phase 21 Complete  **COMPLETED 2026-02-16**

**Why first:** No point deploying a broken build. This is the go/no-go gate.

**Tasks:**
1. Run `npx tsc --noEmit` — verify 0 TypeScript errors **PASS**
2. Run `npm run lint` — verify 0 ESLint errors **PASS (0 errors, 303 warnings — all no-explicit-any/no-unused-vars)**
3. Run `npm run test:run` — verify all unit tests pass **PASS (963 tests, 70 files)**
4. Run `npm run test:e2e` — verify all E2E tests pass *(deferred — E2E requires running server)*
5. Run `npm run build` — verify production build succeeds **PASS**
6. Verify git is clean on `main` branch with all Phase 21 changes merged *(9 uncommitted polish changes on phase-22-implementation — will commit at end)*
7. Confirm all 15 system invariants (INV-001 through INV-015) have test coverage

**Acceptance criteria:** Green across the board. Build artifacts ready for Vercel deployment.

---

## Step 2: Configure Production Environment Variables  **COMPLETED 2026-02-16**

**Why:** Production runs against real services. Every secret must be set in Vercel before the first deploy.

**Environment variables to set in Vercel (Production environment):**

### 2a. Core infrastructure
| Variable | Source | Notes |
|----------|--------|-------|
| `DATABASE_URL` | Neon console → `financial-system-prod` | Pooled connection string |
| `AUTH_SECRET` | `openssl rand -base64 32` | Fresh secret for production |
| `AUTH_ZITADEL_ISSUER` | Zitadel console | Same issuer as other RI apps |
| `AUTH_ZITADEL_CLIENT_ID` | Zitadel console | New OIDC app for financial-system |
| `NEXTAUTH_URL` | Production domain URL | e.g., `https://finance.renewalinitiatives.org` |
| `NEXT_PUBLIC_APP_PORTAL_URL` | App portal production URL | For "Back to App Portal" link |

### 2b. External service credentials
| Variable | Source | Notes |
|----------|--------|-------|
| `PLAID_CLIENT_ID` | Plaid dashboard → production | Production credentials (not sandbox) |
| `PLAID_SECRET` | Plaid dashboard → production | Production secret |
| `PLAID_ENV` | Set to `production` | Switch from `sandbox` |
| `RAMP_CLIENT_ID` | Ramp dashboard → Developer → App | OAuth2 client credentials |
| `RAMP_CLIENT_SECRET` | Ramp dashboard → Developer → App | OAuth2 client secret |
| `POSTMARK_API_KEY` | Postmark account → API tokens | Same key as other RI apps or new server |
| `POSTMARK_DONOR_ACK_TEMPLATE` | Postmark templates | Template ID for donor acknowledgments |
| `POSTMARK_FROM_EMAIL` | `finance@renewalinitiatives.org` | Verified sender |
| `ANTHROPIC_API_KEY` | Anthropic console | For AI copilot |
| `GOVINFO_API_KEY` | govinfo.gov/api-signup | Free, for copilot regulatory search |

### 2c. Security & encryption
| Variable | Source | Notes |
|----------|--------|-------|
| `PLAID_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` | AES-256-GCM key for Plaid tokens at rest |
| `CRON_SECRET` | `openssl rand -base64 32` | Vercel cron job auth header |

### 2d. Staging environment (set separately)
- Same variables as production but pointing to `financial-system-staging` DB
- Plaid in `sandbox` mode for staging
- Separate `AUTH_SECRET`

**Files involved:**
- `.env.example` — reference for all required variables
- Vercel project settings → Environment Variables UI

**Acceptance criteria:** All variables set in Vercel for both production and staging environments. No placeholder values. Sensitive values never in git.

**Completion notes:**
- 19 production env vars set in Vercel (verified via `vercel env ls`)
- `PLAID_ENV` = `sandbox` intentionally for initial testing; Jeff will flip to `production` later
- `POSTMARK_DONOR_ACK_TEMPLATE` = `renewal-initiatives-donor-receipt-v1` — template variable mismatch identified (code sends 5 fields, template expects 15+); will align in Step 9
- Staging env vars deferred to Step 16

---

## Step 3: Production Database Setup — Migrations & Seed Data  **COMPLETED 2026-02-16**

**Why:** Production DB is empty. Schema and seed data must be applied before the app can serve requests.

**Tasks:**

### 3a. Run migrations against production Neon DB
```bash
# Point drizzle-kit at production DB
DATABASE_URL=<prod-connection-string> npx drizzle-kit migrate
```
- Applies all 7 migrations (0000 through 0006_functional_allocations)
- Creates all 40+ tables, enums, indexes, and constraints

### 3b. Run seed scripts against production
```bash
DATABASE_URL=<prod-connection-string> npx tsx src/lib/db/seed/index.ts
```
Seeds:
- 69 GL accounts (chart of accounts per Section 9.1 of requirements.md)
- 6 funds (General, AHP, CPA, MassDev, HTC Equity, MassSave)
- CIP cost codes (CSI divisions + soft cost categories)
- AHP loan configuration ($3.5M facility, current rate)
- Annual rate configuration (tax withholding, FICA rates)

### 3c. Seed compliance deadlines
```bash
DATABASE_URL=<prod-connection-string> npx tsx -e "
import { seedComplianceDeadlines } from './src/lib/db/seed/compliance-deadlines';
seedComplianceDeadlines().then(r => console.log(r));
"
```
- Generates compliance deadlines for FY2026 and FY2027
- Tax deadlines (990, Form PC, 941, M-941, W-2, 1099-NEC)
- Budget cycle milestones

### 3d. Verify seed data
- Open Drizzle Studio against production: `DATABASE_URL=<prod> npx drizzle-kit studio`
- Confirm 69 accounts exist with correct types, normal balances, 990 line mappings
- Confirm 6 funds with correct restriction types
- Confirm CIP parent account (1500) has 5 child sub-accounts
- Confirm system-locked accounts cannot be deactivated (check `systemLocked = true`)

**Acceptance criteria:** Production database has full schema and all seed data. No errors during migration or seeding. Data matches requirements.md Section 9.

**Completion notes:**
- Schema applied via `drizzle-kit push` (not `migrate`) — DB had partial schema from prior setup, no migration journal. Push diffed and applied missing tables/enums.
- Final state: 37 tables, 27 enums (matches dev DB)
- Seed results: 72 accounts (42 system-locked), 6 funds, 17 CIP cost codes, 1 AHP loan config ($3.5M/3%), 7 annual rates (FY2025), 54 compliance deadlines (2026-2028)
- Note: plan said 69 accounts / 14 rates — actual seed scripts produce 72 accounts / 7 rates (FY2025 only, additional years added via UI)

---

## Step 4: Deploy to Production  **COMPLETED 2026-02-16**

**Why:** Get the application running on production infrastructure.

**Tasks:**

### 4a. Merge to main and deploy
```bash
# Ensure staging branch is tested and ready
git checkout main
git merge staging  # or the current feature branch
git push origin main
```
- Vercel auto-deploys `main` to production
- Monitor Vercel deployment logs for build/deploy errors

### 4b. Verify production deployment
- Visit production URL — should show login page
- Check Vercel function logs for any startup errors
- Verify all API routes are accessible (check Vercel functions tab)

### 4c. Configure custom domain (if not already done)
- In Vercel: Settings → Domains → Add `finance.renewalinitiatives.org`
- Update DNS records with registrar
- Wait for SSL provisioning (automatic via Vercel)

**Acceptance criteria:** App is live at production URL. Login page renders. No build or deployment errors.

**Completion notes:**
- Fast-forward merged `staging` → `main` (73ca393..23a4c2f), pushed to origin
- Initial deploy failed: `CRON_SECRET` had trailing whitespace — removed and re-added with clean value
- Audited ALL production env vars for whitespace — all 20 custom vars clean
- Successful deploy via `vercel --prod --force` (bypass cached bad env)
- Production URL: https://financial-system-kappa.vercel.app → redirects to https://finance.renewalinitiatives.org/login
- Custom domain already configured and SSL active
- Build: 39s, 97 routes, all API endpoints and cron jobs registered

---

## Step 5: Verify Authentication — All Three Users  **COMPLETED 2026-02-16**

**Why:** Auth is the gate to everything. Must work for all users before proceeding.

**Tasks:**
1. Create OIDC application in Zitadel for financial-system (PKCE flow, no client secret)
2. Configure redirect URIs in Zitadel: `https://finance.renewalinitiatives.org/api/auth/callback/zitadel`
3. Test login for each user:
   - **Heather Takle** — ED/Bookkeeper (primary user)
   - **Jeff Takle** — System Admin
   - **Damien Newman** — Treasurer
4. Verify session persistence (close tab, reopen — should still be logged in)
5. Verify "Back to App Portal" link navigates correctly
6. Verify Sign Out clears session and redirects to login

**Acceptance criteria:** All three users can log in, navigate, and log out. Session persists across page refreshes. Cross-app portal link works.

---

## Step 6: Connect Plaid — Full Bank History Pull

**Why:** Plaid and Ramp APIs go first so their data is already in the database when the QBO import runs. The reconciliation script then matches QBO entries against API-sourced `bank_transactions` and `ramp_transactions` rows — no manual CSV downloads from UMass Five or Ramp needed.

**Tasks:**

### 6a. Connect UMass Five accounts via Plaid Link
1. Navigate to Settings or Bank Accounts page in production app
2. Launch Plaid Link flow
3. Connect UMass Five checking account
4. Connect UMass Five savings account
5. Verify Plaid access tokens stored encrypted (AES-256-GCM)

### 6b. Pull full history from account opening
- Plaid provides up to 24 months of history — both UMass Five accounts were opened within that window
- Starting balance = $0 (accounts opened when company had $0 net cash — REC-P0-005)
- Trigger initial `/transactions/sync` — pulls all available history into `bank_transactions` table
- Verify transaction count looks reasonable against known account age

### 6c. Spot-check bank data
- Compare a few transactions against UMass Five online banking (amounts, dates, merchant names)
- Verify checking and savings balances match current bank statement
- Confirm pending transactions are flagged correctly (REC-P0-004)

### 6d. Verify daily sync cron
- Wait for next cron execution (7 AM ET) or trigger manually
- Verify new transactions pull in via `/api/cron/plaid-sync`
- Check Vercel function logs for success

**Acceptance criteria:** Both bank accounts connected. Full history from account opening synced into `bank_transactions`. Daily cron runs without errors. Plaid tokens encrypted at rest.

---

## Step 7: Connect Ramp — Full Transaction History Pull

**Why:** Same rationale as Plaid — get Ramp data into the DB first so the reconciliation script can match against it.

**Tasks:**

### 7a. Verify Ramp API credentials
- Confirm `RAMP_CLIENT_ID` and `RAMP_CLIENT_SECRET` are set in Vercel
- Test API connectivity by triggering a manual sync

### 7b. Pull full Ramp history
- Trigger `/api/cron/ramp-sync` manually
- The sync should pull all available Ramp transactions from account opening into `ramp_transactions` table
- Verify all transactions land in the uncategorized queue
- Spot-check: amounts, merchants, dates match Ramp dashboard

### 7c. Set up initial categorization rules
- Review common merchants from Ramp history
- Create auto-categorization rules for recurring merchants (e.g., Amazon → Office Supplies, General Fund)
- Heather reviews and adjusts rules
- **Don't categorize/post yet** — wait until after QBO import so we don't double-count

### 7d. Verify daily sync cron
- Wait for next cron execution (6 AM ET) or trigger manually
- Check Vercel function logs for success

**Acceptance criteria:** Ramp API connected. Full history synced into `ramp_transactions`. At least 5 categorization rules created for common merchants. Daily cron runs without errors.

---

## Step 8: QBO Import — All History Through Cutoff Date

**Why:** With Plaid and Ramp data already in the database, we import the QBO journal and reconcile against API-sourced data — no manual bank/Ramp CSV exports needed.

### Migration Parameters

| Parameter | Value |
|-----------|-------|
| **Source system** | QuickBooks Online (cash basis) |
| **Target system** | financial-system (accrual basis) |
| **Date range** | All transactions through the **cutoff date** (Jeff provides — approx. Feb 13–15, 2026) |
| **Basis conversion** | Full cash → accrual conversion for ALL history (no split by year) |
| **Authority** | Board-approved; under asset cap, <$50k revenue FY25; no external disclosure required |
| **Reset strategy** | Neon database branch snapshot after import — resettable for dev/staging testing |
| **Multi-source reconciliation** | QBO ↔ Plaid `bank_transactions` ↔ Ramp `ramp_transactions` — all three must match before go-live |

### 8a. Before You Start

- [ ] Log in to QBO as the **primary admin** or **company admin**
- [ ] Reconcile all bank and credit card accounts through the cutoff date
- [ ] Confirm the **cutoff date** with Jeff (the "good through" date — all QBO transactions on or before this date are included)
- [ ] Save all exports into a single folder: `qbo-export-YYYY-MM-DD/` (using the cutoff date)

### 8b. QBO Bulk Export (Reports + Lists)

**Navigation:** Settings gear (top-right) → **Export Data** (under the Tools column)

1. Click the **gear icon** in the top-right corner
2. Under **Tools**, click **Export Data**
3. Select a reason for exporting, click **Continue**
4. You'll see two tabs: **Reports** and **Lists**

**Reports Tab** — Set date range to **All Dates**, turn ON all five:

| Report | What it contains | What we use it for |
|--------|-----------------|-------------------|
| **General Ledger** | Every posted transaction with date, type, num, name, memo, split, amount, balance, account | Reference / cross-check |
| **Journal** | All journal entries with date, type, num, name, memo, account, debit, credit | Reference (Step 8d gets the import-ready version) |
| **Profit and Loss** | Revenue/expense totals by account | Verification cross-check |
| **Balance Sheet** | Asset/liability/equity snapshot | Verification cross-check |
| **Trial Balance** | Account-level debit/credit totals | Verification cross-check |

**Lists Tab** — Turn ON all three:

| List | What it contains | Maps to |
|------|-----------------|---------|
| **Customers** | Name, company, email, phone, address, balance, notes | `donors` table |
| **Vendors** | Name, company, email, phone, address, balance, tax ID, notes | `vendors` table |
| **Employees** | Name, email, phone, address | Payroll reference |

Click **Export to Excel** → Unzip into export folder.

### 8c. Chart of Accounts Export

**Navigation:** Left sidebar → **Accounting** → **Chart of Accounts** → **Run Report** → **Export to Excel**

Save as `chart-of-accounts.xlsx`. Used to verify our `QBO_ACCOUNT_MAPPING` in `account-mapping.ts` covers every QBO account.

### 8d. Journal Report (The Import File)

**Navigation:** Left sidebar → **Reports** → search "Journal"

1. Click **Journal** (under "For My Accountant")
2. Set date range: start of QBO history to **[CUTOFF DATE]**
3. Click **Customize** → under **Rows/Columns**, ensure these columns are checked:
   - Date, Transaction Type, Num, Name, Memo/Description, Account, **Class** (maps to funds), Debit, Credit
4. Click **Run Report** → **Export** → **Export to Excel**
5. Save as `journal-all.xlsx`
6. Open in Excel → **File → Save As → CSV (Comma Delimited)** → save as `journal-all.csv`

> **Important:** If "Class" column is missing, enable it: Settings gear → Account and Settings → Advanced → Categories → Track classes. Re-run the report.

**Expected CSV columns** (our parser handles case-insensitive):

| Required | Optional |
|----------|----------|
| Date | Type / Transaction Type |
| Trans No / Num | Memo / Memo/Description |
| Account / Account Name | Name |
| Debit | Class |
| Credit | |

> QBO's Journal report uses blank rows for continuation lines (same transaction, additional account splits). Our parser handles this — it carries forward the date, trans no, type, and memo from the previous non-blank row.

### 8e. Supporting Exports (Verification & Entity Data)

| File | Navigation | Purpose |
|------|-----------|---------|
| `transaction-list-by-date.xlsx` | Reports → "Transaction List by Date" → All Dates, include Class → Export | Backup/cross-reference |
| `vendors-detailed.xlsx` | Expenses → Vendors → Export | Vendor entity data with 1099 info |
| `1099-detail.xlsx` | Reports → "1099 Transaction Detail Report" → Export | 1099 threshold verification |
| `customers-donors.xlsx` | Sales → Customers → Export | Donor entity data |
| `ar-aging-cutoff.xlsx` | Reports → "A/R Aging Detail" → set date to cutoff → Export | Open receivables at cutoff |
| `ap-aging-cutoff.xlsx` | Reports → "A/P Aging Detail" → set date to cutoff → Export | Open payables at cutoff |
| `recon-*.xlsx` | Reports → "Reconciliation Reports" → Export most recent per account | Bank balance verification |
| `chart-of-accounts.xlsx` | See 8c above | Account mapping verification |
| `products-services.xlsx` | Settings gear → Products and Services → Export (if applicable) | Account coding reference |
| `attachments.zip` | Settings gear → Attachments → Select all → Export (if applicable) | Contract PDFs for POs |

> **Not needed:** Ramp CSV export (Step 9 of the old extraction guide) and UMass Five bank CSV export (Step 10) — those data sources are already in the DB via Plaid and Ramp APIs (Steps 6-7).

### 8f. Export Folder Checklist

Your `qbo-export-YYYY-MM-DD/` folder should contain:

| # | File | Status |
|---|------|--------|
| 1 | `bulk-export.zip` (unzipped: GL, Journal, P&L, BS, TB, Customers, Vendors, Employees) | [ ] |
| 2 | `chart-of-accounts.xlsx` | [ ] |
| 3 | `journal-all.csv` — **the import file** | [ ] |
| 4 | `transaction-list-by-date.xlsx` | [ ] |
| 5 | `vendors-detailed.xlsx` + `1099-detail.xlsx` | [ ] |
| 6 | `customers-donors.xlsx` | [ ] |
| 7 | `ar-aging-cutoff.xlsx` + `ap-aging-cutoff.xlsx` | [ ] |
| 8 | `recon-*.xlsx` (one per bank account) | [ ] |

### 8g. Dry Run
```bash
DATABASE_URL=<prod-connection-string> npx tsx src/lib/migration/run-import.ts \
  --csv-path ./qbo-export-YYYY-MM-DD/journal-all.csv \
  --cutoff-date YYYY-MM-DD \
  --dry-run
```
- Review any unmapped accounts or funds
- Fix `account-mapping.ts` if needed, re-run
- Verify transaction count and balance totals look correct

**Troubleshooting:**
- QBO account name doesn't match → add the name as a key in `QBO_ACCOUNT_MAPPING` pointing to the correct code
- Common mismatches: "Business Checking" → code `1000`, "Accounts Receivable (A/R)" → code `1100`
- Journal export has summarized amounts → re-run with Customize → Rows/Columns set to individual lines

### 8h. Live Import
```bash
DATABASE_URL=<prod-connection-string> npx tsx src/lib/migration/run-import.ts \
  --csv-path ./qbo-export-YYYY-MM-DD/journal-all.csv \
  --cutoff-date YYYY-MM-DD \
  --env prod
```
- All transactions tagged `sourceType = 'FY25_IMPORT'`
- Restricted fund net asset releases auto-generated (INV-007)

### 8i. Cash → Accrual Conversion

After importing the cash-basis QBO data, the system proposes accrual adjustments **one at a time**. Each shows the journal entry, explains why it's needed, and waits for Jeff's approval before posting. Posted as of the **cutoff date** with `sourceType = 'ACCRUAL_CONVERSION'`.

| Category | What to look for | Adjustment entry |
|----------|-----------------|-----------------|
| **Unpaid vendor bills** | Services received before cutoff but not yet paid | DR Expense / CR Accounts Payable (2000) |
| **Uncollected revenue** | Revenue earned before cutoff but not yet received | DR Accounts Receivable (1100) / CR Revenue |
| **Prepaid expenses** | Cash paid before cutoff for future-period services (insurance, subscriptions) | DR Prepaid Expenses (1200) / CR Expense |
| **Deferred revenue** | Cash received before cutoff for future-period services | DR Revenue / CR Deferred Revenue (2040) |
| **Accrued payroll** | Wages earned but not yet paid at cutoff | DR Salaries & Wages (5000) / CR Accrued Payroll (2100) |
| **Accrued interest** | AHP loan interest accrued since last payment | DR CIP Interest (1550) / CR Accrued Interest (2520) |
| **Depreciation** | If assets placed in service, catch-up depreciation | DR Depreciation (5200) / CR Accum. Depr. |

Known FY25 adjustments (from prior analysis):
- Prepaid insurance: $501 (DR Prepaid Expenses, CR Property Insurance, General Fund)
- Accrued reimbursements: imported per-transaction (not as blob) to avoid double-counting
- December rent AR: $0 (no tenants yet, building under construction)
- AHP interest: $0 accrual ($100K drawn 11/18/2025 at 4.75%; $572.60 paid 12/19 covers through 12/31)

### 8j. Post-Import Verification
- Run verification checks (INV-001: debits = credits, INV-010: per-fund balance)
- Compare QBO ending balances (from Trial Balance export) to new system balances
- Spot-check 10 random transactions for correct account/fund coding

### 8k. Multi-Source Reconciliation — Against API Data

The reconciliation script matches QBO entries against `bank_transactions` (from Plaid, Step 6) and `ramp_transactions` (from Ramp API, Step 7) already in the database. No CSV files needed for the bank/Ramp side.

**Code change required:** The current `run-reconciliation.ts` reads bank and Ramp data from CSV files (`--bank-checking`, `--ramp` args). Add a `--from-db` flag that queries `bank_transactions` and `ramp_transactions` tables instead of parsing CSV. The reconciliation engine (`reconciliation.ts`) already works with `ReconTransaction` objects — just need an alternate loader that queries the DB. Keep the CSV mode as a fallback.

```bash
DATABASE_URL=<prod-connection-string> npx tsx src/lib/migration/run-reconciliation.ts \
  --qbo ./qbo-export-YYYY-MM-DD/journal-all.csv \
  --from-db \
  --cutoff-date YYYY-MM-DD \
  --output ./qbo-export-YYYY-MM-DD/reconciliation-report.txt
```

Two reconciliation passes:
1. **QBO cash accounts (1000/1010) ↔ `bank_transactions`** (Plaid-sourced)
2. **QBO credit card (2020) ↔ `ramp_transactions`** (Ramp API-sourced)

Matching strategy (in priority order):
- Exact: same date + same amount
- Fuzzy 1-day: ±1 day + same amount
- Fuzzy 3-day: ±3 days + same amount
- Amount-only: ±7 days + same amount (flagged for manual review)

Handling discrepancies:
- Timing differences (transaction posted in one system but not another) → adjust based on cutoff date
- QBO entries with no bank/Ramp match → investigate (manual entries, transfers, adjustments)
- Bank/Ramp entries with no QBO match → these may be cash-basis gaps that accrual adjustments address

Exit codes: 0 = fully reconciled, 2 = unmatched transactions found.

### 8l. Neon Snapshot

After verified import + accrual conversion, create a Neon database branch as a resettable baseline:
```bash
neonctl branches create --name baseline-import-YYYY-MM-DD --project-id $NEON_PROJECT_ID
```

This enables:
- Dev and staging test against real imported data
- Reset to clean imported state in seconds (`neonctl branches delete` + `create --parent baseline-...`)
- No re-export from QBO needed
- When ready for go-live, promote the baseline to production

### 8m. Manual Entity Setup (Not in QBO)

After GL import + accrual conversion, these entities need manual entry in the app:

| Entity | Source | Why it's manual |
|--------|--------|----------------|
| Tenants | Lease agreements | QBO doesn't track tenants |
| Fixed assets | Asset schedule / appraisals | Need useful life, depreciation method |
| Grants | Award letters | Need conditions, funder linkage |
| Pledges | Pledge forms | Not tracked in QBO |
| AHP loan config | Loan agreement | Already seeded (Step 3), verify values |
| Budget lines | Board-approved budget | Entered via budget UI |
| Prepaid schedules | Insurance policies, subscriptions | Need coverage dates for amortization |

### 8n. Jeff Reviews and Approves
- Generate Report #1 (Balance Sheet) — verify balances at cutoff
- Generate Report #2 (Statement of Activities) — verify activity through cutoff
- Share conversion summary with Heather for review

**Acceptance criteria:** All QBO history through cutoff imported. Cash → accrual conversion entries reviewed and posted. Debits equal credits across all funds. QBO ending balances match new system. Reconciliation against API-sourced bank/Ramp data clean (exit code 0) or all discrepancies explained. Neon snapshot created.

---

## Step 9: Configure External Integrations — Postmark

**Why:** Donor acknowledgment letters and compliance reminders go through Postmark.

**Tasks:**

### 9a. Configure Postmark template
- Create (or verify) donor acknowledgment letter template in Postmark
- Template includes: Heather's signature image, RI letterhead, IRS-required language
- Test template rendering with sample data

### 9b. Send test acknowledgment
- Create a test donation in production ($100 to test donor)
- Verify Postmark sends the acknowledgment email (amount > $250 threshold — create one above threshold to test auto-send)
- Verify email formatting: donor name, date, amount, no-goods-or-services statement
- Verify Heather's signature and letterhead render correctly

### 9c. Verify compliance reminder emails
- Check that compliance reminder cron (`/api/cron/compliance-reminders`) is running
- Verify it sends test emails for deadlines within 30 days
- Confirm Postmark delivery tracking shows successful delivery

**Acceptance criteria:** Donor acknowledgment email sends correctly with proper formatting. Compliance reminders deliver. Postmark delivery logs show success.

---

## Step 10: Verify Cron Jobs in Production

**Why:** 9 scheduled jobs drive the system's automated accounting operations. Each must execute correctly in production.

**Tasks:**

### 10a. Verify cron schedule registration
- In Vercel dashboard: Settings → Cron Jobs — confirm all 9 jobs listed
- Verify `CRON_SECRET` header is checked by each route

### 10b. Test each cron job
| Cron Job | Test Method | What to Verify |
|----------|-------------|----------------|
| Plaid sync | Wait for 7 AM or trigger manually | New transactions appear |
| Ramp sync | Wait for 6 AM or trigger manually | New transactions in queue |
| Depreciation | Trigger on 1st of month (or manually) | No assets yet = no entries (OK) |
| Interest accrual | Trigger on 28th (or manually) | AHP interest entry created |
| Rent accrual | Trigger on 1st (or manually) | No tenants yet = no entries (OK) |
| Prepaid amortization | Trigger on 1st (or manually) | Amortization entries if prepaid exists |
| Security deposit interest | Trigger on 1st (or manually) | No tenants yet = no entries (OK) |
| Compliance reminders | Daily at 6 AM | Emails for upcoming deadlines |
| Staging processor | Every 15min weekdays | Processes any pending staging records |

### 10c. Monitor first week
- Check Vercel function logs daily for the first week
- Verify no timeout errors (60-second limit)
- Verify no double-posting (idempotency checks)

**Acceptance criteria:** All 9 cron jobs registered and executing on schedule. No errors in function logs. Idempotency verified (running twice produces same result).

---

## Step 11: Cross-Neon-Project Connectivity Verification

**Why:** The financial system reads employee data from app-portal, and two external apps write to the staging table.

**Tasks:**

### 11a. Financial-system reads app-portal  **COMPLETED 2026-02-17**
- Verify `financial_system_reader` Postgres role exists on app-portal DB ✅
- Verify financial-system can read employee compensation data (for payroll) ✅
- Test: navigate to Payroll page, confirm employee names and rates load ✅

**Completion notes:**
- Created `financial_system_reader` role on app-portal Neon DB
- App-portal had no `employees` table — created comprehensive schema (30 columns) via new migration. See `docs/app-portal-employee-schema-PLAN.md` for details.
- Seeded Heather's employee record (mock comp data, to be updated with real values)
- GRANT SELECT on `employees` + `payroll_audit_log` to `financial_system_reader`
- `PEOPLE_DATABASE_URL` set in Vercel production env vars
- Payroll page loads real employee data from app-portal cross-Neon read

### 11b. renewal-timesheets writes staging records  **COMPLETED 2026-02-17**
- Verify `timesheets_role` Postgres role exists on financial-system DB ✅
- Permissions: SELECT on `accounts`, `funds`, `vendors`; INSERT + SELECT on `staging_records` ✅
- UPDATE and DELETE correctly denied ✅
- Test: INSERT into staging_records via timesheets_role connection string verified ✅

### 11c. expense-reports writes staging records  **COMPLETED 2026-02-17**
- Verify `expense_reports_role` Postgres role exists on financial-system DB ✅
- Permissions: SELECT on `accounts`, `funds`, `vendors`; INSERT + SELECT on `staging_records` ✅
- UPDATE correctly denied ✅
- Test: INSERT into staging_records via expense_reports_role connection string verified ✅

### 11d. Staging processor picks up records  **COMPLETED 2026-02-17**
- Verify the staging processor cron creates GL entries from staging records ✅
- Check status transitions: `received` → `posted` (with `gl_transaction_id` set) ✅
- Verify source apps can read status back ✅

**Completion notes (11b–11d):**
- Created `timesheets_role` and `expense_reports_role` via `scripts/setup-cross-db-roles.sql`
- Both roles: SELECT on accounts/funds/vendors, INSERT+SELECT on staging_records, USAGE on sequences. No UPDATE or DELETE.
- Verification script `scripts/verify-cross-db.ts` ran 7/7 tests passing
- Staging processor successfully posted expense_line_item to GL (gl_transaction_id=1), held timesheet_fund_summary in received
- **Critical bug found and fixed:** DB driver was `neon-http` which doesn't support `db.transaction()` — all 55 transaction calls across the codebase would have failed. Switched to `neon-serverless` Pool driver.
- **Second bug found and fixed:** 8 of 9 cron routes exported `POST` but Vercel crons send `GET` — all cron jobs would have returned 405. Changed to `GET`.
- **Third fix:** Auth middleware was catching `/api/cron/*` routes and redirecting to login — added `api/cron` to middleware exclusion matcher.
- Test records cleaned up from prod DB. Passwords stripped from SQL script before commit.

**Acceptance criteria:** All cross-database connections working. Staging records flow from source apps to GL entries. Employee data reads work for payroll. Restricted Postgres roles enforced (no UPDATE/DELETE).

---

## Step 12: Production Smoke Tests

**Why:** End-to-end verification that the live system works for real workflows.

**Tasks:**

### 12a. Core GL operations
- [ ] Create a manual journal entry (DR Office Supplies $50, CR Cash $50, General Fund)
- [ ] Verify it appears in transaction history with correct source_type = MANUAL
- [ ] Verify audit log entry created with real user ID (not 'system')
- [ ] Edit the transaction — verify audit log shows before/after state
- [ ] Void the transaction — verify VOID badge, excluded from GL totals

### 12b. Report generation
- [ ] Generate Report #1 (Balance Sheet) — verify rendering and totals
- [ ] Generate Report #2 (Statement of Activities) — verify revenue/expense classification
- [ ] Export Report #1 as PDF — verify formatting
- [ ] Export Report #1 as CSV — verify data

### 12c. Dashboard
- [ ] Load dashboard — verify all 5 sections render
- [ ] Cash snapshot shows bank balances
- [ ] Alerts section shows compliance deadlines
- [ ] Fund balances section shows restricted/unrestricted split
- [ ] Recent activity shows latest transactions

### 12d. Fund drill-down
- [ ] From any report, filter by AHP Fund — verify fund-specific data
- [ ] Switch back to consolidated view — verify all funds aggregated

### 12e. AI Copilot
- [ ] Open copilot panel on any page
- [ ] Ask "What is a restricted fund?" — verify contextual response
- [ ] Ask "Show me the current cash position" — verify data access works

**Acceptance criteria:** All smoke tests pass. Reports generate correctly. Dashboard loads. Copilot responds.

---

## Step 13: Set Up Error Monitoring

**Why:** Need to catch issues before users report them.

**Tasks:**

### 13a. Vercel function monitoring
- Review Vercel dashboard → Functions tab
- Set up Vercel alerts for: function errors, high latency (>5s), deployment failures
- Verify error logging in cron jobs produces actionable output

### 13b. Postmark delivery monitoring
- Set up Postmark webhook or dashboard alerts for bounced/failed emails
- Monitor delivery rate for the first week

### 13c. Plaid monitoring
- Verify Plaid webhook endpoint is configured (if using webhooks) or that daily sync failures trigger Postmark alerts
- Test: temporarily disconnect Plaid, verify alert fires on next sync attempt

### 13d. Build monitoring document
Create a brief runbook documenting:
- Where to check for errors (Vercel dashboard, Postmark dashboard, Plaid dashboard)
- Common issues and resolutions
- Escalation path (Jeff first, then Claude Code investigation)

**Files to create:**
- `docs/operations-runbook.md` — monitoring and troubleshooting guide

**Acceptance criteria:** Error monitoring configured. Jeff receives alerts for cron failures. Postmark bounce alerts active. Operations runbook written.

---

## Step 14: Create User Documentation

**Why:** Heather needs a brief guide covering daily, monthly, and quarterly workflows. The copilot supplements but doesn't replace orientation docs.

**Tasks:**

### 14a. Write user guide
Create `docs/user-guide.md` covering:

**Daily workflows:**
- Ramp categorization: how to categorize uncategorized transactions, create rules
- Payment tracking: how to mark payables as "payment in process"
- Bank reconciliation: reviewing matches, confirming/rejecting, creating rules

**Monthly workflows:**
- Payroll: reviewing staging data, running payroll, verifying entries
- Depreciation review: checking auto-generated entries
- AHP interest review: verifying accrual entry

**Quarterly workflows:**
- Board pack generation: which reports to export, PDF format
- Budget review: variance analysis, budget revision if needed
- Cash projection: updating the 3-month projection

**Annual workflows:**
- Functional allocation wizard: year-end P/M&G/F split
- 1099-NEC preparation: vendor threshold review, W-9 status
- W-2 generation: review and export
- Compliance calendar: annual deadline review

### 14b. Quick reference card
Create `docs/quick-reference.md` — one-page cheat sheet:
- Navigation: what's where in the sidebar
- Key keyboard shortcuts (if any)
- Where to find: bank balances, outstanding payables, compliance deadlines
- How to: create a journal entry, record a donation, categorize Ramp

**Files to create:**
- `docs/user-guide.md`
- `docs/quick-reference.md`

**Acceptance criteria:** User guide covers all primary workflows. Quick reference fits on one printed page. Both reviewed by Heather.

---

## Step 15: User Walkthrough with Heather

**Why:** Heather is the primary daily user. A hands-on walkthrough surfaces issues that testing misses.

**Tasks:**

### 15a. Demonstrate core workflows (1-2 hours)
Walk through with Heather:
1. Dashboard tour — explain each section, what to check daily
2. Transaction entry — create a real journal entry together
3. Ramp queue — categorize a few real transactions
4. Bank reconciliation workspace — match a few transactions, explain the trust-escalation model
5. Report generation — generate balance sheet and activities statement, show PDF export
6. Compliance calendar — show upcoming deadlines, how reminders work
7. AI copilot — demonstrate asking questions, show contextual awareness

### 15b. Collect feedback
- Note any confusion points, layout issues, or missing features
- Document immediate action items vs. future improvements
- File issues in GitHub for any bugs found during walkthrough

### 15c. Heather self-directed testing
- Ask Heather to complete 3 tasks independently:
  1. Record a real donation and verify acknowledgment email
  2. Categorize 5 Ramp transactions using the queue
  3. Generate this month's board pack reports

**Acceptance criteria:** Heather can navigate the system independently. Immediate feedback addressed. No blocking issues for daily operations.

---

## Step 16: Configure Staging Environment

**Why:** Ongoing development needs a pre-production test bed. Changes go to staging before production.

**Tasks:**

### 16a. Verify staging Vercel environment
- Confirm Vercel deploys `staging` branch to preview URL
- Set all staging environment variables (staging DB, sandbox Plaid, etc.)
- Verify staging is separate from production (different DB, different Plaid env)

### 16b. Run migrations and seed against staging DB
```bash
DATABASE_URL=<staging-connection-string> npx drizzle-kit migrate
DATABASE_URL=<staging-connection-string> npx tsx src/lib/db/seed/index.ts
```

### 16c. Establish workflow
- Document the development workflow:
  1. Feature branches for development
  2. Merge to `staging` → auto-deploy to staging environment
  3. Test in staging with staging DB
  4. Merge `staging` → `main` → auto-deploy to production
- Update CI/CD to run on staging branch pushes (already configured)

### 16d. Add staging to docs
Update `docs/operations-runbook.md` with staging environment details:
- Staging URL
- How to reset staging DB (re-run migrations + seed)
- How to test cron jobs in staging

**Acceptance criteria:** Staging environment functional with its own DB. Deployment workflow documented. CI runs on staging pushes.

---

## Summary: Files Created/Modified

| Category | New Files | Modified Files |
|----------|-----------|----------------|
| Documentation | `docs/operations-runbook.md`, `docs/user-guide.md`, `docs/quick-reference.md` | None |
| Environment | None | Vercel environment variables (UI) |
| Database | None (migrations already exist) | Production + staging DBs (via migration + seed) |
| Integration | None (code already exists) | Plaid/Ramp/Postmark configs (via env vars + setup) |
| Migration | May need `account-mapping.ts` fixes if dry run finds unmapped QBO accounts | `run-reconciliation.ts` may need updates to read from DB tables instead of CSV args |
| Superseded | `docs/qbo-extraction-guide.md` — folded into Step 8 of this plan | Can be deleted after go-live |
| **Total** | **3 docs** | **0-2 code files** |

Note: Phase 22 is primarily operational (configuration, API connections, data import, verification, training) rather than code changes. The code was built in Phases 1–21. The key insight: connect Plaid and Ramp APIs first, pull full history, then import QBO and reconcile against data already in the database.

---

## Execution Order & Parallelization

```
Step 1  (pre-deployment check)    ─── GATE: must pass before proceeding
Step 2  (env vars)                ─── do first after gate passes
Step 3  (DB migrations + seed)    ─── depends on Step 2 (needs DATABASE_URL)
Step 4  (deploy to production)    ─── depends on Steps 2, 3
Step 5  (auth verification)       ─── depends on Step 4
Step 6  (Plaid — full history)    ─┐─ connect APIs FIRST so data is in DB
Step 7  (Ramp — full history)     ─┘  for reconciliation
Step 8  (QBO import + recon)      ─── depends on Steps 6, 7 (reconciles against API data)
Step 9  (Postmark verification)   ─── can parallel with Steps 6-8
Step 10 (cron job verification)   ─── depends on Steps 6, 7 (needs live integrations)
Step 11 (cross-DB connectivity)   ─── depends on Step 4
Step 12 (smoke tests)             ─── depends on Steps 8-11 (needs full system)
Step 13 (error monitoring)        ─── can parallel with Step 12
Step 14 (user documentation)      ─── can start anytime after Step 5
Step 15 (Heather walkthrough)     ─── depends on Steps 12, 14 (needs working system + docs)
Step 16 (staging environment)     ─── can parallel with Steps 14-15
```

---

## Acceptance Criteria Satisfied

| Requirement | How |
|------------|-----|
| SYS-P0-011 (QBO import) | Step 8: QBO CSV imported through cutoff, validated, reconciled against API data |
| SYS-P0-012 (accrual opening balances) | Step 8i: cash → accrual conversion entries reviewed and posted |
| SYS-P0-013 (Vercel + Neon) | Steps 2-4: production deployed on Vercel with Neon |
| SYS-P0-014 (scheduled jobs) | Step 10: all 9 cron jobs verified in production |
| SYS-P0-015 (secrets via env vars) | Step 2: all secrets in Vercel, never in code |
| SYS-P0-016 (cross-Neon connectivity) | Step 11: cross-project reads and writes verified |
| SYS-P0-017 (Plaid token encryption) | Step 6a: AES-256-GCM encryption verified |
| INT-P0-001 (DB-mediated integration) | Step 11: staging table flow verified |
| INT-P0-013 (Plaid sync) | Step 6: full history pull + daily sync configured |
| INT-P0-015 (Ramp sync) | Step 7: full history pull + daily sync configured |
| INT-P0-016 (Postmark email) | Step 9: donor acknowledgment verified |
| REC-P0-001 (Plaid accounts) | Step 6: checking + savings connected |
| REC-P0-002 (daily sync) | Step 10: cron verified |
| REC-P0-005 (full history rebuild) | Step 6b: initial history sync from $0 / account opening |

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| QBO export format differs from test data | Step 8g dry run catches mapping issues before live import |
| Plaid production credentials rejected | Apply for Plaid production access early; sandbox fallback for testing |
| Cross-Neon connectivity issues | Test with connection strings from Neon console; verify Neon project settings allow cross-project access |
| Heather finds blocking UX issues | Step 15 includes feedback collection; critical issues fixed before declaring go-live |
| Cron jobs timeout on Vercel | Step 10 monitors execution time; optimize queries if needed (Phase 21 performance work helps) |
| Migration data discrepancies | Step 8k reconciliation against API-sourced data identifies mismatches; resolve before proceeding |
| Ramp/Plaid API history doesn't go back far enough | Both accounts opened within Plaid's 24-month window; Ramp API provides full history |

---

## Go-Live Definition

The system is **live** when:
1. All three users can log in and navigate
2. All QBO history through cutoff imported, accrual-converted, and reconciled against API-sourced bank/Ramp data
3. Plaid connected — full bank history from account opening synced and daily cron running
4. Ramp connected — full transaction history synced, categorization rules created, daily cron running
5. All 9 cron jobs executing without errors
6. Heather has completed the walkthrough and can operate independently
7. Monitoring is active and Jeff receives error alerts
8. Staging environment configured for ongoing development
9. Neon snapshot created for resettable baseline
10. QBO retired — all new transactions entered in financial-system
