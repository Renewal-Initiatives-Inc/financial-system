-- Phase 23c Task 11: Weekly cash projection schema
-- Adds projectionType to cash_projections and creates weekly_cash_projection_lines table

-- New enums
DO $$ BEGIN
  CREATE TYPE "projection_type" AS ENUM ('MONTHLY', 'WEEKLY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "confidence_level" AS ENUM ('HIGH', 'MODERATE', 'LOW');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add projection_type to cash_projections (defaults existing rows to 'MONTHLY')
ALTER TABLE "cash_projections"
  ADD COLUMN "projection_type" "projection_type" NOT NULL DEFAULT 'MONTHLY';

-- Create weekly_cash_projection_lines table
CREATE TABLE IF NOT EXISTS "weekly_cash_projection_lines" (
  "id" serial PRIMARY KEY NOT NULL,
  "projection_id" integer NOT NULL REFERENCES "cash_projections"("id") ON DELETE CASCADE,
  "week_number" integer NOT NULL,
  "week_start_date" date NOT NULL,
  "source_label" varchar(255) NOT NULL,
  "auto_amount" numeric(15, 2) NOT NULL,
  "override_amount" numeric(15, 2),
  "override_note" text,
  "line_type" "projection_line_type" NOT NULL,
  "confidence_level" "confidence_level" NOT NULL,
  "fund_id" integer REFERENCES "funds"("id"),
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamp DEFAULT now() NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS "weekly_cash_proj_lines_projection_id_idx"
  ON "weekly_cash_projection_lines" ("projection_id");
CREATE INDEX IF NOT EXISTS "weekly_cash_proj_lines_week_number_idx"
  ON "weekly_cash_projection_lines" ("week_number");
