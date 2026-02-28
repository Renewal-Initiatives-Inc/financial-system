CREATE TYPE "public"."revenue_classification" AS ENUM('GRANT_REVENUE', 'EARNED_INCOME');--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN "revenue_classification" "revenue_classification";--> statement-breakpoint
ALTER TABLE "funds" ADD COLUMN "classification_rationale" text;--> statement-breakpoint
-- Backfill: all existing restricted funds are grants
UPDATE "funds" SET "revenue_classification" = 'GRANT_REVENUE' WHERE "restriction_type" = 'RESTRICTED';
