-- Fix interest rate stored as percentage (4.75) instead of decimal (0.0475)
-- Fund 7 (AHP Revolving Credit Loan) was created with percentage value from form input.
-- The interest accrual cron expects decimal: principal * rate * days/365.

-- Fix funds.interest_rate
UPDATE funds
SET interest_rate = interest_rate / 100,
    updated_at = NOW()
WHERE id = 7
  AND interest_rate > 1;  -- safety: only fix if still stored as percentage

-- Fix funding_source_rate_history.rate
UPDATE funding_source_rate_history
SET rate = rate / 100
WHERE fund_id = 7
  AND rate > 1;  -- safety: only fix if still stored as percentage
