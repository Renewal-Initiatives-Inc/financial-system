-- Phase 6: AHP Singleton Teardown
-- Drop the ahp_loan_config table. The AHP loan will be tracked as a
-- regular funding source through the standard flow (Phase 8).
-- Account 2500 (AHP Loan Payable) is retained in the chart of accounts.

DROP TABLE IF EXISTS "ahp_loan_config";
