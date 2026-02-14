CREATE TYPE "public"."ramp_transaction_status" AS ENUM('uncategorized', 'categorized', 'posted');--> statement-breakpoint
CREATE TABLE "ramp_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"ramp_id" varchar(255) NOT NULL,
	"date" varchar(10) NOT NULL,
	"amount" numeric(15, 2) NOT NULL,
	"merchant_name" varchar(500) NOT NULL,
	"description" text,
	"cardholder" varchar(255) NOT NULL,
	"status" "ramp_transaction_status" DEFAULT 'uncategorized' NOT NULL,
	"gl_account_id" integer,
	"fund_id" integer,
	"gl_transaction_id" integer,
	"categorization_rule_id" integer,
	"synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorization_rules" (
	"id" serial PRIMARY KEY NOT NULL,
	"criteria" jsonb NOT NULL,
	"gl_account_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"auto_apply" boolean DEFAULT true NOT NULL,
	"hit_count" integer DEFAULT 0 NOT NULL,
	"created_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ramp_transactions" ADD CONSTRAINT "ramp_transactions_gl_account_id_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ramp_transactions" ADD CONSTRAINT "ramp_transactions_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ramp_transactions" ADD CONSTRAINT "ramp_transactions_gl_transaction_id_transactions_id_fk" FOREIGN KEY ("gl_transaction_id") REFERENCES "public"."transactions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ramp_transactions" ADD CONSTRAINT "ramp_transactions_categorization_rule_id_categorization_rules_id_fk" FOREIGN KEY ("categorization_rule_id") REFERENCES "public"."categorization_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_gl_account_id_accounts_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "public"."accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ramp_transactions_ramp_id_idx" ON "ramp_transactions" USING btree ("ramp_id");--> statement-breakpoint
CREATE INDEX "ramp_transactions_status_idx" ON "ramp_transactions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ramp_transactions_date_idx" ON "ramp_transactions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "ramp_transactions_gl_transaction_id_idx" ON "ramp_transactions" USING btree ("gl_transaction_id");--> statement-breakpoint
CREATE INDEX "categorization_rules_auto_apply_idx" ON "categorization_rules" USING btree ("auto_apply");