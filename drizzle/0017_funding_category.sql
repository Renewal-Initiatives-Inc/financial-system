-- Phase 5: Funding Category dimension
-- Adds GRANT / CONTRACT / LOAN category to funding sources,
-- orthogonal to restriction type (RESTRICTED / UNRESTRICTED).

CREATE TYPE "funding_category" AS ENUM ('GRANT', 'CONTRACT', 'LOAN');

ALTER TABLE "funds" ADD COLUMN "funding_category" "funding_category";

-- Backfill: all existing restricted funds are grants per bookkeeper confirmation.
-- General Fund (unrestricted, system-locked) stays NULL — it's not a user-created funding source.
UPDATE "funds" SET "funding_category" = 'GRANT'
  WHERE "restriction_type" = 'RESTRICTED';

-- Interest rate for loan-type funding sources (precision 7, scale 4 → up to 999.9999%)
ALTER TABLE "funds" ADD COLUMN "interest_rate" numeric(7, 4);
