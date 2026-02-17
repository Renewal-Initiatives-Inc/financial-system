# Financial System User Guide

For Renewal Initiatives, Inc. staff operating the fund accounting system.

---

## Getting Started

**Login:** Navigate to `finance.renewalinitiatives.org` and sign in with your Zitadel credentials (same as the App Portal). The system remembers your session across tabs.

**Navigation:** The left sidebar contains all system sections. Click any item to navigate. Sub-items appear indented under their parent.

**AI Copilot:** Available on every page via the chat panel. Ask questions like "What is a restricted fund?" or "Show me the current cash position" for contextual help.

**User Menu:** Click your avatar (top right) to access **Back to App Portal** (opens tools.renewalinitiatives.org) and **Sign Out**.

---

## Daily Workflows

### Categorize Ramp Transactions

Ramp credit card transactions sync automatically at 6 AM. Uncategorized transactions appear in the queue.

1. Navigate to **Expenses > Ramp Credit Card**
2. The queue shows all uncategorized transactions with merchant, date, and amount
3. Click a transaction to categorize: select the GL account and fund
4. For recurring merchants, click **Create Rule** to auto-categorize future transactions with the same merchant
5. Bulk categorize: select multiple transactions, click **Bulk Categorize**, choose account and fund

**Auto-categorization rules** save time. After creating a rule, future transactions from that merchant are categorized automatically during the daily sync.

### Review Bank Reconciliation

Bank transactions sync from Plaid daily at 7 AM.

1. Navigate to **Bank Rec**
2. The workspace shows bank transactions alongside GL entries
3. **Auto-matched** items (green) are pre-matched by the system — review and confirm
4. **Suggested matches** (yellow) need your review — confirm or reject
5. **Unmatched** items (red) need manual matching or investigation
6. Click **Confirm** on each match to finalize
7. Create **matching rules** for recurring patterns (e.g., "UMASS FIVE TRANSFER" always matches the transfer GL entry)

### Track Payments

1. Navigate to **Expenses** to see open payables
2. When a payment is mailed or initiated, update the status to "Payment in Process"
3. Once cleared in the bank, the bank rec process links the payment to the GL entry

---

## Monthly Workflows

### Run Payroll

Payroll entries come from two sources: staging records (from timesheets app) and manual entry.

1. Navigate to **Payroll > New Run**
2. The wizard pre-populates employee data from the App Portal
3. Review hours, rates, and calculated withholdings (federal, MA state, FICA)
4. Click through the wizard steps: review entries, verify calculations, post
5. The system creates GL entries automatically: salary expense, tax liabilities, net pay

### Review Automated Monthly Entries

On the 1st of each month, the system auto-generates:

- **Depreciation** — entries for all in-service fixed assets
- **Prepaid amortization** — monthly allocation of prepaid expenses (insurance, etc.)
- **Rent accrual** — tenant rent charges (when tenants are active)
- **Security deposit interest** — annual interest payment for tenants whose tenancy anniversary falls this month (MA G.L. c. 186 § 15B, capped at 5%)

On the 28th:

- **AHP interest accrual** — loan interest on the drawn balance (Actual/365 day-count, amount varies by month)

Review these entries in **Transactions** by filtering for the current month and source type "CRON".

---

## Quarterly Workflows

### Generate Board Pack

The board receives financial reports quarterly.

1. Navigate to **Reports**
2. Generate these reports for the quarter:
   - **Balance Sheet** — asset/liability/net asset snapshot
   - **Statement of Activities** — revenue and expenses (like a P&L)
   - **Cash Flows** — cash movement summary
   - **Cash Position** — current bank balances and projections
3. Click **Export PDF** on each report for board-ready formatting
4. Optionally filter by fund to show fund-specific financials

### Review Budget Variance

1. Navigate to **Budgets**
2. Select the active budget period
3. The variance view shows budget vs. actual for each line item
4. Red highlights indicate lines over budget — investigate and note reasons
5. If budget revision is needed, create a new budget version

### Update Cash Projection

1. Navigate to **Reports > Cash Position**
2. The 3-month projection shows expected inflows and outflows
3. Update projected amounts based on known upcoming commitments
4. Review the runway analysis for cash adequacy

