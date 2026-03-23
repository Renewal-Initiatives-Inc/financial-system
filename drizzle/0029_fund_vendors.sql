CREATE TABLE IF NOT EXISTS "fund_vendors" (
  "id" serial PRIMARY KEY NOT NULL,
  "fund_id" integer NOT NULL REFERENCES "funds"("id"),
  "vendor_id" integer NOT NULL REFERENCES "vendors"("id"),
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "fund_vendors_fund_vendor_unique" UNIQUE("fund_id", "vendor_id")
);

CREATE INDEX IF NOT EXISTS "fund_vendors_fund_id_idx" ON "fund_vendors" ("fund_id");
CREATE INDEX IF NOT EXISTS "fund_vendors_vendor_id_idx" ON "fund_vendors" ("vendor_id");
