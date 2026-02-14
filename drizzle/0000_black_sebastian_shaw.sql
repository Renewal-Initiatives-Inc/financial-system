CREATE TYPE "public"."account_type" AS ENUM('ASSET', 'LIABILITY', 'NET_ASSET', 'REVENUE', 'EXPENSE');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('created', 'updated', 'voided', 'reversed', 'deactivated', 'signed_off', 'imported', 'posted');--> statement-breakpoint
CREATE TYPE "public"."budget_status" AS ENUM('DRAFT', 'APPROVED');--> statement-breakpoint
CREATE TYPE "public"."cip_cost_category" AS ENUM('HARD_COST', 'SOFT_COST');--> statement-breakpoint
CREATE TYPE "public"."fund_restriction" AS ENUM('RESTRICTED', 'UNRESTRICTED');--> statement-breakpoint
CREATE TYPE "public"."normal_balance" AS ENUM('DEBIT', 'CREDIT');--> statement-breakpoint
CREATE TYPE "public"."projection_line_type" AS ENUM('INFLOW', 'OUTFLOW');--> statement-breakpoint
CREATE TYPE "public"."source_type" AS ENUM('MANUAL', 'TIMESHEET', 'EXPENSE_REPORT', 'RAMP', 'BANK_FEED', 'SYSTEM', 'FY25_IMPORT');--> statement-breakpoint
CREATE TYPE "public"."spread_method" AS ENUM('EVEN', 'SEASONAL', 'ONE_TIME', 'CUSTOM');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "account_type" NOT NULL,
	"sub_type" varchar(50),
	"normal_balance" "normal_balance" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"form_990_line" varchar(10),
	"parent_account_id" integer,
	"is_system_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"restriction_type" "fund_restriction" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"description" text,
	"is_system_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "funds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"date" date NOT NULL,
	"memo" text NOT NULL,
	"source_type" "source_type" NOT NULL,
	"source_reference_id" varchar(255),
	"is_system_generated" boolean DEFAULT false NOT NULL,
	"is_voided" boolean DEFAULT false NOT NULL,
	"reversal_of_id" integer,
	"reversed_by_id" integer,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"cip_cost_code_id" integer,
	"debit" numeric(15, 2),
	"credit" numeric(15, 2),
	"memo" text,
	CONSTRAINT "debit_credit_check" CHECK (("transaction_lines"."debit" IS NOT NULL AND "transaction_lines"."debit" > 0 AND "transaction_lines"."credit" IS NULL) OR ("transaction_lines"."credit" IS NOT NULL AND "transaction_lines"."credit" > 0 AND "transaction_lines"."debit" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "cip_cost_codes" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(255) NOT NULL,
	"category" "cip_cost_category" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cip_cost_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"action" "audit_action" NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" integer NOT NULL,
	"before_state" jsonb,
	"after_state" jsonb NOT NULL,
	"metadata" jsonb
);
--> statement-breakpoint
CREATE TABLE "budgets" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer NOT NULL,
	"status" "budget_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"budget_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"annual_amount" numeric(15, 2) NOT NULL,
	"spread_method" "spread_method" DEFAULT 'EVEN' NOT NULL,
	"monthly_amounts" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_projections" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer NOT NULL,
	"as_of_date" date NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cash_projection_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"projection_id" integer NOT NULL,
	"month" integer NOT NULL,
	"source_label" varchar(255) NOT NULL,
	"auto_amount" numeric(15, 2) NOT NULL,
	"override_amount" numeric(15, 2),
	"override_note" text,
	"line_type" "projection_line_type" NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_transaction_id_transactions_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transaction_lines" ADD CONSTRAINT "transaction_lines_cip_cost_code_id_cip_cost_codes_id_fk" FOREIGN KEY ("cip_cost_code_id") REFERENCES "public"."cip_cost_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_budget_id_budgets_id_fk" FOREIGN KEY ("budget_id") REFERENCES "public"."budgets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_lines" ADD CONSTRAINT "budget_lines_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cash_projection_lines" ADD CONSTRAINT "cash_projection_lines_projection_id_cash_projections_id_fk" FOREIGN KEY ("projection_id") REFERENCES "public"."cash_projections"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_parent_account_id_idx" ON "accounts" USING btree ("parent_account_id");--> statement-breakpoint
CREATE INDEX "transactions_date_idx" ON "transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "transactions_source_type_idx" ON "transactions" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "transaction_lines_transaction_id_idx" ON "transaction_lines" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "transaction_lines_account_id_idx" ON "transaction_lines" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "transaction_lines_fund_id_idx" ON "transaction_lines" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_log_timestamp_idx" ON "audit_log" USING btree ("timestamp");--> statement-breakpoint
CREATE UNIQUE INDEX "budgets_fiscal_year_idx" ON "budgets" USING btree ("fiscal_year");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_lines_budget_account_fund_idx" ON "budget_lines" USING btree ("budget_id","account_id","fund_id");--> statement-breakpoint
CREATE INDEX "budget_lines_budget_id_idx" ON "budget_lines" USING btree ("budget_id");--> statement-breakpoint
CREATE INDEX "cash_projection_lines_projection_id_idx" ON "cash_projection_lines" USING btree ("projection_id");