CREATE TYPE "public"."invoice_payment_status" AS ENUM('PENDING', 'POSTED', 'PAYMENT_IN_PROCESS', 'MATCHED_TO_PAYMENT', 'PAID');--> statement-breakpoint
CREATE TYPE "public"."payroll_run_status" AS ENUM('DRAFT', 'CALCULATED', 'POSTED');--> statement-breakpoint
CREATE TYPE "public"."po_status" AS ENUM('DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED');--> statement-breakpoint
CREATE TABLE "annual_rate_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer NOT NULL,
	"config_key" varchar(100) NOT NULL,
	"value" numeric(15, 6) NOT NULL,
	"effective_date" date,
	"notes" text,
	"updated_by" varchar(255) NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "annual_rate_config_year_key_date_uniq" UNIQUE("fiscal_year","config_key","effective_date")
);
--> statement-breakpoint
CREATE TABLE "staging_records" (
	"id" serial PRIMARY KEY NOT NULL,
	"source_app" varchar(50) NOT NULL,
	"source_record_id" varchar(255) NOT NULL,
	"record_type" varchar(50) NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"reference_id" varchar(255) NOT NULL,
	"date_incurred" date NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"fund_id" integer NOT NULL,
	"gl_account_id" integer,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"gl_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	CONSTRAINT "staging_records_source_uniq" UNIQUE("source_app","source_record_id")
);
--> statement-breakpoint
CREATE TABLE "payroll_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"payroll_run_id" integer NOT NULL,
	"employee_id" varchar(255) NOT NULL,
	"employee_name" varchar(255) NOT NULL,
	"gross_pay" numeric(12, 2) NOT NULL,
	"federal_withholding" numeric(12, 2) NOT NULL,
	"state_withholding" numeric(12, 2) NOT NULL,
	"social_security_employee" numeric(12, 2) NOT NULL,
	"medicare_employee" numeric(12, 2) NOT NULL,
	"social_security_employer" numeric(12, 2) NOT NULL,
	"medicare_employer" numeric(12, 2) NOT NULL,
	"net_pay" numeric(12, 2) NOT NULL,
	"fund_allocations" jsonb NOT NULL,
	"gl_transaction_id" integer,
	"gl_employer_transaction_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payroll_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"pay_period_start" date NOT NULL,
	"pay_period_end" date NOT NULL,
	"status" "payroll_run_status" DEFAULT 'DRAFT' NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"posted_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"vendor_id" integer NOT NULL,
	"description" text NOT NULL,
	"contract_pdf_url" text,
	"total_amount" numeric(15, 2) NOT NULL,
	"gl_destination_account_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"cip_cost_code_id" integer,
	"status" "po_status" DEFAULT 'DRAFT' NOT NULL,
	"extracted_milestones" jsonb,
	"extracted_terms" jsonb,
	"extracted_covenants" jsonb,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" serial PRIMARY KEY NOT NULL,
	"purchase_order_id" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"invoice_number" varchar(100),
	"amount" numeric(15, 2) NOT NULL,
	"invoice_date" date NOT NULL,
	"due_date" date,
	"gl_transaction_id" integer,
	"payment_status" "invoice_payment_status" DEFAULT 'PENDING' NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "staging_records" ADD CONSTRAINT "staging_records_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_records" ADD CONSTRAINT "staging_records_gl_account_id_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "staging_records" ADD CONSTRAINT "staging_records_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_payroll_run_id_payroll_runs_id_fk" FOREIGN KEY ("payroll_run_id") REFERENCES "public"."payroll_runs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payroll_entries" ADD CONSTRAINT "payroll_entries_gl_employer_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_employer_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_gl_destination_account_id_accounts_id_fk" FOREIGN KEY ("gl_destination_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_cip_cost_code_id_cip_cost_codes_id_fk" FOREIGN KEY ("cip_cost_code_id") REFERENCES "public"."cip_cost_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "staging_records_employee_idx" ON "staging_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "staging_records_status_idx" ON "staging_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "staging_records_date_idx" ON "staging_records" USING btree ("date_incurred");--> statement-breakpoint
CREATE INDEX "payroll_entries_run_idx" ON "payroll_entries" USING btree ("payroll_run_id");--> statement-breakpoint
CREATE INDEX "payroll_runs_period_idx" ON "payroll_runs" USING btree ("pay_period_start","pay_period_end");--> statement-breakpoint
CREATE INDEX "purchase_orders_vendor_id_idx" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_status_idx" ON "purchase_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "purchase_orders_fund_id_idx" ON "purchase_orders" USING btree ("fund_id");--> statement-breakpoint
CREATE INDEX "invoices_purchase_order_id_idx" ON "invoices" USING btree ("purchase_order_id");--> statement-breakpoint
CREATE INDEX "invoices_vendor_id_idx" ON "invoices" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "invoices_payment_status_idx" ON "invoices" USING btree ("payment_status");