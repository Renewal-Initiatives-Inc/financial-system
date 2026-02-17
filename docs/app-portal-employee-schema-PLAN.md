# App-Portal Employee Schema — Plan

**Status:** Phases 1-3 complete, Phase 4 deferred
**Last Updated:** 2026-02-16
**Author:** Jeff + Claude
**Traces to:** INT-P0-010, INT-P0-012, D-119, D-120, D-124, D-132; Phase 22 Step 11a

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/app-portal-employee-schema-PLAN.md Continue.`

---

## 1. Problem Statement

Financial-system's payroll engine reads employee data from app-portal's Neon DB, but app-portal has no `employees` table yet. A pending migration (`0002`) exists with a partial `employee_payroll` schema that's missing compensation, withholding, and 990 fields. This blocks Phase 22 Step 11a (cross-Neon connectivity).

---

## 2. Discovery

### Current State of app-portal DB

| Item | Status |
|------|--------|
| Neon project | `app-portal-db` (cool-recipe-59161582) |
| Endpoint | `ep-restless-morning-ah4iviov` (us-east-1) |
| Applied migrations | 0000 (apps, audit_logs, notifications), 0001 (slug column) |
| Pending migration | 0002 — `employee_payroll` + `payroll_audit_log` (NOT applied) |
| `financial_system_reader` role | Created, GRANT on `employees` ran but table doesn't exist |
| Drizzle schema | `src/lib/db/schema.ts` — only `apps`, `auditLogs`, `notifications` |

### Pending Migration 0002 vs What Financial-System Needs

| Pending `employee_payroll` | financial-system `people.ts` needs | Gap |
|---|---|---|
| `id` (uuid) | `id` | ✅ match |
| `zitadel_user_id` (text, unique) | — | Extra (useful for Zitadel linkage) |
| `legal_name` (varchar 255) | `name` | ✅ rename or alias |
| — | `email` | ❌ missing |
| — | `is_active` (boolean) | ❌ missing (payroll_enabled is close but different semantic) |
| — | `compensation_type` (enum) | ❌ missing |
| — | `annual_salary` (decimal) | ❌ missing |
| — | `expected_annual_hours` (int) | ❌ missing |
| — | `exempt_status` (enum) | ❌ missing |
| `federal_tax_id` (encrypted) | `tax_id` | ✅ rename |
| `withholding_elections` (jsonb) | 7 explicit columns* | ❌ needs expansion |
| — | 990 fields (6 columns)** | ❌ missing |

\* `federal_filing_status`, `federal_allowances`, `state_allowances`, `additional_federal_withholding`, `additional_state_withholding`, `is_head_of_household`, `is_blind`, `spouse_is_blind`

\** `is_officer`, `officer_title`, `board_member`, `avg_hours_per_week`, `employer_health_premium`, `employer_retirement_contrib`

### Key Decision: Table Name

Financial-system's `people.ts` queries `FROM employees`. The pending migration uses `employee_payroll`. Options:

1. **Rename to `employees`** in app-portal — cleanest, since migration isn't applied
2. **Update financial-system query** to use `employee_payroll` — breaks naming convention
3. **Create a view** `employees` over `employee_payroll` — extra indirection

**Decision: Rename to `employees`** — migration isn't applied, no downstream dependencies.

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Rename `employee_payroll` → `employees` | Matches financial-system's query; pending migration not applied |
| D2 | Expand withholding from JSONB to explicit columns | Financial-system needs typed columns for tax calculations, not JSONB parsing |
| D3 | Add `email` column (denormalized from Zitadel) | Payroll needs it for W-2/display; avoids cross-system call at query time |
| D4 | Keep `payroll_audit_log` table | Good practice; already designed |
| D5 | Replace pending 0002 migration entirely | Cleaner than layering a 0003 on top of an unapplied 0002 |
| D6 | Use `is_active` (not `payroll_enabled`) | Consistent with financial-system's query |

---

## 4. Requirements

### P0: Must Have (for payroll engine to work)

| Req | Column | Type | Notes |
|-----|--------|------|-------|
| P0-1 | `id` | uuid PK | Auto-generated |
| P0-2 | `zitadel_user_id` | text, unique | Links to Zitadel identity |
| P0-3 | `name` | varchar(255) | Legal name for W-2 |
| P0-4 | `email` | varchar(255) | Display + notifications |
| P0-5 | `is_active` | boolean, default true | Filter for active employees |
| P0-6 | `compensation_type` | text (PER_TASK / SALARIED) | Gross pay calculation method |
| P0-7 | `annual_salary` | numeric(12,2), nullable | For SALARIED employees |
| P0-8 | `expected_annual_hours` | integer, nullable | Hourly rate = salary ÷ hours |
| P0-9 | `exempt_status` | text (EXEMPT / NON_EXEMPT) | Overtime eligibility |
| P0-10 | `federal_filing_status` | text | Pub 15-T withholding |
| P0-11 | `federal_allowances` | integer, default 0 | W-4 allowances |
| P0-12 | `state_allowances` | integer, default 0 | M-4 allowances |
| P0-13 | `additional_federal_withholding` | numeric(10,2), default 0 | Extra federal w/h |
| P0-14 | `additional_state_withholding` | numeric(10,2), default 0 | Extra state w/h |
| P0-15 | `is_head_of_household` | boolean, default false | Tax calc |
| P0-16 | `is_blind` | boolean, default false | Tax calc |
| P0-17 | `spouse_is_blind` | boolean, default false | Tax calc |

### P1: Nice to Have (for 990 reporting + W-2)

| Req | Column | Type | Notes |
|-----|--------|------|-------|
| P1-1 | `tax_id` | text (encrypted AES-256-GCM) | SSN for W-2 |
| P1-2 | `address` | text | W-2 mailing address |
| P1-3 | `is_officer` | boolean, default false | 990 Part VII |
| P1-4 | `officer_title` | text, nullable | 990 Part VII |
| P1-5 | `board_member` | boolean, default false | 990 Part VII |
| P1-6 | `avg_hours_per_week` | numeric(5,1), nullable | 990 Part VII |
| P1-7 | `employer_health_premium` | numeric(10,2), nullable | 990 Part VII Col F |
| P1-8 | `employer_retirement_contrib` | numeric(10,2), nullable | 990 Part VII Col F |

### P2: Retained from original design

| Req | Column | Type | Notes |
|-----|--------|------|-------|
| P2-1 | `worker_type` | text (W-2 / 1099) | Retained from 0002 |
| P2-2 | `pay_frequency` | text | Retained from 0002 |
| P2-3 | `state_tax_id` | text, nullable | State EIN if applicable |

---

## 5. Data Model

### `employees` table (replaces `employee_payroll`)

```sql
CREATE TABLE "employees" (
  "id"                             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "zitadel_user_id"                text NOT NULL UNIQUE,
  "name"                           varchar(255) NOT NULL,
  "email"                          varchar(255) NOT NULL,
  "is_active"                      boolean NOT NULL DEFAULT true,

  -- Compensation
  "compensation_type"              text NOT NULL DEFAULT 'PER_TASK',
  "annual_salary"                  numeric(12,2),
  "expected_annual_hours"          integer,
  "exempt_status"                  text NOT NULL DEFAULT 'NON_EXEMPT',
  "worker_type"                    text NOT NULL DEFAULT 'W-2',
  "pay_frequency"                  text NOT NULL DEFAULT 'biweekly',

  -- Tax withholding
  "federal_filing_status"          text NOT NULL DEFAULT 'single',
  "federal_allowances"             integer NOT NULL DEFAULT 0,
  "state_allowances"               integer NOT NULL DEFAULT 0,
  "additional_federal_withholding" numeric(10,2) NOT NULL DEFAULT 0,
  "additional_state_withholding"   numeric(10,2) NOT NULL DEFAULT 0,
  "is_head_of_household"           boolean NOT NULL DEFAULT false,
  "is_blind"                       boolean NOT NULL DEFAULT false,
  "spouse_is_blind"                boolean NOT NULL DEFAULT false,

  -- Encrypted PII
  "tax_id"                         text,
  "state_tax_id"                   text,
  "address"                        text,

  -- 990 Part VII
  "is_officer"                     boolean NOT NULL DEFAULT false,
  "officer_title"                  text,
  "board_member"                   boolean NOT NULL DEFAULT false,
  "avg_hours_per_week"             numeric(5,1),
  "employer_health_premium"        numeric(10,2),
  "employer_retirement_contrib"    numeric(10,2),

  -- Timestamps
  "created_at"                     timestamp NOT NULL DEFAULT now(),
  "updated_at"                     timestamp NOT NULL DEFAULT now()
);

