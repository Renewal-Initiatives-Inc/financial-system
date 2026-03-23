# Quick Reference Card

## Navigation

| Section | Path | What's There |
|---------|------|-------------|
| Dashboard | `/` | Cash snapshot, alerts, fund balances, recent activity |
| Transactions | `/transactions` | All GL entries, create/edit/void, filter/search |
| Chart of Accounts | `/accounts` | 69 GL accounts, codes, types, 990 mappings |
| Funds | `/funds` | 5 funds (1 unrestricted, 4 restricted) |
| Revenue | `/revenue` | Donations, funding sources, pledges, rent, in-kind, earned income, investment income |
| Expenses | `/expenses` | Purchase orders, invoices, Ramp credit card |
| Ramp Queue | `/expenses/ramp` | Categorize credit card transactions, manage auto-rules |
| Payroll | `/payroll` | Pay runs, withholdings, W-2 generation |
| Bank Rec | `/bank-rec` | Match bank ↔ GL, confirm/reject matches |
| Reports | `/reports` | 30 reports — financials, compliance, payroll, property, tax |
| Budgets | `/budgets` | Budget entry, variance tracking, cash projection |
| Compliance | `/compliance` | Filing deadlines, calendar, 990 readiness, 1099 prep, functional allocation |
| Vendors | `/vendors` | Vendor directory, 1099 tracking, W-9 status |
| Tenants | `/tenants` | Lease details, security deposits |
| Donors | `/donors` | Donor directory, acknowledgment history |
| Assets | `/assets` | Fixed assets, CIP tracking/conversion, prepaid schedules, developer fee |
| Settings | `/settings` | Annual rates, staging records, system config |

## How To...

| Task | Steps |
|------|-------|
| **Create a journal entry** | Transactions > New > add lines > Post |
| **Record a donation** | Revenue > Donations > fill form (auto-creates journal entry) |
| **Record a funding source** | Revenue > Funding Sources > New > fill details, optionally upload contract for AI extraction |
| **Record a pledge** | Revenue > Pledges > fill form |
| **Record rent payment** | Revenue > Rent > Payment > select tenant |
| **Record in-kind donation** | Revenue > In-Kind > fill form |
| **Categorize Ramp** | Expenses > Ramp > click transaction > select account + fund |
| **Create Ramp rule** | Expenses > Ramp > Rules > Create Rule |
| **Create a purchase order** | Expenses > Purchase Orders > New > fill details, upload contract |
| **Create an invoice** | Expenses > Purchase Orders > [PO] > Invoices > New |
| **Run payroll** | Payroll > New Run > follow wizard |
| **Generate a report** | Reports > select report > set date range > view or Export PDF |
| **Generate board pack** | Reports > Board Pack > select period > Export PDF |
| **Reconcile bank** | Bank Rec > review matches > Confirm or Reject |
| **Check compliance** | Compliance > view calendar > mark filings complete |
| **Check 990 readiness** | Compliance > 990 Readiness |
| **Prepare 1099s** | Compliance > 1099 Prep |
| **Functional allocation** | Compliance > Functional Allocation > wizard |
| **Void a transaction** | Transaction detail > Void > confirm |
| **Add a vendor** | Vendors > New > fill details (name, tax ID, W-9 status) |
| **Add a donor** | Donors > New > fill details (name, address, email) |
| **Review budget variance** | Budgets > select period > view variance tab |
| **Cash flow projection** | Budgets > Cash Projection |
| **Export to CSV** | Any report > Export > CSV |
| **Export to PDF** | Any report > Export > PDF |
| **View staging records** | Settings > Staging Records |
| **Convert CIP to fixed asset** | Assets > CIP > select project > Convert |

## Where to Find...

| Information | Location |
|-------------|----------|
| Current bank balances | Dashboard (cash snapshot) or Reports > Cash Position |
| Outstanding payables | Liabilities > Accounts Payable or Reports > Outstanding Payables |
| Upcoming deadlines | Dashboard (alerts) or Compliance calendar |
| Fund-specific financials | Any report > filter by fund, or Reports > Fund Level |
| Fund drawdown status | Reports > Fund Drawdown |
| Grant/funding compliance | Reports > Grant Compliance |
| Audit trail | Transaction detail > audit log tab, or Reports > Audit Log |
| Late entries | Reports > Late Entries |
| Donor acknowledgments | Donors > select donor > acknowledgment history |
| Donor giving history | Reports > Donor Giving History |
| 1099 vendor totals | Vendors > filter by 1099-eligible |
| CIP project costs | Assets > CIP Balances |
| Prepaid amortization | Assets > Prepaid Schedules or Reports > Amortization Schedule |
| Developer fee schedule | Assets > Developer Fee |
| Staging records | Settings > Staging Records |
| AHP loan interest | Transactions (filter source: CRON, account: 2520) |
| Property expenses | Reports > Property Expenses |
| Utility trends | Reports > Utility Trends |
| Security deposit register | Reports > Security Deposit Register |
| Rent collection | Reports > Rent Collection |
| Payroll register | Reports > Payroll Register |
| Payroll tax liability | Reports > Payroll Tax Liability |
| Employer payroll costs | Reports > Employer Payroll Cost |
| W-2 verification | Reports > W-2 Verification |
| Quarterly tax prep | Reports > Quarterly Tax Prep |

## Automated Processes

| What | When | Verify In |
|------|------|-----------|
| Bank sync (Plaid) | Daily 7 AM UTC | Bank Rec page |
| Ramp sync | Daily 6 AM UTC | Ramp Queue |
| Compliance reminders | Daily 6 AM UTC | Email inbox |
| Staging processor | Every 15 min (weekdays, business hours) | Settings > Staging Records |
| Depreciation | 1st of month, 6 AM UTC | Transactions (source: CRON) |
| Interest accrual | 28th of month, 6 AM UTC | Transactions (source: CRON) |
| Prepaid amortization | 1st of month, 6 AM UTC | Transactions (source: CRON) |
| Rent accrual | 1st of month, 6 AM UTC | Transactions (source: CRON) |
| Security deposit interest | 1st of month, 6 AM UTC | Transactions (source: CRON) |

## Key Accounts

| Code | Account | Normal Balance |
|------|---------|---------------|
| 1000 | Business Checking | Debit |
| 1010 | Business Savings | Debit |
| 1100 | Accounts Receivable | Debit |
| 1200 | Prepaid Expenses | Debit |
| 1500 | Construction in Progress | Debit |
| 2000 | Accounts Payable | Credit |
| 2020 | Credit Card Payable (Ramp) | Credit |
| 2100 | Accrued Payroll | Credit |
| 2500 | Loans Payable | Credit |
| 2520 | Accrued Interest Payable | Credit |
| 3000 | Unrestricted Net Assets | Credit |
| 3100 | Restricted Net Assets | Credit |
| 4100 | Grant Revenue | Credit |
| 5100 | Interest Expense | Debit |

## Funds

| Fund | Restriction | Notes |
|------|-------------|-------|
| General Fund | Unrestricted | System-locked, default for unclassified activity |
| CPA Fund | Restricted | Community Preservation Act grant |
| MassDev Fund | Restricted | MassDevelopment grant |
| HTC Equity Fund | Restricted | Historic Tax Credit equity |
| MassSave Fund | Restricted | Energy efficiency grant |

AHP Line of Credit is tracked via account 2500 (Loans Payable), not as a separate fund.

## Help

- **AI Copilot:** Open the copilot panel on any page for contextual help
- **System issues:** Contact Jeff (system admin)
- **Accounting questions:** The copilot understands nonprofit fund accounting, GAAP, and RI's specific chart of accounts
