-- Funding Source Migration: Collapse grants into enriched funds table
-- Renames enums, adds columns, migrates data, drops grants table

-- Step 1: Rename enums
ALTER TYPE "grant_type" RENAME TO "funding_type";
ALTER TYPE "grant_status" RENAME TO "funding_status";

-- Step 2: Add new columns to funds table
ALTER TABLE "funds" ADD COLUMN "funder_id" integer;
ALTER TABLE "funds" ADD COLUMN "amount" numeric(15, 2);
ALTER TABLE "funds" ADD COLUMN "type" "funding_type";
ALTER TABLE "funds" ADD COLUMN "conditions" text;
ALTER TABLE "funds" ADD COLUMN "start_date" date;
ALTER TABLE "funds" ADD COLUMN "end_date" date;
ALTER TABLE "funds" ADD COLUMN "status" "funding_status" DEFAULT 'ACTIVE';
ALTER TABLE "funds" ADD COLUMN "is_unusual_grant" boolean NOT NULL DEFAULT false;
ALTER TABLE "funds" ADD COLUMN "contract_pdf_url" text;
ALTER TABLE "funds" ADD COLUMN "extracted_milestones" jsonb;
ALTER TABLE "funds" ADD COLUMN "extracted_terms" jsonb;
ALTER TABLE "funds" ADD COLUMN "extracted_covenants" jsonb;
ALTER TABLE "funds" ADD COLUMN "match_requirement_percent" numeric(5, 2);
ALTER TABLE "funds" ADD COLUMN "retainage_percent" numeric(5, 2);
ALTER TABLE "funds" ADD COLUMN "reporting_frequency" varchar(50);

-- Step 3: Add FK constraint
ALTER TABLE "funds" ADD CONSTRAINT "funds_funder_id_vendors_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;

-- Step 4: Migrate grant data into funds
UPDATE "funds" SET
  "funder_id" = g."funder_id",
  "amount" = g."amount",
  "type" = g."type",
  "conditions" = g."conditions",
  "start_date" = g."start_date",
  "end_date" = g."end_date",
  "status" = g."status",
  "is_unusual_grant" = g."is_unusual_grant"
FROM "grants" g WHERE g."fund_id" = "funds"."id";

-- Step 5: Update sourceReferenceId patterns in transactions
UPDATE "transactions" SET "source_reference_id" = REPLACE("source_reference_id", 'grant-condition-met:', 'fund-condition-met:') WHERE "source_reference_id" LIKE 'grant-condition-met:%';
UPDATE "transactions" SET "source_reference_id" = REPLACE("source_reference_id", 'grant-conditional-cash:', 'fund-conditional-cash:') WHERE "source_reference_id" LIKE 'grant-conditional-cash:%';
UPDATE "transactions" SET "source_reference_id" = REPLACE("source_reference_id", 'grant-receipt:', 'fund-receipt:') WHERE "source_reference_id" LIKE 'grant-receipt:%';
UPDATE "transactions" SET "source_reference_id" = REPLACE("source_reference_id", 'grant:', 'fund:') WHERE "source_reference_id" LIKE 'grant:%';

-- Step 6: Drop grants table
DROP TABLE "grants";

-- Step 7: Add indexes
CREATE INDEX "funds_funder_id_idx" ON "funds" USING btree ("funder_id");
CREATE INDEX "funds_status_idx" ON "funds" USING btree ("status");
