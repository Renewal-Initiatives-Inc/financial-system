# Financial System — Architecture & Design

**For:** Renewal Initiatives, Inc.
**Stack:** Next.js on Vercel + Neon Postgres (D-131)
**Scale:** 2-5 users, <1000 transactions/month, single property, single organization
**Companion doc:** requirements.md (all requirement IDs referenced here are defined there)

---

## 1. Design Principles

1. **Fund accounting is the core abstraction.** Every transaction line has a fund. Every report supports fund drill-down. The fund dimension is as fundamental as the account dimension.

2. **Immutable ledger, mutable metadata.** Posted GL entries are append-only (corrections via reversal). Supporting data (vendors, donors, tenants, budgets, rules) is freely editable with audit trail.

3. **Database as integration layer.** Internal apps communicate via shared Postgres — staging tables for writes, reference table reads for lookups. No REST APIs between internal apps. External services (Plaid, Ramp) use their vendor APIs.

4. **One copilot, many contexts.** A single AI copilot component adapts to each page via context packages. No bespoke AI features per domain.

5. **Warn, don't block.** The system guides users (fund coding warnings, threshold prompts, compliance alerts) but never prevents trusted users from proceeding. Exception: double-entry balance (INV-001) is always enforced.

6. **Consistent look and feel across RI apps.** Financial-system adopts renewal-timesheets' existing CSS, borders, styling, header, nav, colors, and fonts. renewal-timesheets has already undergone Section 508 accessibility review and provides a proven, easy-to-navigate UI baseline. All RI apps (financial-system, renewal-timesheets, expense-reports-homegrown, app-portal) should converge on this shared visual language.

---

## 2. Data Model

### 2.1 Core Schema

```
┌─────────────┐     ┌──────────────────┐     ┌───────────┐
│   accounts   │     │   transactions   │     │   funds   │
├─────────────┤     ├──────────────────┤     ├───────────┤
│ id           │     │ id               │     │ id        │
│ code         │     │ date             │     │ name      │
│ name         │     │ memo             │     │ restriction_type │
│ type         │◄────│ source_type      │────►│ active    │
│ sub_type     │     │ source_ref_id    │     │ created_at│
│ normal_bal   │     │ is_system_gen    │     │ description│
│ active       │     │ is_voided        │     └───────────┘
│ form_990_line│     │ reversal_of_id   │
│ parent_id    │     │ reversed_by_id   │
│ system_locked│     │ created_by       │
└─────────────┘     │ created_at       │
                    └──────────────────┘
                           │ 1:many
                    ┌──────────────────┐
                    │ transaction_lines │
                    ├──────────────────┤
                    │ id               │
                    │ transaction_id   │
                    │ account_id  ────►│ accounts
                    │ fund_id     ────►│ funds
                    │ debit            │
                    │ credit           │
                    │ memo             │
                    └──────────────────┘
```

**Key design decisions:**

- **Fund lives on the line, not the transaction header.** D-051 (multi-fund splits) requires each line to have its own fund. A single journal entry can debit CIP from the AHP Fund and credit Cash from the General Fund.
- **Debit/credit as separate columns** (not a single signed amount). Eliminates sign confusion. Constraint: exactly one of debit/credit is non-null per line.
- **Reversal chain**: `reversal_of_id` points from the reversing entry to the original. `reversed_by_id` points from the original to its reversal. Both nullable. This enables efficient queries: "show me the reversing entry for transaction X" and "has transaction X been reversed?"
- **source_type enum**: MANUAL, TIMESHEET, EXPENSE_REPORT, RAMP, BANK_FEED, SYSTEM, FY25_IMPORT. Immutable provenance.

### 2.2 Supporting Entities

