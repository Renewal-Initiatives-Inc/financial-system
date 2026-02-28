-- Rename account 2500 from "AHP Loan Payable" to "Loans Payable".
-- Per-loan tracking uses the fund dimension (each loan is a LOAN-category funding source).
-- QBO mapping retains "AHP Loan Payable" as an alias so historical imports still resolve.

UPDATE "accounts" SET "name" = 'Loans Payable', "updated_at" = NOW()
  WHERE "code" = '2500';
