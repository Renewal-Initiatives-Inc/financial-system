CREATE TYPE "public"."bank_match_type" AS ENUM('auto', 'manual', 'rule');--> statement-breakpoint
CREATE TYPE "public"."bank_transaction_status" AS ENUM('pending', 'posted');--> statement-breakpoint
CREATE TYPE "public"."compliance_deadline_category" AS ENUM('tax', 'tenant', 'grant', 'budget');--> statement-breakpoint
CREATE TYPE "public"."compliance_deadline_recurrence" AS ENUM('annual', 'monthly', 'per_tenant', 'one_time');--> statement-breakpoint
CREATE TYPE "public"."compliance_deadline_status" AS ENUM('upcoming', 'reminded', 'completed');--> statement-breakpoint
CREATE TYPE "public"."reconciliation_status" AS ENUM('in_progress', 'completed');--> statement-breakpoint
CREATE TABLE "security_deposit_interest_payments" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"deposit_amount" numeric(12, 2) NOT NULL,
	"interest_rate" numeric(5, 4) NOT NULL,
	"interest_amount" numeric(12, 2) NOT NULL,
	"gl_transaction_id" integer,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "compliance_deadlines" (
	"id" serial PRIMARY KEY NOT NULL,
	"task_name" varchar(255) NOT NULL,
	"due_date" date NOT NULL,
	"category" "compliance_deadline_category" NOT NULL,
	"recurrence" "compliance_deadline_recurrence" NOT NULL,
	"status" "compliance_deadline_status" DEFAULT 'upcoming' NOT NULL,
	"reminder_30d_sent" boolean DEFAULT false NOT NULL,
	"reminder_7d_sent" boolean DEFAULT false NOT NULL,
	"tenant_id" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "security_deposit_receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"receipt_type" varchar(50) NOT NULL,
	"due_date" date NOT NULL,
	"completed_date" date,
	"created_at" timestamp DEFAULT now() NOT NULL
);
