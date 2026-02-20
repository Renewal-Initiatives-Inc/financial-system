-- Phase 5: AR Invoice support
-- Make purchaseOrderId nullable, add fundId FK and direction column.
-- AP invoices (direction='AP'): purchaseOrderId required, vendorId required.
-- AR invoices (direction='AR'): fundId required, used to bill funders.

ALTER TABLE "invoices" ALTER COLUMN "purchase_order_id" DROP NOT NULL;
ALTER TABLE "invoices" ALTER COLUMN "vendor_id" DROP NOT NULL;
ALTER TABLE "invoices" ADD COLUMN "direction" varchar(2) NOT NULL DEFAULT 'AP';
ALTER TABLE "invoices" ADD COLUMN "fund_id" integer;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_direction_check" CHECK ("direction" IN ('AP', 'AR'));
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_source_check" CHECK (
  ("direction" = 'AP' AND "purchase_order_id" IS NOT NULL AND "vendor_id" IS NOT NULL) OR
  ("direction" = 'AR' AND "fund_id" IS NOT NULL)
);
CREATE INDEX "invoices_fund_id_idx" ON "invoices"("fund_id");
CREATE INDEX "invoices_direction_idx" ON "invoices"("direction");
