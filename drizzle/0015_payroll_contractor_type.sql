-- Add contractor_type to payroll_entries to distinguish W2 employees
-- from 1099 contractors for correct GL posting and withholding logic.
ALTER TABLE "payroll_entries" ADD COLUMN "contractor_type" varchar(10) DEFAULT 'W2';
