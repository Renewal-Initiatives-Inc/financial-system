# Quick Reference Card

## Navigation

| Section | Path | What's There |
|---------|------|-------------|
| Dashboard | `/` | Cash snapshot, alerts, fund balances, recent activity |
| Transactions | `/transactions` | All GL entries, create new, filter/search |
| Chart of Accounts | `/accounts` | 69 GL accounts, codes, types, 990 mappings |
| Funds | `/funds` | 6 funds (1 unrestricted, 5 restricted) |
| Revenue | `/revenue` | Donations, grants, pledges, rent income |
| Expenses | `/expenses` | Payables, purchase orders, invoices |
| Ramp Queue | `/expenses/ramp` | Categorize credit card transactions |
| Payroll | `/payroll` | Pay runs, withholdings, W-2 generation |
| Bank Rec | `/bank-rec` | Match bank ↔ GL, confirm/reject matches |
| Reports | `/reports` | Balance sheet, activities, cash flows, 990 |
| Budgets | `/budgets` | Budget entry, variance tracking, projections |
| Compliance | `/compliance` | Filing deadlines, calendar, reminders |
| Vendors | `/vendors` | Vendor directory, 1099 tracking, W-9 status |
| Tenants | `/tenants` | Lease details, security deposits |
| Donors | `/donors` | Donor directory, acknowledgment history |
| Assets | `/assets` | Fixed assets, CIP, prepaid schedules |
| Settings | `/settings` | Annual rates, bank accounts, system config |

## How To...

| Task | Steps |
|------|-------|
| **Create a journal entry** | Transactions > New > add lines > Post |
| **Record a donation** | Revenue > Donations > fill form (auto-creates journal entry) |
| **Categorize Ramp** | Expenses > Ramp > click transaction > select account + fund |
| **Create Ramp rule** | Expenses > Ramp > Rules > Create Rule |
| **Run payroll** | Payroll > New Run > follow wizard |
| **Generate a report** | Reports > select report > set date range > view or Export PDF |
| **Reconcile bank** | Bank Rec > review matches > Confirm or Reject |
| **Check compliance** | Compliance > view calendar > mark filings complete |
| **Void a transaction** | Transaction detail > Void > confirm |
| **Add a vendor** | Vendors > New > fill details (name, tax ID, W-9 status) |
| **Add a donor** | Donors > New > fill details (name, address, email) |
| **Review budget variance** | Budgets > select period > view variance tab |
| **Export to CSV** | Any report > Export > CSV |
| **Export to PDF** | Any report > Export > PDF |
| **Record a grant** | Revenue > Grants > New > fill details |
| **Record rent payment** | Revenue > Rent > Payment > select tenant |
| **View staging records** | Settings > Staging Records |
| **Functional allocation** | Compliance > Functional Allocation > wizard |

## Where to Find...

| Information | Location |
|-------------|----------|
| Current bank balances | Dashboard (cash snapshot) or Reports > Cash Position |
| Outstanding payables | Expenses (filter by unpaid) |
| Upcoming deadlines | Dashboard (alerts) or Compliance calendar |
| Fund-specific financials | Any report > filter by fund |
| Audit trail | Transaction detail > audit log tab |
| Donor acknowledgments | Donors > select donor > acknowledgment history |
| 1099 vendor totals | Vendors > filter by 1099-eligible |
| CIP project costs | Assets > CIP Balances |
| Staging records | Settings > Staging Records |
| AHP loan status | Reports > AHP Loan Summary |
| Functional allocation | Compliance > Functional Allocation |

## Automated Processes

| What | When | Verify In |
|------|------|-----------|
| Bank sync (Plaid) | Daily 7 AM UTC | Bank Rec page |
| Ramp sync | Daily 6 AM UTC | Ramp Queue |
| Compliance reminders | Daily 6 AM UTC | Email inbox |
| Staging processor | Every 15min (weekdays) | Transactions (source: STAGING) |
| Depreciation | 1st of month | Transactions (source: CRON) |
| Interest accrual | 28th of month | Transactions (source: CRON) |
| Prepaid amortization | 1st of month | Transactions (source: CRON) |
| Rent accrual | 1st of month | Transactions (source: CRON) |
| Security deposit interest | 1st of month (anniversary) | Transactions (source: CRON) |

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
| 3000 | Unrestricted Net Assets | Credit |
| 3100 | Restricted Net Assets | Credit |

## Help

- **AI Copilot:** Open the copilot panel on any page for contextual help
- **System issues:** Contact Jeff (system admin)
- **Accounting questions:** The copilot understands nonprofit fund accounting, GAAP, and RI's specific chart of accounts
