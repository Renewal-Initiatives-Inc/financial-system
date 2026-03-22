-- Migration 0030: Add invoice match suggestion columns to bank_transactions
ALTER TABLE bank_transactions ADD COLUMN suggested_invoice_id integer REFERENCES invoices(id);
ALTER TABLE bank_transactions ADD COLUMN invoice_match_confidence numeric(5,2);
