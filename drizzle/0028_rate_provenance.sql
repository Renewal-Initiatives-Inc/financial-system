-- Add provenance fields and JSON value support to annual_rate_config (Phase 23)
ALTER TABLE "annual_rate_config" ADD COLUMN IF NOT EXISTS "source_document" varchar(255);
ALTER TABLE "annual_rate_config" ADD COLUMN IF NOT EXISTS "source_url" text;
ALTER TABLE "annual_rate_config" ADD COLUMN IF NOT EXISTS "verified_date" date;
ALTER TABLE "annual_rate_config" ADD COLUMN IF NOT EXISTS "json_value" jsonb;
