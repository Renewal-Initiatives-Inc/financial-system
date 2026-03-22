-- Migration 0029: Simplify invoice_payment_status enum and add bank linkage columns
-- Collapses 5-value enum to 2 values: POSTED, PAID
-- Adds columns to link invoices to bank transactions and clearing GL entries

-- Step 1: Collapse all intermediate statuses to POSTED (PAID stays PAID)
UPDATE invoices SET payment_status = 'POSTED' WHERE payment_status IN ('PENDING', 'PAYMENT_IN_PROCESS', 'MATCHED_TO_PAYMENT');

-- Step 2: Replace the enum type (Postgres requires create-new / alter / drop-old)
ALTER TYPE invoice_payment_status RENAME TO invoice_payment_status_old;

CREATE TYPE invoice_payment_status AS ENUM ('POSTED', 'PAID');

ALTER TABLE invoices
  ALTER COLUMN payment_status TYPE invoice_payment_status
  USING payment_status::text::invoice_payment_status;

ALTER TABLE invoices
  ALTER COLUMN payment_status SET DEFAULT 'POSTED';

DROP TYPE invoice_payment_status_old;

-- Step 3: Add bank linkage columns
ALTER TABLE invoices ADD COLUMN bank_transaction_id integer REFERENCES bank_transactions(id);
ALTER TABLE invoices ADD COLUMN clearing_transaction_id integer REFERENCES transactions(id);
ALTER TABLE invoices ADD COLUMN paid_at timestamp;

-- Step 4: Add BANK_MATCH to source_type enum for clearing JEs
ALTER TYPE source_type ADD VALUE IF NOT EXISTS 'BANK_MATCH';