---

## Annual Workflows

### Functional Allocation (Year-End)

Required for the Form 990 — allocates shared expenses across Program, Management & General, and Fundraising.

1. Navigate to **Compliance > Functional Allocation**
3. The wizard presents each shared expense account with smart defaults based on comparable nonprofits
4. Adjust percentages as needed for each account
5. Review the summary showing total allocations per category
6. Post the allocation entries

### 1099-NEC Preparation

1. Navigate to **Vendors**
2. Filter for vendors with total payments >= $600 (the 1099 threshold)
3. Verify each vendor's W-9 status and tax ID
4. Navigate to **Reports** and generate the **1099 Detail Report**
5. Export for filing

### W-2 Generation

1. Navigate to **Payroll**
2. Select the fiscal year
3. Generate W-2 forms for all employees
4. Review totals against payroll GL entries
5. Export for filing

### Compliance Calendar Review

1. Navigate to **Compliance**
2. The calendar shows all upcoming deadlines for the fiscal year:
   - Form 990 (May 15)
   - Form PC (November 15)
   - Quarterly 941 filings
   - MA-941 filings
   - W-2 and 1099-NEC deadlines
3. Mark items as filed when complete
4. The system sends email reminders at 30 days and 7 days before each deadline

---

## Recording Common Transactions

### Record a Donation

1. Navigate to **Donors** and verify the donor exists (create if new)
2. Navigate to **Revenue > Donations**
3. Fill in the donation form: donor, date, amount, fund, and payment method
4. The system creates the journal entry automatically (DR Cash, CR Revenue)
5. For donations over $250, the system automatically sends a donor acknowledgment letter via email

### Record a Grant Receipt

1. Navigate to **Revenue > Grants** and create the grant record if new (funder, award amount, conditions, fund)
2. When cash arrives, click **Record Cash Receipt** on the grant detail page
3. The system creates the journal entry (DR Cash, CR Deferred Revenue or Revenue depending on conditions)
4. Track grant conditions and milestones on the grant detail page

### Record Rent Payment

1. Navigate to **Revenue > Rent > Payment**
2. Select the tenant and enter payment details
3. The system matches against the rent accrual and creates the cash receipt entry

### Create a Journal Entry

1. Navigate to **Transactions > New**
2. Enter the transaction date and description/memo
3. Add lines: each line has an account, fund, and debit or credit amount
4. The system enforces balanced entries — total debits must equal total credits
5. Click **Post** to save

### Void a Transaction

1. Navigate to the transaction detail page
2. Click **Void**
3. Confirm — the system marks it with a VOID badge and excludes it from GL totals
4. The audit log records who voided and when

---

## Understanding Funds

The system tracks six funds:

| Fund | Restriction | Purpose |
|------|------------|---------|
| General | Unrestricted | Day-to-day operations |
| AHP | Restricted | Affordable Housing Program grant |
| CPA | Restricted | Community Preservation Act funds |
| MassDev | Restricted | MassDevelopment grant |
| HTC Equity | Restricted | Historic Tax Credit equity |
| MassSave | Restricted | Energy efficiency program |

Every transaction line is tagged with a fund. Reports can be filtered by fund or shown consolidated. Restricted funds require net asset releases when conditions are met.

---

## Staging Records (Timesheets & Expense Reports)

Data from the timesheets and expense reports apps flows into the financial system automatically via the staging table.

- **Expense reports** are auto-posted to the GL every 15 minutes on weekdays (DR Expense, CR Reimbursements Payable)
- **Timesheets** are received but not auto-posted — they accumulate for the payroll wizard to process
- View incoming records at **Settings > Staging Records**
- Status flow: `received` → `posted` (with GL transaction link)

---

## Tips

- **Use the copilot** when unsure about accounting treatment — it knows RI's chart of accounts and fund structure
- **Create categorization rules early** for Ramp — once you have rules for your top 10 merchants, 80%+ of transactions auto-categorize
- **Check the dashboard daily** — the alerts section surfaces upcoming compliance deadlines and any items needing attention
- **Export to CSV** for any report if you need to do custom analysis in Excel
