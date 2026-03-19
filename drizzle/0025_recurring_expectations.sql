-- Phase 23a Task 1: Recurring Expectations table
-- Predictable transactions (rent, utilities, insurance, loan payments)
-- that feed into auto-matching and cash forecasting.

CREATE TABLE recurring_expectations (
  id SERIAL PRIMARY KEY,
  merchant_pattern VARCHAR(255) NOT NULL,
  description VARCHAR(255) NOT NULL,
  expected_amount NUMERIC(15, 2) NOT NULL,
  amount_tolerance NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
  frequency VARCHAR(20) NOT NULL,
  expected_day INTEGER NOT NULL,
  gl_account_id INTEGER NOT NULL REFERENCES accounts(id),
  fund_id INTEGER NOT NULL REFERENCES funds(id),
  bank_account_id INTEGER NOT NULL REFERENCES bank_accounts(id),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_matched_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX recurring_expectations_bank_account_idx ON recurring_expectations(bank_account_id);
CREATE INDEX recurring_expectations_active_idx ON recurring_expectations(is_active);
