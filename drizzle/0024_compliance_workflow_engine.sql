-- Create enums
CREATE TYPE "public"."workflow_state" AS ENUM('not_started', 'checklist', 'scan', 'draft', 'delivered');
CREATE TYPE "public"."workflow_step" AS ENUM('checklist', 'scan', 'draft', 'delivery');
CREATE TYPE "public"."workflow_type" AS ENUM(
  'tax_form_990', 'tax_form_pc', 'tax_w2', 'tax_1099_nec', 'tax_941', 'tax_m941',
  'annual_review', 'annual_attestation', 'budget_cycle',
  'grant_report', 'grant_closeout', 'grant_milestone', 'tenant_deposit'
);

-- Extend compliance_deadlines
ALTER TABLE "compliance_deadlines"
  ADD COLUMN "workflow_state" "workflow_state" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "workflow_type" "workflow_type",
  ADD COLUMN "is_reminder" boolean NOT NULL DEFAULT false,
  ADD COLUMN "parent_deadline_id" integer REFERENCES "compliance_deadlines"("id"),
  ADD COLUMN "google_event_id" varchar(255),
  ADD COLUMN "google_reminder_event_id" varchar(255),
  ADD COLUMN "legal_citation" text,
  ADD COLUMN "reference_url" text,
  ADD COLUMN "recommended_actions" text,
  ADD COLUMN "authority_source" varchar(100);

-- Create compliance_workflow_logs
CREATE TABLE "compliance_workflow_logs" (
  "id" serial PRIMARY KEY,
  "deadline_id" integer NOT NULL REFERENCES "compliance_deadlines"("id"),
  "step" "workflow_step" NOT NULL,
  "action" varchar(50) NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "data" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "compliance_workflow_logs_deadline_idx" ON "compliance_workflow_logs" ("deadline_id");
CREATE INDEX "compliance_workflow_logs_created_at_idx" ON "compliance_workflow_logs" ("created_at");

-- Create compliance_artifacts
CREATE TABLE "compliance_artifacts" (
  "id" serial PRIMARY KEY,
  "deadline_id" integer NOT NULL REFERENCES "compliance_deadlines"("id"),
  "artifact_type" varchar(50) NOT NULL,
  "blob_url" text NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_size" integer,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "compliance_artifacts_deadline_idx" ON "compliance_artifacts" ("deadline_id");
CREATE INDEX "compliance_artifacts_created_at_idx" ON "compliance_artifacts" ("created_at");
