-- Add vendor_id to tenants for AP aging linkage (security deposit interest, etc.)
-- Nullable: set via tenant management UI when tenant has a corresponding vendor record.
ALTER TABLE "tenants" ADD COLUMN "vendor_id" integer REFERENCES "vendors"("id");
CREATE INDEX "tenants_vendor_id_idx" ON "tenants" ("vendor_id") WHERE "vendor_id" IS NOT NULL;