CREATE INDEX "employees_is_active_idx" ON "employees" USING btree ("is_active");
```

### `payroll_audit_log` table (unchanged from 0002)

```sql
CREATE TABLE "payroll_audit_log" (
  "id"                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "employee_zitadel_user_id"  text NOT NULL,
  "field_name"                varchar(100) NOT NULL,
  "old_value"                 text,
  "new_value"                 text NOT NULL,
  "changed_by"                text NOT NULL,
  "changed_at"                timestamp NOT NULL DEFAULT now()
);
```

---

## 6. Implementation Plan

### Phase 1: Schema + Migration (in app-portal)

| Task | Status | Notes |
|------|--------|-------|
| Update `src/lib/db/schema.ts` — replace pending payroll schema with `employees` table | ✅ | 30 columns, all P0 + P1 + P2 |
| Delete pending migration `0002_gifted_lady_vermin.sql` | ✅ | Orphan file removed |
| Run `npx drizzle-kit generate` to create new 0002 | ✅ | Generated `0002_tricky_shiver_man.sql` |
| Apply migration to production: `npx drizzle-kit push` | ✅ | Used `push` (no `__drizzle_migrations` table existed) |

### Phase 2: Seed + Grants

| Task | Status | Notes |
|------|--------|-------|
| Seed Heather's employee record via SQL INSERT | ✅ | Mock comp data seeded (id: 31185b00-..., Jeff to update later) |
| Re-run GRANT for `financial_system_reader` on `employees` | ✅ | SELECT on employees + payroll_audit_log |
| Verify GRANT: cross-DB read from financial-system | ✅ | financial_system_reader reads Heather's record successfully |

### Phase 3: Financial-system alignment

| Task | Status | Notes |
|------|--------|-------|
| Verify `people.ts` query matches new column names | ✅ | All 15 SELECT columns + WHERE filter match exactly |
| Run cross-DB read with PEOPLE_DATABASE_URL | ✅ | Returns Heather Takle, SALARIED, $72000, EXEMPT |
| Redeploy financial-system: `npx vercel --prod` | ✅ | PEOPLE_DATABASE_URL updated, redeployed |
| Test payroll page loads real employee data | ✅ | Payroll page shows real employee data |

### Phase 4: App-portal UI (deferred)

| Task | Status | Notes |
|------|--------|-------|
| Admin form for compensation profile | 🔲 | Can be built later; initial data via SQL |
| Admin form for withholding elections (W-4/M-4) | 🔲 | |
| New hire onboarding flow updates | 🔲 | |

---

## 7. Verification

1. **Schema applied:** `SELECT count(*) FROM employees;` returns 0+ (no error)
2. **Seed data:** `SELECT name, compensation_type, annual_salary FROM employees WHERE is_active = true;` returns Heather's record
3. **Cross-DB read:** `scripts/verify-cross-db.ts` shows `✅ 11a: Read employees from app-portal: PASS`
4. **Payroll page:** Production `/payroll` shows real employee names, not mock data
5. **Column alignment:** No errors in Vercel function logs for payroll routes

---

## 8. Session Progress

### Session 1: 2026-02-16 (Discovery + Plan)

**Completed:**
- [x] Created plan document
- [x] Discovered app-portal has no employees table (only apps, audit_logs, notifications)
- [x] Found pending migration 0002 with partial `employee_payroll` schema
- [x] Mapped gap between pending schema and financial-system requirements
- [x] Decided to replace 0002 with comprehensive `employees` table
- [x] Created `financial_system_reader` role on app-portal Neon DB
- [x] Confirmed GRANTs run (but table doesn't exist yet)

**Next Steps:**
- [x] Execute Phase 1: Update app-portal schema + migration
- [x] Execute Phase 2: Seed Heather's record + re-run GRANTs
- [x] Execute Phase 3: Verify financial-system reads work

### Session 2: 2026-02-17 (Execution)

**Completed:**
- [x] Updated app-portal `schema.ts` with full `employees` table (30 columns) + `payrollAuditLog`
- [x] Deleted orphan `0002_gifted_lady_vermin.sql` (not in drizzle journal)
- [x] Generated new `0002_tricky_shiver_man.sql` via `drizzle-kit generate`
- [x] Applied schema via `drizzle-kit push` (no `__drizzle_migrations` table existed)
- [x] Verified 30 columns, 3 indexes (`pkey`, `zitadel_user_id_unique`, `is_active_idx`)
- [x] Seeded Heather Takle record (Zitadel ID `358211364004607724`, mock comp data)
- [x] GRANT SELECT on `employees` + `payroll_audit_log` to `financial_system_reader`
- [x] Verified all 15 `people.ts` query columns align with `employees` table
- [x] Reset `financial_system_reader` password and constructed new PEOPLE_DATABASE_URL
- [x] Verified cross-DB read: financial-system successfully reads Heather from app-portal

**Remaining:**
- [x] Jeff: Update PEOPLE_DATABASE_URL in Vercel env vars with new connection string
- [x] Redeploy financial-system to Vercel production
- [x] Verify /payroll page shows real employee data (not mock)
- [ ] Jeff: Update Heather's compensation data to real values (via SQL or future admin UI)
