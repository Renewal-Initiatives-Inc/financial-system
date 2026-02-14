CREATE TABLE "bank_accounts" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"institution" varchar(255) NOT NULL,
	"last_4" varchar(4) NOT NULL,
	"plaid_access_token" text NOT NULL,
	"plaid_item_id" varchar(255) NOT NULL,
	"plaid_cursor" text,
	"gl_account_id" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_account_id" integer NOT NULL,
	"plaid_transaction_id" varchar(255) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"date" date NOT NULL,
	"merchant_name" varchar(500),
	"category" varchar(255),
	"is_pending" boolean DEFAULT false NOT NULL,
	"payment_channel" varchar(50),
	"raw_data" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_matches" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_transaction_id" integer NOT NULL,
	"gl_transaction_line_id" integer NOT NULL,
	"match_type" "bank_match_type" NOT NULL,
	"confidence_score" numeric(5, 2),
	"confirmed_by" varchar(255),
	"confirmed_at" timestamp,
	"rule_id" integer,
	"reconciliation_session_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matching_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"criteria" jsonb NOT NULL,
	"action" jsonb NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reconciliation_sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"bank_account_id" integer NOT NULL,
	"statement_date" date NOT NULL,
	"statement_balance" numeric(15, 2) NOT NULL,
	"status" "reconciliation_status" DEFAULT 'in_progress' NOT NULL,
	"signed_off_by" varchar(255),
	"signed_off_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "functional_allocations" (
	"id" serial PRIMARY KEY NOT NULL,
	"fiscal_year" integer NOT NULL,
	"account_id" integer NOT NULL,
	"program_pct" numeric(5, 2) NOT NULL,
	"admin_pct" numeric(5, 2) NOT NULL,
	"fundraising_pct" numeric(5, 2) NOT NULL,
	"is_permanent_rule" boolean DEFAULT false NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_sum_check" CHECK ("functional_allocations"."program_pct" + "functional_allocations"."admin_pct" + "functional_allocations"."fundraising_pct" = 100)
);
--> statement-breakpoint
ALTER TABLE "bank_accounts" ADD CONSTRAINT "bank_accounts_gl_account_id_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_bank_transaction_id_bank_transactions_id_fk" FOREIGN KEY ("bank_transaction_id") REFERENCES "public"."bank_transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_gl_transaction_line_id_transaction_lines_id_fk" FOREIGN KEY ("gl_transaction_line_id") REFERENCES "public"."transaction_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_rule_id_matching_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."matching_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_matches" ADD CONSTRAINT "bank_matches_reconciliation_session_id_reconciliation_sessions_id_fk" FOREIGN KEY ("reconciliation_session_id") REFERENCES "public"."reconciliation_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reconciliation_sessions" ADD CONSTRAINT "reconciliation_sessions_bank_account_id_bank_accounts_id_fk" FOREIGN KEY ("bank_account_id") REFERENCES "public"."bank_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "functional_allocations" ADD CONSTRAINT "functional_allocations_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "bank_transactions_plaid_id_idx" ON "bank_transactions" USING btree ("plaid_transaction_id");--> statement-breakpoint
CREATE INDEX "bank_transactions_account_date_idx" ON "bank_transactions" USING btree ("bank_account_id","date");--> statement-breakpoint
CREATE INDEX "bank_matches_bank_transaction_id_idx" ON "bank_matches" USING btree ("bank_transaction_id");--> statement-breakpoint
CREATE INDEX "bank_matches_gl_line_id_idx" ON "bank_matches" USING btree ("gl_transaction_line_id");--> statement-breakpoint
CREATE INDEX "bank_matches_session_id_idx" ON "bank_matches" USING btree ("reconciliation_session_id");--> statement-breakpoint
CREATE INDEX "functional_allocations_account_id_idx" ON "functional_allocations" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "functional_allocations_fiscal_year_idx" ON "functional_allocations" USING btree ("fiscal_year");