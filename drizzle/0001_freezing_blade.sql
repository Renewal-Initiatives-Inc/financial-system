CREATE TYPE "public"."contribution_source_type" AS ENUM('GOVERNMENT', 'PUBLIC', 'RELATED_PARTY');--> statement-breakpoint
CREATE TYPE "public"."donor_type" AS ENUM('INDIVIDUAL', 'CORPORATE', 'FOUNDATION', 'GOVERNMENT');--> statement-breakpoint
CREATE TYPE "public"."funding_source_type" AS ENUM('TENANT_DIRECT', 'VASH', 'MRVP', 'SECTION_8', 'OTHER_VOUCHER');--> statement-breakpoint
CREATE TYPE "public"."w9_status" AS ENUM('COLLECTED', 'PENDING', 'NOT_REQUIRED');--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" text,
	"tax_id" text,
	"entity_type" varchar(50),
	"is_1099_eligible" boolean DEFAULT false NOT NULL,
	"default_account_id" integer,
	"default_fund_id" integer,
	"w9_status" "w9_status" DEFAULT 'NOT_REQUIRED' NOT NULL,
	"w9_collected_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"unit_number" varchar(20) NOT NULL,
	"lease_start" date,
	"lease_end" date,
	"monthly_rent" numeric(12, 2) NOT NULL,
	"funding_source_type" "funding_source_type" NOT NULL,
	"move_in_date" date,
	"security_deposit_amount" numeric(12, 2),
	"escrow_bank_ref" varchar(255),
	"deposit_date" date,
	"interest_rate" numeric(5, 4),
	"statement_of_condition_date" date,
	"tenancy_anniversary" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "donors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"address" varchar(1000),
	"email" varchar(255),
	"type" "donor_type" NOT NULL,
	"first_gift_date" date,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_account_id_accounts_id_fk" FOREIGN KEY ("default_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_default_fund_id_funds_id_fk" FOREIGN KEY ("default_fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendors_name_idx" ON "vendors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "vendors_is_active_idx" ON "vendors" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "tenants_unit_number_idx" ON "tenants" USING btree ("unit_number");--> statement-breakpoint
CREATE INDEX "tenants_is_active_idx" ON "tenants" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "donors_name_idx" ON "donors" USING btree ("name");--> statement-breakpoint
CREATE INDEX "donors_is_active_idx" ON "donors" USING btree ("is_active");