# Handoff: Interest Accrual Cron Implementation

## Task
Implement the monthly interest accrual cron job for LOAN-category funding sources. The cron route exists but is stubbed. All building blocks are in place.

## Context
- Renewal Initiatives has an AHP Line of Credit: $3.5M facility, 4.75% annual rate, first draw $100K on 2025-11-18
- Interest accrues monthly on the drawn balance (not the facility cap)
- The system must post a monthly journal entry: DR Interest Expense / CR Accrued Interest Payable
- When an actual interest payment is made, it reverses the accrual: DR Accrued Interest Payable / CR Cash

## What Exists

### Stubbed cron route
`src/app/api/cron/interest-accrual/route.ts` — currently returns "disabled" message. Scheduled in `vercel.json` at `0 6 28 * *` (28th of each month at 6am UTC).

### Building blocks (all working)
- **`getEffectiveRate(fundId, date)`** in `src/lib/assets/interest-accrual.ts:38` — looks up rate from `funding_source_rate_history` table for a given date
- **`calculatePeriodInterest(principal, rate, startDate, endDate)`** in `src/lib/assets/interest-accrual.ts:61` — Actual/365 day-count convention, returns rounded cents
- **`recordLoanInterestPayment(fundId, amount, date, userId)`** in `src/lib/revenue/funding-sources.ts:339` — posts DR 5100 Interest Expense / CR 1000 Cash (this is for actual payments, not accruals)
- **`createTransaction()`** in `src/lib/transactions/` — the GL posting function used by all transaction types

### Relevant GL accounts
| Code | Name | Role |
|---|---|---|
| 1000 | Cash | Credit on payment |
| 2500 | Loans Payable | Drawn balance lives here (credit = draw, debit = repayment) |
| 2520 | Accrued Interest Payable | Credit on accrual, debit on payment |
| 5100 | Interest Expense | Debit on accrual |

### Schema
- `funds` table: `funding_category = 'LOAN'`, `interest_rate`, `start_date`, `status`
- `funding_source_rate_history` table: rate history with effective dates
- `transaction_lines` table: every GL line has `account_id` and `fund_id`

## Implementation Steps

### 1. Calculate drawn balance
Query the GL for the net balance on account 2500 filtered by fund_id:
```sql
SELECT COALESCE(SUM(credit), 0) - COALESCE(SUM(debit), 0) as drawn_balance
FROM transaction_lines tl
JOIN transactions t ON t.id = tl.transaction_id
WHERE tl.account_id = (SELECT id FROM accounts WHERE code = '2500')
  AND tl.fund_id = :fundId
  AND t.date <= :asOfDate
```

### 2. Calculate monthly interest
Use `calculatePeriodInterest(drawnBalance, rate, periodStart, periodEnd)`.
- Period = 1st of month to last day of month (or use 28th-to-28th to match cron schedule)
- Rate comes from `getEffectiveRate(fundId, periodEndDate)`

### 3. Post accrual journal entry
```
DR 5100 Interest Expense    $X.XX  (fund = loan fund)
CR 2520 Accrued Interest     $X.XX  (fund = loan fund)
```
Use `createTransaction()` with:
- `sourceType: 'ACCRUAL'`
- `sourceReferenceId: 'interest-accrual:{fundId}:{YYYY-MM}'`
- `isSystemGenerated: true`
- `createdBy: 'system:interest-accrual'`

### 4. Idempotency guard
Before posting, check if an accrual already exists for this fund+month:
```sql
SELECT id FROM transactions
WHERE source_reference_id = 'interest-accrual:{fundId}:{YYYY-MM}'
```
Skip if found. This prevents double-posting if the cron retries.

### 5. Handle interest payments
When `recordLoanInterestPayment` is called (actual cash payment), it should also reverse the accrual:
- DR 2520 Accrued Interest Payable / CR 1000 Cash (instead of current DR 5100 / CR 1000)
- This means modifying `recordLoanInterestPayment` to hit 2520 instead of 5100 when an accrual exists for the period
- Alternative (simpler): keep the payment as-is (DR 5100 / CR Cash) and post a separate reversal (DR 2520 / CR 5100) when the payment is recorded. This avoids changing the existing function.

### 6. Catch-up for historical months
The QBO import will bring in the 12/19/2025 interest payment ($572.60) as a historical transaction. The cron should handle catch-up: when first enabled, calculate accruals for any past months where the loan was outstanding but no accrual was posted. For the AHP loan:
- Nov 2025: ~$100K * 4.75% * (12 days / 365) = ~$15.62
- Dec 2025: ~$100K * 4.75% * (31 days / 365) = ~$403.42
- Total accrued ≈ $419.04 (vs $572.60 actually paid — difference is because AHP may use a different day-count or the rate/dates differ slightly)

Alternatively, skip catch-up for pre-2026 months since the QBO import handles the actual payment. Start accruing from Jan 2026 onward.

## Testing
- Unit test `calculatePeriodInterest` with known values (already pure function)
- Integration test: create a LOAN fund, post a draw, run the cron, verify GL entries
- Idempotency test: run the cron twice for the same month, verify only one entry

## Files to modify
1. `src/app/api/cron/interest-accrual/route.ts` — replace stub with real logic
2. `src/lib/assets/interest-accrual.ts` — add `getDrawnBalance(fundId, asOfDate)` and `accrueInterest(fundId, month)` functions
3. `src/lib/revenue/funding-sources.ts` — optionally update `recordLoanInterestPayment` to reverse accrual
