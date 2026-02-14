CREATE TYPE "public"."depreciation_method" AS ENUM('STRAIGHT_LINE');--> statement-breakpoint
CREATE TYPE "public"."grant_status" AS ENUM('ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."grant_type" AS ENUM('CONDITIONAL', 'UNCONDITIONAL');--> statement-breakpoint
CREATE TYPE "public"."pledge_status" AS ENUM('PLEDGED', 'RECEIVED', 'WRITTEN_OFF');--> statement-breakpoint
CREATE TABLE "fixed_assets" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"acquisition_date" date NOT NULL,
	"cost" numeric(15, 2) NOT NULL,
	"salvage_value" numeric(15, 2) DEFAULT '0' NOT NULL,
	"useful_life_months" integer NOT NULL,
	"depreciation_method" "depreciation_method" DEFAULT 'STRAIGHT_LINE' NOT NULL,
	"date_placed_in_service" date,
	"gl_asset_account_id" integer NOT NULL,
	"gl_accum_depr_account_id" integer NOT NULL,
	"gl_expense_account_id" integer NOT NULL,
	"cip_conversion_id" integer,
	"parent_asset_id" integer,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cip_conversions" (
	"id" serial PRIMARY KEY NOT NULL,
	"structure_name" varchar(100) NOT NULL,
	"placed_in_service_date" date NOT NULL,
	"total_amount_converted" numeric(15, 2) NOT NULL,
	"gl_transaction_id" integer NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cip_conversion_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversion_id" integer NOT NULL,
	"source_cip_account_id" integer NOT NULL,
	"source_cost_code_id" integer,
	"target_fixed_asset_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ahp_loan_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"credit_limit" numeric(15, 2) NOT NULL,
	"current_drawn_amount" numeric(15, 2) DEFAULT '0' NOT NULL,
	"current_interest_rate" numeric(7, 5) NOT NULL,
	"rate_effective_date" date NOT NULL,
	"annual_payment_date" varchar(5) DEFAULT '12-31' NOT NULL,
	"last_payment_date" date,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prepaid_schedules" (
	"id" serial PRIMARY KEY NOT NULL,
	"description" varchar(255) NOT NULL,
	"total_amount" numeric(15, 2) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"gl_expense_account_id" integer NOT NULL,
	"gl_prepaid_account_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"monthly_amount" numeric(15, 2) NOT NULL,
	"amount_amortized" numeric(15, 2) DEFAULT '0' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source_transaction_id" integer,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grants" (
	"id" serial PRIMARY KEY NOT NULL,
	"funder_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"type" "grant_type" NOT NULL,
	"conditions" text,
	"start_date" date,
	"end_date" date,
	"fund_id" integer NOT NULL,
	"status" "grant_status" DEFAULT 'ACTIVE' NOT NULL,
	"is_unusual_grant" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pledges" (
	"id" serial PRIMARY KEY NOT NULL,
	"donor_id" integer NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"expected_date" date,
	"fund_id" integer NOT NULL,
	"status" "pledge_status" DEFAULT 'PLEDGED' NOT NULL,
	"gl_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_gl_asset_account_id_accounts_id_fk" FOREIGN KEY ("gl_asset_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_gl_accum_depr_account_id_accounts_id_fk" FOREIGN KEY ("gl_accum_depr_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fixed_assets" ADD CONSTRAINT "fixed_assets_gl_expense_account_id_accounts_id_fk" FOREIGN KEY ("gl_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cip_conversions" ADD CONSTRAINT "cip_conversions_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cip_conversion_lines" ADD CONSTRAINT "cip_conversion_lines_conversion_id_cip_conversions_id_fk" FOREIGN KEY ("conversion_id") REFERENCES "public"."cip_conversions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cip_conversion_lines" ADD CONSTRAINT "cip_conversion_lines_source_cip_account_id_accounts_id_fk" FOREIGN KEY ("source_cip_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cip_conversion_lines" ADD CONSTRAINT "cip_conversion_lines_source_cost_code_id_cip_cost_codes_id_fk" FOREIGN KEY ("source_cost_code_id") REFERENCES "public"."cip_cost_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cip_conversion_lines" ADD CONSTRAINT "cip_conversion_lines_target_fixed_asset_id_fixed_assets_id_fk" FOREIGN KEY ("target_fixed_asset_id") REFERENCES "public"."fixed_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_schedules" ADD CONSTRAINT "prepaid_schedules_gl_expense_account_id_accounts_id_fk" FOREIGN KEY ("gl_expense_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_schedules" ADD CONSTRAINT "prepaid_schedules_gl_prepaid_account_id_accounts_id_fk" FOREIGN KEY ("gl_prepaid_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_schedules" ADD CONSTRAINT "prepaid_schedules_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prepaid_schedules" ADD CONSTRAINT "prepaid_schedules_source_transaction_id_transactions_id_fk" FOREIGN KEY ("source_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_funder_id_vendors_id_fk" FOREIGN KEY ("funder_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grants" ADD CONSTRAINT "grants_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_donor_id_donors_id_fk" FOREIGN KEY ("donor_id") REFERENCES "public"."donors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pledges" ADD CONSTRAINT "pledges_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fixed_assets_gl_asset_account_id_idx" ON "fixed_assets" USING btree ("gl_asset_account_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_parent_asset_id_idx" ON "fixed_assets" USING btree ("parent_asset_id");--> statement-breakpoint
CREATE INDEX "fixed_assets_is_active_idx" ON "fixed_assets" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "cip_conversions_structure_name_idx" ON "cip_conversions" USING btree ("structure_name");--> statement-breakpoint
CREATE INDEX "cip_conversion_lines_conversion_id_idx" ON "cip_conversion_lines" USING btree ("conversion_id");--> statement-breakpoint
CREATE INDEX "grants_funder_id_idx" ON "grants" USING btree ("funder_id");--> statement-breakpoint
CREATE INDEX "grants_fund_id_idx" ON "grants" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "grants_status_idx" ON "grants" USING btree ("status");--> statement-breakpoint
CREATE INDEX "pledges_donor_id_idx" ON "pledges" USING btree ("donor_id");--> statement-breakpoint
CREATE INDEX "pledges_fund_id_idx" ON "pledges" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "pledges_status_idx" ON "pledges" USING btree ("status");