```
tenants                     vendors                     donors
├─ id                       ├─ id                       ├─ id
├─ name                     ├─ name                     ├─ name
├─ unit_number              ├─ address                  ├─ address
├─ lease_start              ├─ tax_id (encrypted)       ├─ email
├─ lease_end                ├─ entity_type              ├─ type
├─ monthly_rent             ├─ is_1099_eligible         ├─ first_gift_date
├─ funding_source_type      ├─ default_account_id       └─ created_at
├─ move_in_date             ├─ default_fund_id
├─ security_deposit_amount  ├─ w9_status
├─ escrow_bank_ref          ├─ w9_collected_date
├─ deposit_date             └─ created_at
├─ interest_rate
├─ statement_of_condition_date
└─ tenancy_anniversary

fixed_assets                purchase_orders             grants
├─ id                       ├─ id                       ├─ id
├─ name                     ├─ vendor_id                ├─ funder_id (vendor)
├─ description              ├─ description              ├─ amount
├─ acquisition_date         ├─ contract_pdf_url         ├─ type (conditional/unconditional)
├─ cost                     ├─ total_amount             ├─ conditions
├─ salvage_value            ├─ gl_destination_account   ├─ start_date
├─ useful_life_months       ├─ fund_id                  ├─ end_date
├─ depreciation_method      ├─ status                   ├─ fund_id
├─ date_placed_in_service   ├─ extracted_milestones     ├─ status
├─ gl_asset_account_id      ├─ extracted_terms          └─ created_at
├─ gl_accum_depr_account_id ├─ extracted_covenants
├─ gl_expense_account_id    └─ created_at               pledges
├─ parent_asset_id                                      ├─ id
├─ active                   invoices                    ├─ donor_id
└─ created_at               ├─ id                       ├─ amount
                            ├─ purchase_order_id        ├─ expected_date
                            ├─ vendor_id                ├─ fund_id
                            ├─ amount                   ├─ status
                            ├─ invoice_date             └─ created_at
                            ├─ gl_entry_id
                            ├─ payment_status
                            └─ created_at
```

### 2.3 Bank Reconciliation Schema

```
bank_accounts               bank_transactions           matches
├─ id                       ├─ id                       ├─ id
├─ name                     ├─ bank_account_id          ├─ bank_transaction_id
├─ institution              ├─ plaid_transaction_id     ├─ gl_transaction_line_id
├─ last4                    ├─ amount                   ├─ match_type (auto/manual/rule)
├─ plaid_access_token       ├─ date                     ├─ confidence_score
├─ plaid_item_id            ├─ merchant_name            ├─ confirmed_by
├─ plaid_cursor             ├─ category                 ├─ confirmed_at
├─ active                   ├─ is_pending               ├─ rule_id (nullable)
└─ created_at               ├─ payment_channel          └─ created_at
                            └─ created_at
                                                        matching_rules
reconciliation_sessions                                 ├─ id
├─ id                                                   ├─ criteria (JSON)
├─ bank_account_id                                      ├─ action (JSON)
├─ statement_date                                       ├─ created_by
├─ statement_balance                                    ├─ hit_count
├─ status (in_progress/completed)                       └─ created_at
├─ signed_off_by
├─ signed_off_at
├─ notes
└─ created_at
```

**Split transactions** are handled by allowing multiple `matches` rows per `bank_transaction_id`. When a user splits a bank transaction, each split creates a match to a different GL line. Validation: sum of matched GL amounts = bank transaction amount.

### 2.4 Budgeting Schema

```
budgets                     budget_lines                cash_projections
├─ id                       ├─ id                       ├─ id
├─ fiscal_year              ├─ budget_id                ├─ fiscal_year
├─ status (draft/approved)  ├─ account_id               ├─ as_of_date
├─ created_by               ├─ fund_id                  ├─ created_by
└─ created_at               ├─ annual_amount            └─ created_at
                            ├─ spread_method
                            ├─ monthly_amounts[12]      cash_projection_lines
                            └─ created_at               ├─ id
                                                        ├─ projection_id
                                                        ├─ month
                                                        ├─ source_label
                                                        ├─ auto_amount
                                                        ├─ override_amount (nullable)
                                                        ├─ override_note
                                                        ├─ line_type (inflow/outflow)
                                                        └─ sort_order
```

`monthly_amounts` is a 12-element array (Jan-Dec). The `spread_method` (even/seasonal/one_time/custom) determines how `annual_amount` distributes across months. For "custom," the user sets `monthly_amounts` directly.

