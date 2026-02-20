-- Phase 4: Add fund_id FK to compliance_deadlines
-- Enables dynamic deadline generation linked to funding sources
ALTER TABLE "compliance_deadlines" ADD COLUMN "fund_id" integer;
ALTER TABLE "compliance_deadlines" ADD CONSTRAINT "compliance_deadlines_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "funds"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
CREATE INDEX "compliance_deadlines_fund_id_idx" ON "compliance_deadlines"("fund_id");
