-- Phase 22 Step 8: Import Review Items table
-- One-time-use table for interactive QBO import review workflow.
-- Stores parsed QBO transactions with recommendations for Jeff + Heather
-- to review, edit, approve/skip before posting to GL.

CREATE TYPE "import_review_status" AS ENUM ('pending', 'approved', 'skipped');

CREATE TABLE "import_review_items" (
  "id" serial PRIMARY KEY NOT NULL,
  "batch_id" varchar(50) NOT NULL,
  "qbo_transaction_no" varchar(50) NOT NULL,
  "transaction_date" date NOT NULL,
  "amount" numeric(15, 2) NOT NULL,
  "parsed_data" jsonb NOT NULL,
  "description" text NOT NULL,
  "recommendation" jsonb NOT NULL,
  "match_data" jsonb,
  "accrual_data" jsonb,
  "user_selections" jsonb,
  "status" "import_review_status" DEFAULT 'pending' NOT NULL,
  "gl_transaction_id" integer REFERENCES "transactions"("id"),
  "approved_by" varchar(255),
  "approved_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "import_review_batch_txn_unique" UNIQUE("batch_id", "qbo_transaction_no")
);

CREATE INDEX "import_review_batch_idx" ON "import_review_items" ("batch_id");
CREATE INDEX "import_review_status_idx" ON "import_review_items" ("status");
CREATE UNIQUE INDEX "import_review_batch_txn_idx" ON "import_review_items" ("batch_id", "qbo_transaction_no");