### 2.5 Integration Schema (Staging)

```
staging_records
├─ id
├─ source_app (timesheets/expense_reports)
├─ source_record_id
├─ record_type (timesheet_fund_summary/expense_line_item)
├─ employee_id
├─ reference_id (timesheet or expense report ID)
├─ date_incurred
├─ amount
├─ fund_id        ──► funds (FK)
├─ gl_account_id  ──► accounts (FK, nullable for timesheets)
├─ metadata (JSONB — hours, overtime, merchant, memo, etc.)
├─ status (received/posted/matched_to_payment/paid)
├─ gl_transaction_id (nullable, set when posted)
├─ created_at
├─ processed_at
└─ UNIQUE(source_app, source_record_id)
```

**One staging table** for both timesheets and expense reports. The `record_type` and `metadata` JSONB column handle structural differences:
- Timesheets: metadata contains `{regular_hours, overtime_hours, regular_earnings, overtime_earnings}`
- Expense reports: metadata contains `{merchant, memo, expense_type, mileage_details}`

FK constraints on `fund_id` and `gl_account_id` catch invalid references at INSERT time (INT-P0-005).

### 2.6 Compliance Schema

```
compliance_deadlines                functional_allocations
├─ id                               ├─ id
├─ task_name                        ├─ fiscal_year
├─ due_date                         ├─ account_id
├─ category (tax/tenant/grant/      ├─ program_pct
│   budget)                         ├─ admin_pct
├─ recurrence (annual/monthly/      ├─ fundraising_pct
│   per_tenant/one_time)            ├─ is_permanent_rule
├─ status (upcoming/reminded/       ├─ created_by
│   completed)                      └─ created_at
├─ reminder_30d_sent
├─ reminder_7d_sent
├─ tenant_id (nullable)
├─ notes
└─ created_at
```

### 2.7 Audit Log Schema

```
audit_log
├─ id
├─ timestamp
├─ user_id
├─ action (created/updated/voided/reversed/deactivated/signed_off/...)
├─ entity_type (transaction/account/fund/vendor/tenant/budget/reconciliation/...)
├─ entity_id
├─ before_state (JSONB, nullable)
├─ after_state (JSONB)
└─ metadata (JSONB — additional context)
```

