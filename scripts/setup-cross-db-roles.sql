-- ============================================================
-- Cross-Neon Postgres Roles for Financial System
-- Run this in the Neon SQL Editor for financial-system-prod
-- ============================================================
--
-- These roles allow renewal-timesheets and expense-reports-homegrown
-- to INSERT staging records into the financial-system database.
-- Each role has minimal permissions: SELECT on reference tables,
-- INSERT + SELECT on staging_records. No UPDATE or DELETE.
--
-- After running this, share the connection strings with each app:
--   postgresql://timesheets_role:<PASSWORD>@<NEON_HOST>/neondb?sslmode=require
--   postgresql://expense_reports_role:<PASSWORD>@<NEON_HOST>/neondb?sslmode=require
-- ============================================================

-- 1. Create restricted roles
-- IMPORTANT: Replace the passwords with real values before running!
CREATE ROLE timesheets_role LOGIN PASSWORD 'CHANGE_ME_timesheets';
CREATE ROLE expense_reports_role LOGIN PASSWORD 'CHANGE_ME_expense_reports';

-- 2. Grant USAGE on the public schema (required for Neon)
GRANT USAGE ON SCHEMA public TO timesheets_role, expense_reports_role;

-- 3. Grant SELECT on reference tables (for fund/account lookups)
GRANT SELECT ON accounts, funds, vendors TO timesheets_role, expense_reports_role;

-- 3b. Grant SELECT on annual_rate_config (for mileage rate reads in expense-reports)
GRANT SELECT ON annual_rate_config TO expense_reports_role;

-- 4. Grant INSERT + SELECT on staging_records (no UPDATE, no DELETE)
GRANT INSERT, SELECT ON staging_records TO timesheets_role, expense_reports_role;

-- 5. Grant USAGE on sequences (needed for INSERT with serial PK)
GRANT USAGE ON SEQUENCE staging_records_id_seq TO timesheets_role, expense_reports_role;

-- ============================================================
-- Verification: test each role can SELECT from reference tables
-- ============================================================
-- SET ROLE timesheets_role;
-- SELECT count(*) FROM accounts;
-- SELECT count(*) FROM funds;
-- SELECT count(*) FROM vendors;
-- RESET ROLE;
--
-- SET ROLE expense_reports_role;
-- SELECT count(*) FROM accounts;
-- RESET ROLE;

-- ============================================================
-- Verification: test INSERT into staging_records
-- ============================================================
-- SET ROLE timesheets_role;
-- INSERT INTO staging_records (
--   source_app, source_record_id, record_type,
--   employee_id, reference_id, date_incurred,
--   amount, fund_id, gl_account_id, metadata
-- ) VALUES (
--   'timesheets', 'TEST-VERIFY-001', 'timesheet_fund_summary',
--   'emp-001', 'TEST-VERIFY', '2026-02-16',
--   '100.00', 1, NULL,
--   '{"regularHours": 2.5, "overtimeHours": 0, "regularEarnings": 100.00, "overtimeEarnings": 0}'
-- );
-- RESET ROLE;
--
-- -- Clean up test record
-- DELETE FROM staging_records WHERE source_record_id = 'TEST-VERIFY-001';
