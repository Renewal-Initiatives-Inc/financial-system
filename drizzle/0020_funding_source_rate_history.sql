-- Phase 8: Funding source rate history for loan interest rate tracking
CREATE TABLE IF NOT EXISTS "funding_source_rate_history" (
  "id" serial PRIMARY KEY NOT NULL,
  "fund_id" integer NOT NULL REFERENCES "funds"("id"),
  "rate" numeric(7, 4) NOT NULL,
  "effective_date" date NOT NULL,
  "reason" text NOT NULL,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fsrh_fund_id_idx" ON "funding_source_rate_history" ("fund_id");
CREATE INDEX IF NOT EXISTS "fsrh_fund_effective_idx" ON "funding_source_rate_history" ("fund_id", "effective_date");

-- Seed initial rate history for any existing LOAN funding sources that have an interest rate
INSERT INTO "funding_source_rate_history" ("fund_id", "rate", "effective_date", "reason", "created_by")
SELECT "id", "interest_rate", CURRENT_DATE, 'Initial rate from funding source setup', 'migration'
FROM "funds"
WHERE "funding_category" = 'LOAN' AND "interest_rate" IS NOT NULL;