Append-only. No UPDATE or DELETE operations on this table. Enforced at the database role level (the application's DB role has INSERT-only on `audit_log`).

### 2.8 Ramp Transaction Schema

```
ramp_transactions
├─ id
├─ ramp_id (external ID)
├─ date
├─ amount
├─ merchant_name
├─ description
├─ cardholder
├─ status (uncategorized/categorized/posted)
├─ gl_account_id (nullable, set on categorization)
├─ fund_id (nullable, set on categorization)
├─ gl_transaction_id (nullable, set on posting)
├─ categorization_rule_id (nullable)
├─ synced_at
└─ created_at

categorization_rules
├─ id
├─ criteria (JSONB — merchant patterns, description keywords)
├─ gl_account_id
├─ fund_id
├─ auto_apply (boolean)
├─ hit_count
├─ created_by
└─ created_at
```

---

## 3. Component Architecture

### 3.1 Application Structure

```
financial-system/
├─ src/
│  ├─ app/                    # Next.js App Router pages
│  │  ├─ (dashboard)/         # Dashboard home (Report container)
│  │  ├─ transactions/        # GL entry, transaction list, corrections
│  │  ├─ accounts/            # Chart of accounts management
│  │  ├─ funds/               # Fund management
│  │  ├─ revenue/             # Revenue recording (rent, grants, donations)
│  │  ├─ expenses/            # Expense processing (reimbursements, PO, Ramp)
│  │  ├─ payroll/             # Payroll runs, withholding config
│  │  ├─ bank-rec/            # Bank reconciliation workspace
│  │  ├─ reports/             # All 29 reports + export
│  │  ├─ budgets/             # Budget creation, variance, cash projection
│  │  ├─ compliance/          # Compliance calendar, functional allocation
│  │  ├─ vendors/             # Vendor management, PO, 1099
│  │  ├─ tenants/             # Tenant management, security deposits
│  │  ├─ donors/              # Donor management, acknowledgments
│  │  ├─ assets/              # Fixed asset management, depreciation
│  │  ├─ settings/            # System config, GAAP policies, loan metadata
│  │  └─ api/                 # API routes
│  │     ├─ cron/             # Scheduled jobs (Plaid, Ramp, depreciation, etc.)
│  │     ├─ copilot/          # AI copilot proxy to Anthropic
│  │     └─ webhooks/         # Plaid webhooks (optional)
│  ├─ lib/
│  │  ├─ db/                  # Database client, schema, migrations
│  │  ├─ gl/                  # GL engine (entry creation, validation, reversal)
│  │  ├─ fund-accounting/     # Fund logic, net asset releases, multi-fund splits
│  │  ├─ payroll/             # Withholding calculations, payroll run logic
│  │  ├─ bank-rec/            # Matching engine, split logic, sign-off
│  │  ├─ integrations/        # Plaid client, Ramp client, Postmark client
│  │  ├─ staging/             # Staging table processor
│  │  ├─ reports/             # Report data queries and formatters
│  │  ├─ budget/              # Budget spread logic, variance calc, projection
│  │  ├─ compliance/          # Calendar logic, deadline generation, reminders
│  │  ├─ copilot/             # Context package definitions per page
│  │  ├─ audit/               # Audit log writer (append-only)
│  │  └─ pdf/                 # PDF generation for reports and forms
│  └─ components/
│     ├─ copilot/             # Right-panel AI chatbot component
│     ├─ reports/             # Report components (tables, charts, export)
│     ├─ forms/               # Transaction entry forms, PO forms
│     └─ shared/              # Common UI components
```

### 3.2 Key Libraries (Anticipated)

| Concern | Library | Rationale |
|---------|---------|-----------|
| Database ORM | Drizzle or Prisma | Type-safe Postgres access with Neon |
| PDF generation | @react-pdf/renderer or jsPDF | Report PDF export, 1099/W-2 forms |
| Email | Postmark SDK | Transactional email (acknowledgments, alerts) |
| Bank feeds | plaid-node | Plaid `/transactions/sync` API |
| AI | @anthropic-ai/sdk | Copilot server-side proxy |
| Charts | Recharts or similar | Utility trends, variance visualization |

Tech stack decisions finalized during `/tech-stack` phase.

---

## 4. Integration Architecture

### 4.1 Internal App Integration (Database-Mediated)

```
┌─────────────────────┐    Restricted Postgres Role     ┌──────────────────┐
│  renewal-timesheets  │ ──SELECT──► reference tables ◄──│  expense-reports  │
│                      │ ──INSERT──► staging_records  ◄──│                  │
│                      │ ──SELECT──► staging_records     │                  │
│                      │    (read back status)           │                  │
└─────────────────────┘                                  └──────────────────┘
         │                                                        │
         │ READ-ONLY                                              │
         ▼                                                        │
┌─────────────────────┐                                           │
│     app-portal       │ ◄── READ-ONLY (employee data) ──────────┘
│   (People / Auth)    │ ◄── READ-ONLY (employee data) ──── financial-system
└─────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   financial-system                     │
│                                                       │
│  Staging Processor:                                   │
│  1. Query staging_records WHERE status = 'received'   │
│  2. Validate (FK constraints already passed)          │
│  3. Create GL entries (transaction + lines)           │
│  4. UPDATE staging_records SET status = 'posted',     │
│     gl_transaction_id = [new entry ID]                │
│  5. Audit log entry                                   │
└──────────────────────────────────────────────────────┘
```

**Postgres roles:**

| Role | Granted On | Permissions |
|------|-----------|-------------|
| `timesheets_role` | financial-system DB | SELECT on `accounts`, `funds`, `vendors`. INSERT + SELECT on `staging_records`. |
| `expense_reports_role` | financial-system DB | SELECT on `accounts`, `funds`, `vendors`. INSERT + SELECT on `staging_records`. |
| `financial_system_reader` | app-portal DB | SELECT on `people`, `employee_payrolls`. |
| `timesheets_reader` | app-portal DB | SELECT on `people` (compensation_type, hourly_rate, exempt_status). |

**Cross-Neon-project connectivity:** The integration pattern is decided (D-118). The Neon-specific mechanics (cross-project connection strings, Neon branching, or co-location in single project) are determined at build time (D-131).

### 4.2 External API Integration

```
                          ┌──────────────────┐
        Daily Cron ──────►│  Plaid API       │
        (sync job)        │  /transactions/  │
                          │  sync            │
                          └────────┬─────────┘
                                   │ added/modified/removed
                                   ▼
                          ┌──────────────────┐
                          │ bank_transactions │ ──► Matching Engine ──► matches
                          └──────────────────┘

        Daily Cron ──────►┌──────────────────┐
        (sync job)        │  Ramp API        │
                          └────────┬─────────┘
                                   │ transactions
                                   ▼
                          ┌──────────────────┐
                          │ ramp_transactions │ ──► Categorization Queue
                          │ (uncategorized)   │
                          └──────────────────┘

        On trigger ──────►┌──────────────────┐
        (donor ack,       │  Postmark API    │
         sync alert)      └──────────────────┘
```

### 4.3 Scheduled Jobs

| Job | Frequency | Trigger | Action |
|-----|-----------|---------|--------|
| Plaid sync | Daily | Vercel cron | Pull transactions for all connected bank accounts |
| Ramp sync | Daily | Vercel cron | Pull new Ramp transactions |
| Staging processor | On INSERT or periodic | DB notification or cron | Process unprocessed staging records into GL entries |
| Monthly depreciation | Monthly (1st) | Vercel cron | Generate depreciation entries for all active assets |
| Monthly interest accrual | Monthly (last day) | Vercel cron | Generate AHP interest accrual entry |
| Compliance reminders | Daily | Vercel cron | Check deadlines, send 30-day and 7-day Postmark emails |
| Rent accrual | Monthly (1st) | Vercel cron | Generate rent receivable entries for all active tenants |
| Prepaid amortization | Monthly (1st) | Vercel cron | Generate amortization entries for all active prepaid schedules (DR Expense, CR Prepaid) |

---

## 5. Cross-Cutting Patterns

### 5.1 GL Engine

The GL engine is the core write path for all financial data. Every transaction — whether from manual entry, staging table processing, Ramp categorization, or system automation — goes through the same validation pipeline:

```
Input (transaction + lines)
  │
  ├─ Validate: Sum(debits) = Sum(credits)           → INV-001
  ├─ Validate: All account_ids exist and are active  → INV-002, INV-004
  ├─ Validate: All fund_ids exist                    → INV-003
  ├─ Set: source_type, source_reference_id           → INV-011
  ├─ Set: created_by, created_at
  │
  ├─ For each line coded to a restricted fund:
  │    └─ Generate net asset release entry            → INV-007
  │
  ├─ INSERT transaction + lines (single DB transaction)
  ├─ INSERT audit_log entry                           → INV-012
  │
  └─ Return: transaction with assigned ID
```

All write operations go through this engine. There is no alternative write path.

### 5.2 Transaction Correction

Three correction modes, determined by transaction state:

```
                    ┌─────────────────┐
                    │  Transaction    │
                    │  (posted)       │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
         Unmatched      Matched         Any State
              │              │              │
         Edit in place   Reversal        Void
         + audit trail   + correction    (exclude from GL,
                         entry           retain in audit)
```

- **Edit in place**: Direct update to transaction fields. Before/after state recorded in audit log. Only available for unmatched transactions.
- **Reversal**: New transaction with equal and opposite amounts, linked via `reversal_of_id`. Original transaction's `reversed_by_id` is set. Both visible in transaction history.
- **Void**: Transaction `is_voided = true`. Excluded from all GL calculations and financial statements. Visible in transaction history with VOID badge.

### 5.3 Fund Accounting

Fund is a first-class dimension alongside account. The accounting equation holds at both the entity level and the fund level:

```
Entity Level:  Assets = Liabilities + Net Assets
Fund Level:    Fund Assets = Fund Liabilities + Fund Net Assets

Consolidated view = Σ all funds
Fund view = filter to single fund
```

**Multi-fund transactions** (D-051): A single journal entry can span funds. Example:

```
Transaction: "Property insurance payment - split across funds"
  Line 1: DR Property Insurance    $600  AHP Fund (60%)
  Line 2: DR Property Insurance    $400  General Fund (40%)
  Line 3: CR Cash                 $1000  General Fund
```

The restricted net asset release (INV-007) fires for Line 1 (restricted fund), not for Lines 2-3.

### 5.4 Bank Reconciliation Trust-Escalation

```
Bank transaction arrives (daily sync)
  │
  ├─ Check matching rules → Auto-match if rule applies
  │                          (user previously created rule)
  │
  ├─ If no rule: suggest matches
  │   └─ Exact amount ±3 days, merchant name tiebreaker
  │
  └─ Transaction enters review queue
       │
       User reviews:
       ├─ Confirm suggested match → "Create rule?" prompt
       ├─ Reject and match manually → "Create rule?" prompt
       ├─ Create GL entry inline (bank-originated item)
       └─ Mark as outstanding / timing difference
```

### 5.5 AI Copilot Architecture

```
┌─────────────────────────────────────────┐
│              Page Component              │
│                                         │
│  ┌───────────────┐  ┌────────────────┐  │
│  │  Page Content  │  │  Copilot Panel │  │
│  │               │  │               │  │
│  │  (forms,      │  │  Chat UI      │  │
│  │   tables,     │  │  Message list  │  │
│  │   reports)    │  │  Input field   │  │
│  │               │  │               │  │
│  └───────────────┘  └───────┬────────┘  │
│                             │           │
└─────────────────────────────┼───────────┘
                              │
                    ┌─────────▼──────────┐
                    │  /api/copilot      │
                    │                    │
                    │  Context Package:  │
                    │  - page_context    │
                    │  - available_tools │
                    │  - knowledge_refs  │
                    │                    │
                    │  → Anthropic API   │
                    └────────────────────┘
```

Each page exports a `getCopilotContext()` function that returns:
- **data**: Current page state (form values, selected records, etc.)
- **tools**: Array of tool definitions the copilot can use on this page
- **knowledge**: Relevant reference material (IRS publications, GAAP policies, etc.)

The copilot proxy endpoint assembles the system prompt from the context package and forwards to Anthropic's API. The copilot has no hardcoded page-specific logic — all specialization comes from the context package.

### 5.6 Audit Trail

Every mutation to financial data flows through the audit system:

```
Application Layer
  │
  ├─ GL Engine writes ──► audit_log (transaction CRUD)
  ├─ Entity updates  ──► audit_log (vendor, tenant, donor, etc.)
  ├─ Bank rec actions ──► audit_log (match, sign-off, edit)
  ├─ Budget changes  ──► audit_log (budget line CRUD)
  └─ System config   ──► audit_log (rate changes, policy updates)
```

The audit log is the compensating control for the "no approval workflows" design (D-044). Any board member can review who did what, when, and why by querying the audit log viewer (Report #17).

### 5.7 Report Generation

All 29 reports follow the same architectural pattern:

```
Report Request (filters: date range, fund, period)
  │
  ├─ Query Layer: SQL against GL tables + supporting entities
  │   (one query function per report, in lib/reports/)
  │
  ├─ Formatter Layer: Shape data for display
  │   ├─ Apply functional allocation (reports needing Program/Admin/Fundraising)
  │   ├─ Apply budget comparison (reports with budget columns)
  │   ├─ Apply variance color coding
  │   └─ Apply "as of" timestamp
  │
  ├─ Render Layer:
  │   ├─ Interactive: React components (tables, charts, drill-down)
  │   ├─ PDF: Same data → PDF layout (board pack)
  │   └─ CSV: Same data → raw export (CPA)
  │
  └─ Fund drill-down: All fund-aware reports accept optional fund_id filter.
     Consolidated (no filter) = sum all funds.
```

The dashboard home screen (D-113) is a composite of 5 report widgets, each running a lightweight version of its full report's query.

**Report UI consistency:** All 29 reports share a unified component library. Filter headers look the same across reports — same layout, same field ordering when reports share filter fields (e.g., date range always first, fund filter always second). Reuse shared components (filter bar, table, export buttons, variance indicators, drill-down navigation) to keep reports visually coherent and reduce maintenance. Follows Design Principle #6 (consistent look and feel).

---

## 6. Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **Fund on line vs header** | Line-level | D-051 multi-fund splits require per-line fund assignment |
| **One staging table vs multiple** | One table with `record_type` + JSONB | Simpler schema, single processing pipeline, FK constraints work the same |
| **Functional allocation storage** | Metadata table, not GL entries | Avoids polluting GL with allocation journal entries. Applied on-the-fly in reports. D-061. |
| **Budget monthly storage** | 12-element array on budget_line | Simple, efficient. No separate monthly records table. Spread logic in application. |
| **Correction approach** | Edit (unmatched) / Reversal (matched) / Void | D-053. Balances usability (edit for easy fixes) with integrity (reversal for matched items). |
| **Matching rule storage** | JSONB criteria + action | Flexible for evolving rule patterns without schema changes |
| **Copilot per-page vs global** | Global component + per-page context | D-129. One component, many contexts. Reduces maintenance. |
| **Cash projection** | Separate table, not derived view | Projections include manual overrides and adjustment notes. Not purely computable. |
| **Audit log** | Append-only table with JSONB before/after | Flexible schema for diverse entity types. DB-role-enforced immutability. |
| **PII encryption** | AES-256-GCM at application layer (app-portal) | D-132. Tax IDs encrypted in `employee_payrolls` table. Financial-system reads via DB but encryption/decryption happens in app-portal's application layer. |

---

## 7. Security Model

No RBAC. All users are fully trusted (D-006, D-114). Security controls:

| Control | Implementation |
|---------|---------------|
| **Authentication** | Via app-portal (Zitadel). All RI apps share auth. |
| **Authorization** | All-or-nothing. If authenticated, full access to everything. |
| **Audit trail** | Compensating control for no-RBAC. Every action logged. |
| **PII protection** | Tax IDs AES-256-GCM encrypted at rest (app-portal). Plaid access tokens AES-256-GCM encrypted at rest (financial-system). Neon TLS in transit. |
| **Database roles** | Restricted Postgres roles for cross-app access. No UPDATE/DELETE on staging. INSERT-only on audit_log. |
| **Secrets** | Environment variables via Vercel. Never in code or client-side. |
| **Immutability** | Matched transactions and audit log cannot be modified (enforced at DB and application layer). |

---

## 8. Data Flows

### 8.1 Expense Report → GL

```
1. User approves expense report in expense-reports-homegrown
2. expense-reports INSERTs one row per line item into staging_records
   (FK constraints validate gl_account_id and fund_id)
3. Staging processor picks up records with status = 'received'
4. For each line: create GL entry (DR expense account, CR Reimbursements Payable)
5. If line's fund is restricted → auto-generate net asset release (INV-007)
6. UPDATE staging_records: status = 'posted', gl_transaction_id set
7. expense-reports reads status back for user-facing "Your expense report was posted"
8. Payment via UMass Five portal → bank rec matches payment to payable
9. On match: UPDATE staging_records status = 'matched_to_payment'
```

### 8.2 Timesheet → Payroll → GL

```
1. Supervisor approves timesheet in renewal-timesheets
2. renewal-timesheets INSERTs one row per fund into staging_records
   (aggregated: hours + earnings per fund)
3. At monthly payroll run:
   a. Financial-system reads staging_records for the pay period
   b. Reads employee withholding data from app-portal DB
   c. Calculates: federal tax, MA tax, FICA (employee + employer)
   d. Creates GL entries per employee:
      DR Salaries & Wages (gross) [per fund from staging]
      CR Federal Income Tax Payable
      CR State Income Tax Payable
      CR Social Security Payable
      CR Medicare Payable
      CR Accrued Payroll Payable (net)
      + Employer FICA entry
   e. If fund is restricted → net asset release (INV-007)
4. UPDATE staging_records: status = 'posted'
5. Payroll payment via UMass Five → bank rec matches
```

### 8.3 Ramp Transaction → GL

```
1. Daily cron syncs transactions from Ramp API
2. New transactions land in ramp_transactions with status = 'uncategorized'
3. Categorization (user or auto-rule):
   a. Check categorization_rules for matching criteria
   b. If rule with auto_apply: set gl_account_id + fund_id, status = 'categorized'
   c. If no rule: show in uncategorized queue, suggest AI categorization
   d. User confirms/selects GL account + fund
4. On categorization: create GL entry (DR expense, CR Credit Card Payable)
   status = 'posted'
5. Ramp autopay settlement hits bank → bank rec matches single settlement
6. Ramp cross-check verifies: sum(categorized transactions) = settlement amount
```

### 8.4 Bank Reconciliation Flow

```
1. Daily Plaid sync brings new bank transactions
2. For each new bank transaction:
   a. Check matching_rules → auto-match if applicable
   b. If no rule: run matching algorithm (exact amount, ±3 days, merchant)
   c. Rank suggestions, present to user
3. User reviews reconciliation workspace:
   - Left side: bank transactions (matched + unmatched)
   - Right side: GL entries (matched + unmatched + outstanding)
4. For each item, user can:
   - Confirm suggested match → prompted to create rule
   - Manually match to GL entry
   - Split bank transaction → match parts to different GL entries
   - Create inline GL entry (bank-originated items)
   - Mark as outstanding (timing difference)
   - Mark as GL-only with explanation
5. Reconciliation complete when both sides fully accounted for
6. Formal sign-off: records user, timestamp, reconciled balance
```

---

## 9. Compliance Integration Points

Compliance is not a separate module — it's woven throughout:

| Compliance Concern | Where It Lives | How It Works |
|-------------------|----------------|--------------|
| Form 990 Part IX | `form_990_line` on accounts + `functional_allocations` table | Report #4 applies allocations and groups by 990 lines |
| MA security deposits | `tenants` table + `compliance_deadlines` | Per-tenant tracking, automated interest calc, anniversary reminders |
| Rent proration | GL engine (automated calc) | Daily rate formula per MA G.L. c. 186 § 4 |
| 1099-NEC | `vendors` table + payment tracking | Auto-flag $600+ threshold, W-9 workflow, PDF generation |
| Public support test | `source_type` on contributions | Data captured from day one (D-063), calculation deferred to post-grace-period |
| GAAP policies | System configuration | Capitalization threshold, bad debt method, depreciation policy stored as config, referenced in reports |
| Filing deadlines | `compliance_deadlines` table | Automated Postmark reminders at 30 and 7 days |

---

## 10. Migration Strategy

### FY25 Data (D-033)

1. Export all FY25 transactions from QBO (CSV)
2. Run import script: validate, flag as FY25_IMPORT, insert
3. Run accrual adjustment script:
   - Prepaid insurance: $501
   - Accrued reimbursements: $4,472 (Heather)
   - December rent AR (if applicable)
   - Accrued AHP interest (calculated from last payment)
4. Generate conversion summary (cash-basis ending → accrual-basis opening)
5. Jeff reviews and approves

### Bank History (D-102)

1. Initial Plaid sync pulls up to 24 months of history
2. Starting balance = $0 (accounts opened when company had $0 net cash)
3. Full history rebuild: reconcile every historical transaction
4. No mid-stream cutover balance — clean start

---

## 11. Explicitly Deferred

These items have foundations in the current design but implementation is deferred:

| Item | Foundation | Trigger |
|------|-----------|---------|
| HTC equity accounting | Fund structure, component depreciation | HTC deal structured (~2027) |
| QRE tracking | CIP account, component assets | HTC consultant requirements |
| Funder report templates | Fund reports, export capability | Award letter received |
| Move-out deposit workflow | Per-tenant tracking, compliance calendar | Tenants move in |
| Cross-app copilot (v2) | Copilot architecture, context packages | After v1 copilot stable |
| Schedule A calculation | Source type on contributions | After 5-year grace (~2030) |
| Budget version history | Budget table structure | If org grows to need it |
