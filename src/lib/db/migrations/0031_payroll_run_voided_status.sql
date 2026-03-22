-- Add REVERSED status to payroll_run_status enum (renamed from VOIDED)
ALTER TYPE payroll_run_status ADD VALUE IF NOT EXISTS 'REVERSED';
