-- Add zitadel_user_id to vendors table to link 1099 contractors
-- to their timesheet identity for correct payroll treatment.
ALTER TABLE "vendors" ADD COLUMN "zitadel_user_id" varchar(255);
CREATE UNIQUE INDEX "vendors_zitadel_user_id_idx" ON "vendors" ("zitadel_user_id") WHERE "zitadel_user_id" IS NOT NULL;
