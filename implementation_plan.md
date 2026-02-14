# Financial System — Implementation Plan

**For:** Renewal Initiatives, Inc.
**Built by:** Jeff Takle + Claude Code
**Stack:** Next.js 15 + Drizzle + Neon Postgres + Tailwind 4 + shadcn/ui + TanStack Table
**Source docs:** requirements.md, design.md, technology_decisions.md

---

## 1. Overview

This plan builds a nonprofit fund accounting system for Renewal Initiatives, Inc. — a MA 501(c)(3) managing a single property development and housing operation. The system replaces QBO with a purpose-built GAAP-compliant ledger supporting fund accounting, bank reconciliation, payroll, CIP/fixed asset tracking, 29 reports, and an AI copilot.

**Approach:** 18 sequential phases, each producing a testable artifact. Early phases establish the project skeleton, database schema, and GL engine. Middle phases layer on domain features (revenue, expenses, payroll, bank rec, integrations). Later phases add reporting, AI copilot, migration, and deployment hardening. The GL engine is built first because every subsequent feature writes through it.

**Scale context:** 2-5 trusted users, <1,000 transactions/month. No multi-tenancy, no RBAC, no approval workflows. Audit logging is the compensating control.

---

## 2. Phase 0: Technology Stack Decisions

**Status:** Complete. See `technology_decisions.md`.

All technology choices are finalized:

| Category | Choice |
|----------|--------|
| Framework | Next.js 15 (App Router) |
| Database | Neon Postgres + Drizzle ORM |
| UI | shadcn/ui + TanStack Table + Tailwind CSS 4 |
| Charts | shadcn/ui Charts (Recharts) |
| PDF | @react-pdf/renderer + pdf-lib |
| Auth | next-auth v5 (Zitadel via app-portal) |
| Validation | Zod |
| AI | @anthropic-ai/sdk |
| Bank feeds | plaid-node |
| Email | Postmark |
| Testing | Vitest + Playwright |
| Hosting | Vercel (local / staging / production) |
| Package manager | npm |

No further decisions required for Phase 0.

### Development-Time MCP Servers

The following MCP servers are configured for Claude Code during development (not shipped in the app):

| MCP Server | Purpose | Source |
|------------|---------|--------|
| **charity-mcp-server** | IRS nonprofit data lookup — EIN verification, tax-deductible status checks, comparable org research | https://github.com/briancasteel/charity-mcp-server |
| **propublica-mcp** | ProPublica Nonprofit Explorer — 990 financial data for 1.8M+ orgs, benchmarking, peer comparison | https://github.com/asachs01/propublica-mcp |

These help Claude Code answer questions about RI's tax status, validate design decisions against real nonprofit data, and look up comparable organizations during planning and development. They run via stdio transport and require no API keys.

**Usage patterns discovered (Feb 2025 testing):**
- **ProPublica search** works best with short single-word queries (e.g., "housing") — multi-word queries often return 0 results. EIN-based lookups (`get_organization`, `analyze_nonprofit_financials`, `get_organization_filings`) are reliable and return rich data
- **ProPublica PDFs** are the richest data source — the API returns financial totals but not Part IX functional breakdowns. Download 990 PDFs via `get_most_recent_pdf` and read them for line-item detail
- **Charity MCP** is best for quick verification — `charity-lookup` confirms EIN/status instantly, `public-charity-check` validates tax-deductible eligibility
- **Validated comparable orgs for RI:** Falcon Housing Corp (04-3538884, closest match — single MA property, $578K rev, $3.3M assets), Pioneer Valley Habitat (04-3049506, $1.2M rev, active fundraising), Valley CDC (22-2906466, $4.2M rev — where RI could grow)
- **Completed research:** Functional allocation defaults for Phase 17 wizard — extracted Part IX data from all three comps to ground the Program/M&G/Fundraising smart defaults in real 990 filings rather than generic benchmarks

---

## 3. Phase 1: Project Scaffolding & Dev Environment

**Goal:** Stand up a working Next.js project with the full toolchain, CI pipeline, and a deployable shell.

**Tasks:**

1. Initialize Next.js 15 project with App Router (`npx create-next-app@latest financial-system --app --ts --tailwind --eslint`)
2. Install and configure core dependencies: `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`, `zod`, `swr`, `next-auth`, `tailwind-merge`, `clsx`, `class-variance-authority`, `lucide-react`, `next-themes`
3. Initialize shadcn/ui (`npx shadcn@latest init`) — configure with forest green theme tokens to match renewal-timesheets' visual language per Design Principle #6
4. Install TanStack Table (`@tanstack/react-table`)
5. Create three Neon databases: `financial-system-dev`, `financial-system-staging`, `financial-system-prod`
6. Configure environment variables in `.env.local` for dev DB connection string, and in Vercel for staging/prod
7. Set up Drizzle config (`drizzle.config.ts`) pointing to Neon
8. Create initial `src/lib/db/index.ts` with Neon serverless client and Drizzle instance
9. Configure next-auth v5 with Zitadel OIDC provider — reference expense-reports-homegrown's existing pattern
10. Create app shell layout (`src/app/layout.tsx`) with sidebar navigation, top bar, and content area
11. Build shared `<Breadcrumbs />` component that reads `usePathname()` and resolves display names from route metadata (SYS-P0-018)
12. Build `<UserMenu />` dropdown component: current user name/email, "Back to App Portal" link, Sign Out action (SYS-P0-019, SYS-P0-020)
13. Create placeholder route groups matching design.md Section 3.1: `(dashboard)`, `transactions`, `accounts`, `funds`, `revenue`, `expenses`, `payroll`, `bank-rec`, `reports`, `budgets`, `compliance`, `vendors`, `tenants`, `donors`, `assets`, `settings`
14. Set up Vitest config (`vitest.config.ts`) with jsdom environment, path aliases, and `@testing-library/react`
15. Set up Playwright config (`playwright.config.ts`) for E2E tests
16. Configure GitHub Actions CI: lint, type-check, Vitest unit tests, Playwright E2E (runs on Linux to match Vercel production target)
17. Set up Vercel project with three environments: preview (staging), production (main branch)
18. Verify: app deploys to Vercel, auth flow works end-to-end, CI passes green

**Deliverable:** Deployable Next.js app with working auth, navigation shell, CI pipeline, and three Neon environments. Every page shows the breadcrumb trail and user menu.

---

## 4. Phase 2: Core Database Schema & Seed Data

**Goal:** Define the complete core database schema in Drizzle and seed the chart of accounts and funds.

**Tasks:**

1. Define `accounts` table: id, code, name, type (enum: Asset, Liability, NetAsset, Revenue, Expense), sub_type, normal_balance (enum: Debit, Credit), active, form_990_line (nullable), parent_account_id (self-referential FK), system_locked, created_at, updated_at
2. Define `funds` table: id, name, restriction_type (enum: Restricted, Unrestricted), active, description, system_locked, created_at, updated_at
3. Define `transactions` table: id, date, memo, source_type (enum: MANUAL, TIMESHEET, EXPENSE_REPORT, RAMP, BANK_FEED, SYSTEM, FY25_IMPORT), source_reference_id (nullable), is_system_generated, is_voided, reversal_of_id (nullable self-ref FK), reversed_by_id (nullable self-ref FK), created_by, created_at
4. Define `transaction_lines` table: id, transaction_id (FK), account_id (FK), fund_id (FK), cip_cost_code_id (nullable FK), debit (decimal, nullable), credit (decimal, nullable), memo (nullable) — with CHECK constraint: exactly one of debit/credit is non-null and positive
5. Define `cip_cost_codes` table: id, code, name, category (enum: hard_cost, soft_cost), active, sort_order, created_at
6. Define `audit_log` table: id, timestamp, user_id, action (enum: created, updated, voided, reversed, deactivated, signed_off, etc.), entity_type, entity_id, before_state (jsonb, nullable), after_state (jsonb), metadata (jsonb, nullable) — no UPDATE or DELETE in application code
7. Run `drizzle-kit generate` and `drizzle-kit push` to create tables in dev DB
8. Write seed script (`src/lib/db/seed.ts`) for the full chart of accounts from requirements.md Section 9.1 — all 44+ accounts with correct types, sub-types, normal balances, system_locked flags, form_990_line values, and parent relationships (CIP parent → 5 sub-accounts, Building → component accounts)
9. Write seed script for the 6 seed funds from requirements.md Section 9.2: General Fund (locked), AHP Fund, CPA Fund, MassDev Fund, HTC Equity Fund, MassSave Fund
10. Write seed script for initial CIP cost codes: CSI divisions (03 Concrete, 07 Thermal/Moisture, 08 Openings, 09 Finishes, 22 Plumbing, 23 HVAC, 26 Electrical, 31 Earthwork, etc.) and soft cost categories (Architectural & Engineering, Legal, Permitting, Inspection, etc.)
11. Write Zod schemas for all tables — these serve as both DB validation and API input validation
12. Write unit tests: verify seed data loads correctly, verify account hierarchy (parent/child relationships), verify CHECK constraints on transaction_lines
13. Create `npm run seed` command that runs seed scripts against the target database

**Deliverable:** Complete core schema deployed to dev DB with all seed accounts, funds, and cost codes. Zod validation schemas in place. All seed data matches requirements.md Section 9.

---

## 5. Phase 3: GL Engine & Audit Logging

**Goal:** Build the central GL write path that every transaction — manual, automated, or integrated — flows through.

**Tasks:**

1. Create `src/lib/gl/engine.ts` — the single write path for all GL entries. Function signature: `createTransaction(input: TransactionInput): Promise<Transaction>` where `TransactionInput` includes date, memo, source_type, source_reference_id, is_system_generated, lines (array of {account_id, fund_id, debit?, credit?, cip_cost_code_id?, memo?}), created_by
2. Implement INV-001 validation: sum of all line debits must equal sum of all line credits. Reject with descriptive error if violated
3. Implement INV-002 + INV-004 validation: every account_id must exist and be active
4. Implement INV-003 validation: every fund_id must exist
5. Implement INV-011: set source_type and source_reference_id at creation, make immutable
6. Implement INV-007: for each line coded to a restricted fund where the account is an expense type, atomically generate a net asset release entry (DR Net Assets With Donor Restrictions, CR Net Assets Without Donor Restrictions) for the same amount. The release entry is part of the same database transaction
7. Implement INV-008: set `is_system_generated = true` on auto-generated entries (net asset releases, depreciation, interest accrual). These entries are non-editable
8. Create `src/lib/audit/logger.ts` — append-only audit log writer. Function: `logAudit(params: {user_id, action, entity_type, entity_id, before_state?, after_state, metadata?})`. Every GL engine call invokes this
9. Wire audit logging into GL engine: every `createTransaction` call writes an audit log entry with the full transaction as `after_state`
10. Implement transaction correction — three modes per design.md Section 5.2:
    - `editTransaction(id, updates)` — only for unmatched transactions. Records before/after in audit log
    - `reverseTransaction(id, created_by)` — creates reversing entry linked via reversal_of_id/reversed_by_id. Original becomes immutable
    - `voidTransaction(id, created_by)` — sets is_voided = true. Excluded from GL totals. Audit logged
11. Implement INV-006: prevent editing of bank-matched transactions (check for match records before allowing edit)
12. Implement soft-delete pattern (INV-013): no DELETE operations anywhere. Accounts with history → deactivate only
13. Implement fund-coding warning (TXN-P0-003): if a line has no fund, warn but allow, default to General Fund on user confirmation
14. Write comprehensive unit tests:
    - Balanced entry succeeds
    - Unbalanced entry rejected (INV-001)
    - Inactive account rejected (INV-004)
    - Invalid fund rejected (INV-003)
    - Restricted fund expense triggers net asset release (INV-007)
    - Reversal creates linked entry with opposite amounts
    - Void excludes from GL totals
    - Edit of matched transaction rejected
    - Audit log entry created for every operation
    - System-generated entries are non-editable (INV-008)

**Deliverable:** Fully tested GL engine that enforces all 15 system invariants. Every write path produces audit trail entries. Transaction corrections (edit/reverse/void) working with proper guards.

---

## 6. Phase 4: Chart of Accounts & Fund Management UI

**Goal:** Build the UI for managing GL accounts and funds — the reference data that every other feature depends on.

**Tasks:**

1. Build Chart of Accounts list page (`/accounts`) using TanStack Table: columns for code, name, type, sub-type, normal balance, active status, system-locked badge, form_990_line. Sortable, filterable
2. Build account detail/edit page (`/accounts/[id]`): view account details, edit name (unless system-locked), toggle active status (with guard: cannot deactivate if account has transaction history — show balance), view parent/child hierarchy
3. Build "Create Account" form: code (unique), name, type (dropdown), sub-type, parent account (optional dropdown filtered by type), form_990_line (optional). Validate via Zod schema. Write through audit logger
4. Build Funds list page (`/funds`) using TanStack Table: columns for name, restriction type, active status, system-locked badge, current balance (calculated from GL)
5. Build fund detail page (`/funds/[id]`): view fund info, see current balance, toggle active (with guard: cannot deactivate if balance is non-zero per DM-P0-007)
6. Build "Create Fund" form: name, restriction type (Restricted/Unrestricted — set once, immutable per INV-005), description. Write through audit logger
7. Build fund balance calculation query: for any fund, sum all transaction_lines debits and credits grouped by account type to derive fund-level assets, liabilities, net assets
8. Build account hierarchy display: tree view showing parent accounts with expandable children (CIP parent → 5 sub-accounts, Building accounts with components)
9. Add `<HelpTooltip>` instances on key fields: "Fund," "Restriction Type," "Normal Balance," "System Locked," "Form 990 Line" with explanations from glossary and GAAP policies (SYS-P0-021)
10. Create `src/lib/help/terms.ts` — static `Record<string, string>` lookup table for help tooltip content. Seed with ~20 terms from glossary, GAAP policies, and MA compliance rules. Enrich each term with authoritative references: IRC section citations (e.g., "Fund Accounting" → ASC 958, IRC 501(c)(3)), Treasury Regulation references where applicable (e.g., "Restriction Type" → 26 CFR 1.501(c)(3)-1), and RI-specific context (e.g., public charity classification 170(b)(1)(A)(vi), MA ST-2 exemption). These grounded references provide better-than-generic AI assistance at the tooltip level before the full copilot ships in Phase 18
11. Write E2E test: create a new account, verify it appears in the list, create a fund, verify balance enforcement

**Deliverable:** Working account and fund management pages. Users can view the full chart of accounts, create new accounts/funds, and manage active status with proper guards.

---

## 7. Phase 5: Manual Journal Entry & Transaction List

**Goal:** Build the primary manual data entry path and the transaction history viewer.

**Tasks:**

1. Build manual journal entry form (`/transactions/new`): date picker, memo field, dynamic line rows. Each line: account selector (searchable dropdown), fund selector (searchable dropdown with default to General Fund), debit amount, credit amount, optional CIP cost code (shown only when account is a CIP sub-account), optional line memo
2. Implement real-time balance validation: show running sum of debits vs credits as user adds lines. Disable submit if unbalanced. Visual indicator (green check / red X)
3. Implement "Add Line" and "Remove Line" buttons. Minimum 2 lines per entry
4. Multi-fund split support (TXN-P0-002, DM-P0-010): allow different fund on each line. Implement percentage-to-dollar conversion: user can enter percentage split and system calculates dollar amounts that sum to total
5. On submit: call GL engine `createTransaction` with source_type = MANUAL. Display success with transaction ID and link to view
6. Build transaction list page (`/transactions`) using TanStack Table: date, memo, source type badge, total amount, status indicators (active/voided/matched/system-generated/reversed per TXN-P0-045), created by. Sortable by date, filterable by source type and date range
7. Build transaction detail page (`/transactions/[id]`): full header info + all lines with account names, fund names, debit/credit amounts. Show reversal chain if applicable (link to reversed entry / reversing entry). Show audit trail for this transaction
8. Implement transaction correction UI:
    - "Edit" button (visible only for unmatched, non-system-generated transactions): opens inline edit with before/after preview
    - "Reverse" button (visible for matched transactions): creates reversing entry, shows confirmation dialog with the reversal preview
    - "Void" button (visible for all non-voided transactions): confirmation dialog, sets is_voided and shows VOID badge
9. Build transaction search: free-text search across memo, account name, fund name. Date range filter. Amount range filter
10. Write E2E tests: create a manual journal entry, verify it appears in transaction list, edit an unmatched entry, void a transaction, reverse a transaction

**Deliverable:** Users can create manual journal entries with multi-fund splits, view full transaction history with status badges, and perform corrections (edit/reverse/void).

---

## 8. Phase 6: Supporting Entities — Vendors, Tenants, Donors

**Goal:** Build the CRUD interfaces for the three main entity types that transactions reference.

**Tasks:**

1. Define `vendors` table in Drizzle schema: id, name, address, tax_id (text — encrypted at rest by Neon TLS + application-layer AES-256-GCM), entity_type, is_1099_eligible, default_account_id (FK), default_fund_id (FK), w9_status (enum: collected, pending, not_required), w9_collected_date (nullable), active, created_at, updated_at
2. Define `tenants` table: id, name, unit_number, lease_start, lease_end, monthly_rent (decimal), funding_source_type (enum: tenant_direct, VASH, MRVP, section_8, other_voucher), move_in_date, security_deposit_amount (decimal), escrow_bank_ref, deposit_date, interest_rate (decimal), statement_of_condition_date, tenancy_anniversary, active, created_at, updated_at
3. Define `donors` table: id, name, address, email, type (enum: individual, corporate, foundation, government), first_gift_date, created_at, updated_at
4. Run migration to create tables
5. Build vendors list page (`/vendors`) with TanStack Table: name, entity type, 1099 eligible, W-9 status, default account. Filterable by 1099 eligibility and W-9 status
6. Build vendor create/edit form: all fields, searchable account/fund selectors for defaults, W-9 status workflow (pending → collected with date). Tax ID field masked on display
7. Build tenants list page (`/tenants`) with TanStack Table: name, unit number, monthly rent, funding source, lease dates, security deposit status
8. Build tenant create/edit form: all fields including security deposit details (amount, date, escrow bank ref, interest rate, statement of condition date). Enforce max deposit = first month's rent (TXN-P0-049). Calculate tenancy anniversary from move-in date
9. Build donors list page (`/donors`) with TanStack Table: name, type, first gift date, total giving (calculated)
10. Build donor create/edit form: all fields. Simple — minimal CRM per D-038
11. Wire all entity creates/updates through audit logger
12. Implement soft-delete (deactivate) for all three entities with history guards
13. Build vendor 1099 tracking foundation: query to sum payments per vendor per calendar year. Show running total on vendor detail page. Flag when $600 threshold crossed (DM-P0-015)
14. Add `<HelpTooltip>` for domain terms: "1099 Eligible," "W-9 Status," "Funding Source Type," "Security Deposit Escrow," "Tenancy Anniversary"
15. Write unit tests for 1099 threshold calculation and security deposit max validation

**Deliverable:** Full CRUD for vendors, tenants, and donors. Vendor 1099 threshold tracking active. Tenant security deposit validation enforced.

---

## 9. Phase 7: Revenue Recording

**Goal:** Build all revenue entry paths — rent, grants, donations, earned income, pledges.

**Tasks:**

1. Define `grants` table: id, funder_id (FK vendors), amount, type (enum: conditional, unconditional), conditions (text), start_date, end_date, fund_id (FK), status, is_unusual_grant (boolean, default false — per Reg. 1.509(a)-3(c)(4), excludable from Schedule A public support test numerator and denominator), created_at, updated_at
2. Define `pledges` table: id, donor_id (FK), amount, expected_date, fund_id (FK), status, created_at, updated_at
3. Run migrations
4. Build rent accrual system:
    - Monthly cron job (1st of month): for each active tenant, generate GL entry (DR Accounts Receivable, CR Rental Income) coded to tenant's unit and fund (TXN-P0-004)
    - Rent payment receipt form: DR Cash, CR Accounts Receivable with tenant selector (TXN-P0-005)
    - Rent adjustment form with mandatory type (Proration/Hardship/Vacate) and required explanatory note. Posts to the appropriate adjustment account (TXN-P0-006)
5. Implement MA rent proration calculator (TXN-P0-007): daily rate = monthly rent / actual calendar days in month * days occupied. Auto-calculate for move-in and move-out dates
6. Build grant revenue recording:
    - Unconditional grants: form to record award (DR Grants Receivable, CR Grant Revenue, coded to restricted fund). Cash receipt form (DR Cash, CR Grants Receivable) (TXN-P0-008)
    - Conditional grants: record as refundable advance (DR Cash, CR Refundable Advance). Condition-met trigger to recognize revenue (DR Refundable Advance, CR Grant Revenue) (TXN-P0-009)
7. Build donation recording form: amount, donor selector, fund selector, contribution source type tag (government/public/related_party per DM-P0-018), is_unusual_grant checkbox (hidden unless grant context — per Reg. 1.509(a)-3(c)(4)). Posts: DR Cash or Pledges Receivable, CR Donation Income (TXN-P0-010). **Public support test note (from MCP research Feb 2025):** The 3-category source_type is sufficient for Schedule A data capture. The 2% threshold test (Schedule A Part II Line 5) applies to ALL donors, not just related_party — per-donor totals available via donor_id linkage. Rental income routes to Schedule A Line 10a (Total Support denominator) but NOT Line 1 (Public Support numerator), which will pressure RI's ratio post-construction
8. Build donor acknowledgment letter trigger (TXN-P0-011): on donation entry >$250, auto-send via Postmark template. Include donor name, date, amount, no-goods-or-services statement. Store Postmark template with Heather's signature image and letterhead
9. Build pledge recording form (TXN-P0-016): donor, amount, expected date, fund. Posts: DR Pledges Receivable, CR Donation Income
10. Build earned income recording form (TXN-P0-013): amount, description, account selector (filtered to revenue accounts). Posts: DR Cash/AR, CR revenue account. Defaults to unrestricted fund
11. Build investment income recording (TXN-P0-014): amount, date. Posts: DR Cash, CR Investment Income
12. Build AHP loan forgiveness recording (TXN-P0-015): amount. Posts: DR AHP Loan Payable, CR Donation Income. Auto-reduces max available credit on AHP loan
13. Define `ahp_loan` singleton config table: credit_limit, current_drawn_amount, current_interest_rate, rate_effective_date, annual_payment_date, last_payment_date (DM-P0-025)
14. Build in-kind contribution recording (TXN-P0-052, TXN-P0-053): three separate forms for In-Kind Goods, In-Kind Services, In-Kind Facility Use. Each posts to the correct revenue account with FMV amount
15. Write unit tests: rent proration calculation (various month lengths, mid-month move-in/out), net asset release fires on restricted grant revenue, donor ack threshold logic
16. Write E2E test: record a donation, verify acknowledgment letter sent (mock Postmark), verify GL entry created

**Deliverable:** All revenue types recordable through the GL engine. Rent accrual automated via cron. Donor acknowledgment letters auto-sent. Grant tracking (conditional/unconditional) functional.

---

## 10. Phase 8: Expense Processing & Purchase Orders

**Goal:** Build the expense recording paths — vendor invoices with PO system, manual expenses, and the payment execution workflow.

**Tasks:**

1. Define `purchase_orders` table: id, vendor_id (FK), description, contract_pdf_url, total_amount, gl_destination_account_id (FK), fund_id (FK), cip_cost_code_id (FK, nullable — required when destination is CIP sub-account), status (enum: draft, active, completed, cancelled), extracted_milestones (jsonb), extracted_terms (jsonb), extracted_covenants (jsonb), created_at, updated_at
2. Define `invoices` table: id, purchase_order_id (FK), vendor_id (FK), amount, invoice_date, due_date, gl_entry_id (FK nullable), payment_status (enum: pending, posted, matched_to_payment, paid), created_at, updated_at
3. Run migrations
4. Build PO creation form (`/vendors/[id]/pos/new`): vendor (pre-filled), description, contract PDF upload (to Vercel Blob or similar), total amount, GL destination account (dropdown filtered to CIP sub-accounts + expense accounts), fund, CIP cost code (required when GL destination is CIP, hidden otherwise). Status starts as draft (TXN-P0-019)
5. Build AI contract extraction (TXN-P0-020): on contract PDF upload, send to Anthropic API to extract milestones, dates, deliverables, payment terms, covenants. Present extracted data for user review/edit before saving to PO record
6. Build PO detail page (`/vendors/[id]/pos/[poId]`): show PO info, extracted terms, list of invoices against this PO, remaining budget (total - invoiced), compliance warnings
7. Implement PO compliance warnings (TXN-P0-021): time deadline warnings (approaching/passed), budget capacity warnings (invoiced approaching/exceeding PO total), covenant breach alerts
8. Build invoice recording form (`/vendors/[id]/pos/[poId]/invoices/new`): amount, invoice date, due date. On save: create GL entry (DR CIP or Expense Account per PO destination, CR Accounts Payable). Inherit CIP cost code from PO (DM-P0-028). Status = posted (TXN-P0-022)
9. Build payment execution workflow (TXN-P0-029): "Mark as payment in process" button on payable. User initiates payment externally (UMass Five portal). Plaid bank feed picks up the debit. Bank rec suggests match by amount and vendor. User confirms. Payable moves to paid
10. Build Outstanding Payables view: list all unpaid AP, Reimbursements Payable, Credit Card Payable. Group by vendor. Show aging (Report #7 data)
11. Build vendor payment summary on vendor detail page: total paid YTD, total paid by calendar year (for 1099 tracking), list of all POs and their invoices
12. Wire all PO and invoice operations through GL engine and audit logger
13. Write unit tests: PO budget capacity calculation, CIP cost code inheritance from PO to invoice, GL entry generation for invoice posting
14. Write E2E test: create PO, upload contract (mock AI extraction), create invoice against PO, verify GL entry, verify CIP cost code inherited

**Deliverable:** Full PO-to-invoice-to-payment workflow. AI contract extraction functional. CIP cost code flows from PO to invoice to GL. Payment execution workflow integrated with bank rec (Phase 12).

---

## 11. Phase 9: Ramp Credit Card Integration

**Goal:** Build the Ramp transaction sync, categorization queue, and auto-categorization rules.

**Tasks:**

1. Define `ramp_transactions` table per design.md Section 2.8: id, ramp_id, date, amount, merchant_name, description, cardholder, status (enum: uncategorized, categorized, posted), gl_account_id (FK nullable), fund_id (FK nullable), gl_transaction_id (FK nullable), categorization_rule_id (FK nullable), synced_at, created_at
2. Define `categorization_rules` table: id, criteria (jsonb — merchant patterns, description keywords), gl_account_id (FK), fund_id (FK), auto_apply (boolean), hit_count (integer default 0), created_by, created_at
3. Run migrations
4. Build Ramp API client (`src/lib/integrations/ramp.ts`): authenticate, fetch transactions (daily polling), handle pagination, handle refunds. Store API key in environment variable (INT-P0-015)
5. Build daily Ramp sync cron job (`src/app/api/cron/ramp-sync/route.ts`): fetch new transactions, upsert into `ramp_transactions` with status = uncategorized. Handle duplicates via ramp_id unique constraint
6. Build categorization queue page (`/expenses/ramp`): TanStack Table showing uncategorized transactions — date, merchant, amount, description, cardholder. Sort by date descending
7. Implement auto-categorization rule matching: on sync, check each new transaction against `categorization_rules`. If rule with auto_apply matches, set gl_account_id + fund_id + status = categorized, increment hit_count (TXN-P0-026)
8. Build manual categorization UI: for each uncategorized transaction, show GL account selector + fund selector. AI suggestion based on merchant patterns and historical categorizations (TXN-P0-025). Bulk selection + bulk categorize action
9. Build "Create Rule" prompt: after categorizing a transaction, prompt "Always categorize [merchant] as [account] + [fund]?" If yes, create categorization_rule with auto_apply = true
10. Build rule management page (`/expenses/ramp/rules`): list all rules, edit criteria/action, toggle auto_apply, view hit count, delete rule
11. On categorization (manual or auto): create GL entry via GL engine (DR expense account, CR Credit Card Payable per TXN-P0-027). Set ramp_transaction status = posted, store gl_transaction_id
12. Build Ramp settlement cross-check (REC-P0-014): at bank rec time, verify sum of categorized Ramp transactions for the period equals the Ramp autopay settlement amount. Flag mismatch
13. Implement sync failure handling (INT-P0-017): on API error, show dashboard notification, send Postmark alert email. Failed syncs retry next daily poll
14. Enforce INV-009: uncategorized Ramp transactions excluded from financial statements and cannot post to GL
15. Write unit tests: categorization rule matching logic, GL entry generation on categorization, settlement cross-check calculation
16. Write E2E test: mock Ramp API sync, categorize a transaction, verify GL entry, verify rule creation prompt

**Deliverable:** Daily Ramp sync operational. Categorization queue with AI suggestions and auto-rules. GL entries created on categorization. Settlement cross-check ready for bank rec.

---

## 12. Phase 10: Payroll Engine

**Goal:** Build the full payroll calculation engine, GL posting, and employee data integration.

**Tasks:**

1. Define `payroll_runs` table: id, pay_period_start, pay_period_end, status (enum: draft, calculated, posted), created_by, created_at, posted_at
2. Define `payroll_entries` table: id, payroll_run_id (FK), employee_id, gross_pay, federal_withholding, state_withholding, social_security_employee, medicare_employee, social_security_employer, medicare_employer, net_pay, fund_allocations (jsonb — array of {fund_id, amount, hours}), gl_transaction_id (FK nullable), created_at
3. Run migrations
4. Build app-portal DB reader (`src/lib/integrations/people.ts`): read employee data via restricted Postgres role `financial_system_reader`. Fields: employee name, compensation_type (PER_TASK/SALARIED), annual_salary, expected_annual_hours, exempt_status (EXEMPT/NON_EXEMPT), federal/state withholding elections, tax IDs (INT-P0-010, INT-P0-011)
5. Build federal income tax withholding calculator per IRS Publication 15-T (percentage method). Implement bracket-based calculation for monthly pay periods (TXN-P0-035)
6. Build MA state income tax withholding calculator per MA DOR Circular M. Flat rate with exemptions (TXN-P0-035)
7. Build FICA calculator: 6.2% Social Security (up to annual wage base — check cumulative YTD wages), 1.45% Medicare, both employee and employer share (TXN-P0-035)
8. Build gross pay calculator (TXN-P0-032, TXN-P0-033):
    - Read staging_records for approved timesheets in the pay period
    - PER_TASK employees: sum earnings from staging data (task code rates applied by renewal-timesheets)
    - SALARIED employees: use pre-calculated hourly rate (annual_salary / expected_annual_hours) from People API
    - Overtime (NON_EXEMPT only): 1.5x for hours over 40/week. EXEMPT get straight-time regardless
9. Build payroll run UI (`/payroll/runs/new`):
    - Select pay period (monthly)
    - System pulls staging records and employee data
    - Shows per-employee breakdown: gross pay (by fund), federal tax, state tax, FICA, net pay
    - User reviews and confirms
    - On confirm: generate GL entries per employee (TXN-P0-031):
      - DR Salaries & Wages (per fund from staging), CR Federal/State Tax Payable, CR SS/Medicare Payable, CR Accrued Payroll Payable (net)
      - Separate entry: DR Salaries & Wages (employer FICA share), CR SS/Medicare Payable (employer share)
10. Fund allocation (TXN-P0-034): payroll entries coded to fund per timesheet fund allocation from staging data
11. Build payroll run list page (`/payroll`): history of all payroll runs with status, period, total gross, total net
12. Build payroll run detail page (`/payroll/runs/[id]`): per-employee breakdown, GL entries generated, fund allocation summary
13. Update staging_records status to 'posted' after payroll GL entries created
14. Write comprehensive unit tests: federal tax bracket calculations (multiple income levels), MA tax calculation, FICA wage base cap, overtime at 1.5x, salaried hourly rate derivation, multi-fund payroll allocation
15. Write E2E test: create payroll run with mock staging data, verify all GL entries, verify withholding calculations

**Deliverable:** Complete payroll engine with tax withholding calculations (federal, MA, FICA). GL entries generated per employee with fund allocation. Integration with staging table and People API operational.

---

## 13. Phase 11: Fixed Assets, Depreciation & CIP

**Goal:** Build fixed asset management, monthly depreciation automation, and the CIP-to-fixed-asset conversion wizard.

**Tasks:**

1. Define `fixed_assets` table per design.md Section 2.2: id, name, description, acquisition_date, cost, salvage_value (default 0), useful_life_months, depreciation_method (always straight_line), date_placed_in_service, gl_asset_account_id (FK), gl_accum_depr_account_id (FK), gl_expense_account_id (FK), cip_conversion_id (FK nullable), parent_asset_id (nullable self-ref), active, created_at, updated_at
2. Define `cip_conversions` table: id, structure_name, placed_in_service_date, total_amount_converted, gl_transaction_id (FK), created_by, created_at
3. Define `cip_conversion_lines` table: id, conversion_id (FK), source_cip_account_id (FK), source_cost_code_id (FK nullable), target_fixed_asset_id (FK), amount, created_at
4. Run migrations
5. Build fixed asset list page (`/assets`): TanStack Table with name, acquisition date, cost, useful life, monthly depreciation amount, accumulated depreciation, net book value (calculated). Filterable by type (building component, equipment, vehicle, etc.)
6. Build fixed asset create/edit form: all fields. Account selectors pre-filtered (asset accounts for gl_asset, contra-asset for gl_accum_depr, expense for gl_expense). Parent asset selector for building components. Enforce straight-line only per D-127
7. Build monthly depreciation cron job (`src/app/api/cron/depreciation/route.ts`): for each active asset with date_placed_in_service, calculate monthly depreciation = (cost - salvage_value) / useful_life_months. Generate GL entry: DR Depreciation Expense, CR Accumulated Depreciation. Post to General Fund (TXN-P0-038). Skip assets where accumulated depreciation >= (cost - salvage_value). Set is_system_generated = true
8. Build component depreciation support (DM-P0-020): Lodging building parent with child components (structure 27.5yr, roof 20yr, HVAC 15yr, etc.). Each component depreciates independently. Parent asset detail page shows component breakdown
9. Build CIP balance viewer (`/assets/cip`): show current CIP balance by sub-account (Hard Costs, Soft Costs, Reserves & Contingency, Developer Fee, Construction Interest), with drill-down to cost code level within each sub-account
10. Build CIP-to-fixed-asset conversion wizard (`/assets/cip/convert`) per DM-P0-030:
    - Step 1: Select structure to convert (Lodging, Barn, Garage)
    - Step 2: Select CIP sub-accounts and cost codes to include in conversion. Show balances
    - Step 3: For Lodging: allocate CIP balance across components (structure, roof, HVAC, electrical, plumbing, windows, flooring). Set useful life per component. For Barn/Garage: single-item allocation with 27.5yr useful life
    - Step 4: Review — show the reclassification JE that will be generated (DR Building accounts, CR CIP sub-accounts) and the fixed asset records that will be created
    - Step 5: Commit — create fixed_assets records, generate reclassification JE via GL engine, create cip_conversions + cip_conversion_lines records. Depreciation begins next month
11. Support partial CIP conversion (DM-P0-031): only reclassify the allocated portion. Remaining CIP balance continues accumulating costs
12. Build AHP interest accrual cron job (`src/app/api/cron/interest-accrual/route.ts`) per TXN-P0-039:
    - Check `cip_conversions` table: if any structure lacks a conversion record → construction mode
    - During construction: DR CIP - Construction Interest, CR Accrued Interest Payable (capitalize 100%)
    - Post-construction (all structures converted): DR Interest Expense, CR Accrued Interest Payable
    - Rate from ahp_loan config. True-up on rate change. Annual payment (Dec 31) clears accrued interest
13. Build prepaid expense amortization (TXN-P0-054): when creating a prepaid (e.g., insurance), user specifies start date, end date, total amount. Monthly cron generates: DR Expense, CR Prepaid Expenses, pro-rated. Handle refund true-ups
14. Build developer fee tracking view: show total fee ($827K), cash paid portion, deferred portion (~$487K), paydown history. GL entries per DM-P0-033
15. Write unit tests: straight-line depreciation calculation, CIP conversion JE generation, interest capitalization mode switch, prepaid amortization pro-ration, partial conversion balance integrity
16. Write E2E test: create a fixed asset, run depreciation cron, verify GL entry and accumulated depreciation update. Run CIP conversion wizard, verify reclassification JE and new asset records

**Deliverable:** Fixed asset register with component depreciation. Monthly depreciation automated. CIP conversion wizard operational with partial conversion support. AHP interest accrual with construction/post-construction mode switching. Prepaid amortization automated.

---

## 14. Phase 12: Bank Reconciliation

**Goal:** Build the Plaid bank feed integration, trust-escalation matching engine, and reconciliation workspace.

**Tasks:**

1. Define bank reconciliation tables per design.md Section 2.3: `bank_accounts`, `bank_transactions`, `matches`, `matching_rules`, `reconciliation_sessions`. Run migrations
2. Build Plaid client (`src/lib/integrations/plaid.ts`): initialize with credentials, implement `/transactions/sync` with cursor-based incremental sync. Handle `added`, `modified`, `removed` arrays (INT-P0-013). Store Plaid access tokens and item IDs encrypted (AES-256-GCM) per SYS-P0-017
3. Build Plaid connection setup flow (`/settings/bank-accounts`): Link Token creation, Link initialization, public token exchange, access token storage. Support two accounts initially (checking, savings at UMass Five) with third (escrow) addable later (REC-P0-001)
4. Build daily Plaid sync cron job (`src/app/api/cron/plaid-sync/route.ts`): for each connected bank account, call `/transactions/sync` with stored cursor. Upsert bank_transactions. Handle Plaid sign convention: positive = money out, negative = money in (REC-P0-003). Update cursor after successful sync. Manual "Sync Now" button for on-demand refresh (REC-P0-002)
5. Handle pending-to-posted transitions: pending transactions displayed but not matchable (REC-P0-004). When Plaid reports a pending transaction as removed and re-added as posted, update the record
6. Build matching engine (`src/lib/bank-rec/matcher.ts`): for each unmatched bank transaction, find GL entry candidates by exact amount match within ±3 days date window. Merchant/payee name as tiebreaker when multiple candidates (REC-P0-007). Return ranked suggestions with confidence score
7. Build matching rule system: rules stored as JSONB criteria + action. On new bank transaction, check rules first → auto-match if applicable. Track hit_count per rule
8. Build reconciliation workspace page (`/bank-rec`):
    - Bank account selector at top
    - Left panel: bank transactions (matched + unmatched), grouped by status
    - Right panel: GL entries (matched + unmatched + outstanding), grouped by status
    - For each unmatched bank transaction: show suggested matches with confidence score
    - Actions per item: Confirm Match, Reject & Match Manually, Create GL Entry (inline), Mark Outstanding, Split Transaction
9. Implement multi-transaction matching (REC-P0-008): 1:many (one bank txn matches multiple GL entries) and many:1 (multiple bank txns match one GL entry). Bank transaction splitting: user splits amount into parts, each part matched to a different GL entry. Split lines must sum to original amount
10. Build inline GL entry creation from reconciliation screen (REC-P0-009): for bank-originated items (fees, interest, surprise ACH). Threshold prompt for amounts > configurable limit. Entries flagged as bank-originated. Fund assignment required
11. Implement "Create Rule?" prompt after manual match confirmation: if user confirms, create matching_rule for future auto-matches (trust-escalation per design.md Section 5.4)
12. Build GL-only category management (REC-P0-011): pre-configured list of GL entry types with no bank counterpart expected (depreciation, opening balance, loan interest accrual, net asset releases, loan forgiveness). These are auto-excluded from "unmatched" warnings
13. Mark outstanding items (REC-P0-012): GL entries without bank match shown as "outstanding" with visible dates. No automated stale check logic
14. Implement persistent reconciliation sessions (REC-P0-015): save progress, resume later. Session stores matches confirmed so far, items marked outstanding. Status = in_progress until sign-off
15. Build formal sign-off (REC-P0-013): records who reconciled, when, reconciled balance. Previously-reconciled items editable with mandatory change note. All changes audit logged
16. Build Ramp settlement cross-check within bank rec (REC-P0-014): match single Ramp autopay settlement to single GL payment entry. Verify sum of categorized Ramp transactions = settlement amount. Flag mismatch
17. Build full history rebuild capability (REC-P0-005): initial Plaid sync pulls up to 24 months. Start from $0 balance
18. Implement sync failure handling: dashboard notification + Postmark email alert on Plaid API errors (INT-P0-017)
19. Write unit tests: matching algorithm (exact amount, date window, tiebreaker), split transaction validation, GL-only category filtering, reconciliation balance calculation
20. Write E2E test: mock Plaid sync, match a bank transaction to GL entry, create a rule, verify auto-match on next sync, complete reconciliation sign-off

**Deliverable:** Full bank reconciliation system. Daily Plaid sync operational. Trust-escalation matching with rules. Two-way reconciliation workspace with split transactions, inline GL creation, persistent sessions, and formal sign-off.

---

## 15. Phase 13: Staging Table Integration — Timesheets & Expense Reports

**Goal:** Build the staging table, processing pipeline, and configure the restricted Postgres roles for internal app integration.

**Tasks:**

1. Define `staging_records` table per design.md Section 2.5: id, source_app (enum: timesheets, expense_reports), source_record_id, record_type (enum: timesheet_fund_summary, expense_line_item), employee_id, reference_id, date_incurred, amount, fund_id (FK), gl_account_id (FK nullable), metadata (jsonb), status (enum: received, posted, matched_to_payment, paid), gl_transaction_id (FK nullable), created_at, processed_at. UNIQUE constraint on (source_app, source_record_id) (INT-P0-005)
2. Run migration
3. Create restricted Postgres roles in Neon:
    - `timesheets_role`: SELECT on accounts, funds, vendors; INSERT + SELECT on staging_records
    - `expense_reports_role`: SELECT on accounts, funds, vendors; INSERT + SELECT on staging_records
    - No UPDATE, no DELETE for either role (INT-P0-001)
4. Build staging table processor (`src/lib/staging/processor.ts`): query staging_records WHERE status = 'received', validate data, create GL entries via GL engine, update status to 'posted' with gl_transaction_id. Run as periodic cron or triggered process (INT-P0-004)
5. Implement timesheet processing: read staging records with record_type = 'timesheet_fund_summary'. Timesheets don't create GL entries directly — they accumulate for payroll processing (Phase 10). Update status to indicate receipt
6. Implement expense report processing (TXN-P0-017): for each expense line item staging record, create GL entry (DR expense account from gl_account_id, CR Reimbursements Payable). Each line has its own GL account + fund per INT-P0-008. Update staging status to 'posted'
7. Build staging record viewer page (`/settings/staging`): show all staging records with status, source app, amount, date. Filterable by status and source. Useful for debugging integration issues
8. Implement error visibility: FK constraint violations on staging INSERTs give immediate DB errors to source apps (INT-P0-005). Build a "failed inserts" view that shows constraint violation messages
9. Document Postgres role credentials and connection strings for renewal-timesheets and expense-reports-homegrown teams (Jeff, since he maintains all apps)
10. Build status read-back: source apps can SELECT staging_records to check processing status. Enables "Your expense report was posted to GL" messaging in source apps (INT-P0-004)
11. Write integration tests: simulate staging INSERT from external app (using restricted role), verify FK constraints catch invalid accounts/funds, verify duplicate prevention via UNIQUE constraint, verify GL entry creation from staging data
12. Write E2E test: insert mock staging records, run processor, verify GL entries and status updates

**Deliverable:** Staging table with restricted Postgres roles ready for renewal-timesheets and expense-reports-homegrown. Processing pipeline converts staging records into GL entries. Source apps can read back processing status.

---

## 16. Phase 14: Budgeting & Cash Projection

**Goal:** Build the budget entry system with spread modes, variance calculation, and 3-month cash projection.

**Tasks:**

1. Define budget tables per design.md Section 2.4: `budgets`, `budget_lines`, `cash_projections`, `cash_projection_lines`. Run migrations
2. Build budget creation page (`/budgets/new`): fiscal year selector, status (draft/approved). One active budget per fiscal year (BDG-P0-005)
3. Build budget line entry UI (`/budgets/[id]/edit`): TanStack Table with rows = GL accounts, columns = months. For each account × fund combination:
    - Annual amount input
    - Spread mode selector: even (÷12), seasonal (user-specified monthly weights), one-time (single month), custom (manual each month) (BDG-P0-002)
    - Monthly amounts auto-calculated based on spread mode, editable for custom
4. Support full budget scope (BDG-P0-003): operating (revenue + expense accounts) + capital (CIP and fixed asset accounts) + financing (AHP draws, loan payments). Account type determines whether a line is operating or capital — no separate field needed
5. Implement mid-year revision (BDG-P0-005): actuals-to-date months locked from editing. Only future months editable. Overwrite, not version
6. Build budget variance calculation (`src/lib/budget/variance.ts`): for any GL account × fund × period, compute actual vs budget. Dollar variance and percentage variance. Color-code per RPT-P0-005: >10% over = yellow, >25% over = red (BDG-P0-007)
7. Build budget review page (`/budgets/[id]`): show all budget lines with actual vs budget columns, variance amounts and colors. Fund filter for fund-level budget view
8. Build 3-month cash projection page (`/budgets/cash-projection`) per BDG-P0-008, Report #15:
    - Auto-populate from budget data first, fall back to average of last 3 months actuals if no budget line exists
    - Monthly columns for 3 months ahead
    - Rows: Starting cash, inflow lines (rent, grants, budget), outflow lines (payables, budget, AHP interest, capital)
    - Each line: auto_amount (system-calculated), override_amount (user editable), override_note
    - AHP available credit shown as context
    - Save as cash_projection record
9. Build grant budgets as fund-level budgets (BDG-P0-009): multi-year grant budgets supported by allowing budget entries to span fiscal years
10. Build CIP budget view: budget vs actual at sub-account level (Hard Costs, Soft Costs, etc.) with drill-down to cost code level (DM-P0-029)
11. Integrate compliance calendar with budget cycle: Sept review → Oct draft → Nov circulation → Dec approval reminders (BDG-P0-004)
12. Write unit tests: spread mode calculations (even, seasonal, one-time, custom), variance calculation and color thresholds, cash projection auto-fill logic, mid-year lock validation
13. Write E2E test: create budget, enter lines with different spread modes, verify variance calculation against test GL data, create cash projection

**Deliverable:** Full budgeting system with four spread modes, variance tracking with color coding, and semi-automated 3-month cash projection. CIP budget drill-down by cost code operational.

---

## 17. Phase 15: Reports (Batch 1 — Core Financial Statements & Operational)

**Goal:** Build the first 13 reports: core financial statements, operational dashboards, and fund reports.

**Tasks:**

1. Build shared report infrastructure:
    - Report filter bar component: date range picker (always first), fund selector (always second when applicable), period selector. Same layout across all reports per design.md Section 5.7
    - Report table component: wraps TanStack Table with standard formatting — number formatting, percentage formatting, variance color coding, drill-down links
    - Report export buttons: PDF (via @react-pdf/renderer) and CSV export on every report (RPT-P0-002)
    - "As of" timestamp in every report header (RPT-P0-001)
    - Three comparison columns component: Current Period, Year-to-Date, Budget (RPT-P0-004). Budget column shows "—" until budgets entered
    - Fund drill-down: consolidated primary view with fund filter for detail (RPT-P0-003)
2. **Report #1 — Statement of Financial Position (Balance Sheet):** Assets / Liabilities / Net Assets. Net assets split: Without/With Donor Restrictions. Current vs noncurrent grouping. AHP loan note: "$3.5M facility, $Xk drawn, $Yk available." Fund drill-down
3. **Report #2 — Statement of Activities (P&L):** Revenue by type, expenses by nature, net asset releases (restricted → unrestricted), changes in net assets by restriction class. Core rent vs adjustments shown separately. Three comparison columns
4. **Report #3 — Statement of Cash Flows:** Indirect method. Operating / Investing (CIP, building) / Financing (AHP draws/payments). Derived from GL data
5. **Report #4 — Statement of Functional Expenses:** Matrix: expense rows × function columns (Program / Admin / Fundraising). GAAP/990 format toggle (TXN-P0-048). 990 format uses `form_990_line` mapping. Same underlying data, different row groupings
6. **Report #5 — Cash Position Summary:** Bank balances (from Plaid), outstanding payables, outstanding receivables, net available cash, AHP drawn vs available
7. **Report #6 — AR Aging:** By tenant + grants + pledges. Buckets: current, 30, 60, 90+ days. Distinguish delinquency from known payment delays (VASH tenants)
8. **Report #7 — Outstanding Payables:** Reimbursements Payable, Credit Card Payable, Accounts Payable, vendor invoices pending. Grouped by type and vendor
9. **Report #8 — Rent Collection Status:** Billed vs collected by unit this month. Occupancy tracking. Vacancy loss. Collection rate percentage
10. **Report #9 — Fund Draw-Down / Restricted Grant Status:** Per fund: awarded, spent, remaining restricted balance. Progress toward conditions for conditional grants
11. **Report #10 — Grant Compliance Tracking:** Conditional grant progress: matching requirements met? Milestones achieved? Linked to PO milestones
12. **Report #11 — Fund-Level P&L and Balance Sheet:** Same as reports 1-2 filtered to single fund. Drill-down from consolidated view
13. **Report #12 — Property Operating Expense Breakdown:** D-031's 13 categories (taxes, insurance, management, utilities split, repairs, etc.). Budget vs actual per category
14. **Report #13 — Utility Trend Analysis:** Electric, gas, water trends over time using shadcn/ui Charts (line chart). Solar ROI measurement, electrification tracking
15. Build PDF export for each report using @react-pdf/renderer. Match the on-screen layout as closely as practical. Include report title, date range, fund filter, "as of" timestamp, and RI letterhead
16. Build CSV export for each report: raw data with column headers matching report columns
17. Write unit tests for each report's query function: verify correct account grouping, fund roll-up, balance calculations, functional allocation application
18. Write E2E test: generate Report #1 with test data, verify balances, export PDF and CSV

**Deliverable:** 13 reports live with interactive viewing, PDF export, CSV export, fund drill-down, budget comparison columns, and variance color coding. Shared report component library established.

---

## 18. Phase 16: Reports (Batch 2 — Specialized, Compliance, Payroll, Budget)

**Goal:** Build the remaining 16 reports: specialized, audit/compliance, annual/covenant, payroll, and budget reports.

**Tasks:**

1. **Report #14 — Donor Giving History:** Per-donor giving history. Restricted vs unrestricted breakdown. Sortable by date, amount, fund
2. **Report #15 — 3-Month Cash Projection:** Display the cash projection data from Phase 14. Auto-fill + manual override columns. Monthly columns. Starting cash, inflows, outflows. AHP available credit context. Chart visualization
3. **Report #16 — AHP Loan Summary:** Drawn amount, available credit, interest accrued, annual payment history, rate history. Running balance chart
4. **Report #17 — Audit Log Viewer:** Filterable by user, date range, action type, entity type. Shows timestamp, user, action, before/after state (expandable JSON). Pagination for large result sets
5. **Report #18 — Transaction History:** Full searchable/filterable transaction list. Voided transactions with VOID badge. Source provenance visible. Date range, amount range, source type, account, fund filters
6. **Report #19 — Late Entry Report:** "Transactions posted to [period] after [date]" — highlights backdated entries. Useful for period-close review
7. **Report #20 — Annual Financial Package for AHP:** Composite report: financial statements + AHP loan summary. Covenant requirement. PDF export formatted for submission
8. **Report #21 — Form 990 / Form PC Data:** 990-format functional expenses (report #4 toggle), revenue by 990 line, officer compensation from payroll, supplementary schedules. CPA uses for filing
9. **Report #22 — Security Deposit Register:** Per-tenant: deposit amount, date, escrow bank, interest rate, interest accrued/paid, tenancy anniversary, next interest due. Totals reconcile to GL liability + escrow bank balance. 30-day anniversary alert
10. **Report #23 — Compliance Calendar:** Full-page calendar view filterable by type (tax, tenant, grant, budget). Upcoming 30 days highlighted. Color-coded by category
11. **Report #24 — Capital & Financing Budget Summary:** Planned vs actual: loan draws, capital spending by fund, debt service. CIP section shows sub-account level with drill-down to cost code level
12. **Report #25 — Payroll Register:** By period, per employee: gross, federal/state withholding, FICA, net, fund allocation
13. **Report #26 — Payroll Tax Liability Summary:** Federal + MA withholding, employer + employee FICA, deposit due dates, deposited vs outstanding
14. **Report #27 — W-2 Data Verification:** Year-end per-employee: preview of W-2 box values (1-6, 16-17) for review before generation
15. **Report #28 — Employer Payroll Cost Summary:** Total burden by period: wages + employer FICA + benefits. Budget comparison
16. **Report #29 — Quarterly 941/M-941 Prep:** Formatted to match federal 941 and MA M-941 line items: total wages, withholding, FICA, deposit reconciliation
17. Build PDF export for all 16 reports
18. Build CSV export for all 16 reports
19. Write unit tests for each report's data query
20. Write E2E test: generate Report #23 (compliance calendar), verify deadline display and filtering

**Deliverable:** All 29 reports complete with interactive viewing, PDF/CSV export. Full report inventory from requirements.md Section 5.3 operational.

---

## 19. Phase 17: Dashboard, Compliance Calendar & Tax Forms

**Goal:** Build the dashboard home screen, compliance calendar with automated reminders, functional allocation wizard, and tax form generation.

**Tasks:**

1. Build dashboard home screen (`/(dashboard)`) per design.md Section 5.2:
    - Section 1: Cash snapshot — bank balances (Plaid), net available cash, AHP drawn vs available. Links to Report #5
    - Section 2: Alerts/attention — overdue rent, compliance deadlines within 30 days, payroll deposits due, unmatched bank transactions, sync failures. Links to Reports #6, #23
    - Section 3: Rent collection — this month billed vs collected by unit. Links to Report #8
    - Section 4: Fund balances — restricted vs unrestricted net assets, per-fund breakdown. Links to Report #9
    - Section 5: Recent activity — last 10 transactions posted. Links to Report #18
2. Each dashboard section is a lightweight version of its full report query. Auto-refresh via SWR with revalidation on tab focus
3. Build compliance calendar system (`src/lib/compliance/`):
    - Seed all compliance deadlines per SYS-P0-009: 990 filing (May 15), Form PC (May 15), quarterly 941/M-941, W-2 deadline (Jan 31), 1099-NEC (Jan 31), budget cycle milestones (Sept-Dec), insurance renewals, per-tenant security deposit anniversaries, annual board meeting items, public support trajectory review (~FY2028 — as rental income enters Total Support denominator on Schedule A Line 10a but not Public Support numerator Line 1, RI's public support percentage will decline post-construction; proactive review ensures ratio stays above 33⅓% threshold per IRC § 509(a))
    - Recurrence engine: generate upcoming instances from annual/monthly/per-tenant recurrence patterns
    - Status tracking: upcoming → reminded → completed
4. Build compliance reminder email system (SYS-P0-008): daily cron checks deadlines, sends Postmark emails at 30-day and 7-day marks. Mark reminder_30d_sent and reminder_7d_sent flags
5. Build functional allocation wizard (`/compliance/functional-allocation`) per TXN-P0-046, TXN-P0-047:
    - Year-end per-GL-account allocation to Program / Management & General / Fundraising
    - Percentages must sum to 100% per account
    - Wizard-style UI, one account at a time with progress indicator
    - Stored as metadata in `functional_allocations` table — no GL journal entries
    - **Three-tier smart default system** (highest priority wins):
      1. **Permanent rules:** User marks an allocation as "permanent" — it auto-fills every year and skips the wizard. For accounts like Depreciation (always 100% Program), this eliminates annual busywork
      2. **Prior-year percentages** (year 2+): Copy last year's allocations as starting point
      3. **Account sub-type defaults** (year 1 or new accounts): Seed defaults keyed off `sub_type` so new accounts inherit their category's default automatically
    - **Seed defaults by sub-type** (`src/lib/compliance/functional-defaults.ts`), grounded in MCP research of comparable MA housing nonprofits' 990 Part IX filings (Feb 2025 — Falcon Housing Corp, Pioneer Valley Habitat, Valley CDC):
      - `Property Ops` → 100% Program / 0% M&G / 0% Fundraising (mark permanent). Rationale: property taxes, insurance, utilities, repairs, landscaping are direct program costs. All three comparable orgs allocate 96-100% of property costs to program
      - `Non-Cash` → 100% Program / 0% M&G / 0% Fundraising (mark permanent). Rationale: depreciation is direct program cost. All three comps agree
      - `Financial` → 100% Program / 0% M&G / 0% Fundraising (mark permanent). Rationale: AHP loan interest is property debt. Valley CDC allocates 100% of $265K interest to program
      - `Payroll` → 70% Program / 25% M&G / 5% Fundraising. Rationale: blended rate — Heather's ED/Bookkeeper role weights toward M&G more than a pure-ED split, other staff mostly program. Pioneer Valley splits ED comp at 53/16/31; RI's lower fundraising activity justifies less fundraising weight
      - `Operating` → 80% Program / 20% M&G / 0% Fundraising. Rationale: catch-all for misc operating costs. Lean toward program per comparable org patterns
    - **Benchmark comparison panel:** After Heather completes allocations, show RI's total Program/M&G/Fundraising percentages alongside peer benchmarks:
      - Falcon Housing Corp (EIN 04-3538884): 75.6% / 24.4% / 0.0% — closest comp, single MA property, no staff, rent-funded
      - Pioneer Valley Habitat (EIN 04-3049506): 78.0% / 9.6% / 12.3% — active fundraising model
      - Valley CDC (EIN 22-2906466): 85.2% / 14.5% / 0.3% — multi-property, government-funded
      - Industry benchmark: 65-75% program minimum (watchdog guidance). Common default: 65/25/10
      - Flag if RI's program percentage falls below 65% or above 90% — both are outliers worth reviewing with the CPA
6. Build W-2 generation (TXN-P0-036): aggregate per-employee annual data (boxes 1-6, 16-17). Use pdf-lib to fill official W-2 PDF template with pixel-precise field placement. Preview before generation (Report #27 data)
7. Build 1099-NEC preparation (TXN-P0-023): auto-track vendor payments by calendar year, flag $600+ threshold, W-9 collection tracking, data export (CSV), PDF 1099-NEC form generation via pdf-lib. Add TaxBandits API integration (`src/lib/integrations/taxbandits.ts`) as optional IRS e-filing path: W-9 collection via email (`request_w9_by_email`), 1099-NEC validation (`validate_1099_nec`), and IRS e-file submission (`create_1099_nec`). TaxBandits also exposes a remote MCP server (https://developer.taxbandits.com/docs/mcp/) for conversational tax filing if the copilot (Phase 18) needs to invoke it. Resolves open question Q19 from company_facts.md
8. Build filing progression awareness (SYS-P0-010): auto-compute which 990 form type RI must file based on real-time GL data — no manual configuration needed. Thresholds: 990-N (gross receipts ≤$50K), 990-EZ (gross receipts <$200K AND total assets <$500K), Full 990 (either threshold exceeded). **Key finding from MCP research (Feb 2025):** CIP counts as total assets on Form 990 Part X Line 10 (Schedule D Part VI Line 1e "Other"). RI will trigger Full 990 during construction — the moment CIP soft costs (architecture, engineering, legal, development consulting) push total assets past $500K — not at property PIS date. Comparable org: Falcon Housing Corp (EIN 04-3538884, E. Longmeadow) files Full 990 with similar profile ($578K revenue, $3.3M total assets driven by property). Sub-tasks:
    - Dashboard alert (Section 2): query total asset account balances vs $500K and YTD gross receipts vs $200K. Persistent alert when threshold crossed with link to 990 readiness page
    - Build 990 readiness checklist page (`/compliance/990-readiness`): verify form_990_line mapped on all active accounts, functional allocation completed, officer compensation data populated (requires `is_officer` flag from app-portal — see integrations/app-portal.md), contribution source type tags captured on donations
    - 990 officer compensation data (Report #21): Part VII requires officer name, title, avg hours/week, Column D (= greater of W-2 Box 1 or Box 5, sourced from payroll data), Column F (= employer-paid health premiums + retirement contributions per person, sourced from app-portal employee profile). Employer FICA is NOT officer compensation — it goes on Part IX Line 10 as org expense
9. Build quarterly 941/M-941 data export (TXN-P0-037): formatted to match form line items from Report #29 data
10. Build board pack generation workflow (RPT-P0-007): Heather manually selects reports, system generates combined PDF. No automated distribution
11. Write unit tests: compliance deadline recurrence generation, functional allocation percentage validation (sums to 100%), functional allocation default resolution (permanent rule > prior-year > sub-type default), benchmark outlier flagging (<65% or >90% program), W-2 box calculations
12. Write E2E test: verify dashboard loads with all 5 sections, verify compliance reminder sends (mock Postmark)

**Deliverable:** Dashboard home screen with all 5 sections. Compliance calendar with automated Postmark reminders. Functional allocation wizard. W-2 and 1099-NEC PDF generation. Board pack assembly.

---

## 20. Phase 18: AI Copilot

**Goal:** Build the system-wide AI copilot with per-page context packages.

**Tasks:**

1. Build copilot panel component (`src/components/copilot/CopilotPanel.tsx`): right-side sliding panel (shadcn/ui Sheet component), chat message list, text input with send button, streaming response display. Collapsible — available on every page but not intrusive (SYS-P0-001)
2. Build copilot API proxy (`src/app/api/copilot/route.ts`): receives messages + context package from client, assembles system prompt, forwards to Anthropic API via `@anthropic-ai/sdk`. Stream response back to client (SYS-P0-002)
3. Define copilot context package interface (`src/lib/copilot/types.ts`): `{ data: Record<string, any>, tools: ToolDefinition[], knowledge: string[] }`
4. Build tax law knowledge layer (`src/lib/copilot/tax-knowledge.ts`):
    - Curate a focused corpus of ~50-100 documents for the copilot's knowledge base:
      - **IRC primary law:** Sections 170 (charitable contributions), 501-530 (exempt organizations), 511-514 (UBIT), 263A (capitalization rules) — downloaded as USLM XML from uscode.house.gov, parsed to plain text
      - **Treasury Regulations:** Subchapter F (Exempt Organizations) via eCFR REST API (https://www.ecfr.gov/developers/documentation/api/v1) — free, no auth, point-in-time access. Key sections: 26 CFR 1.501(c)(3)-1, 1.170A-13 (substantiation), 1.509(a)-3 (public support test)
      - **IRS Publications:** Pub 557 (Tax-Exempt Status), Pub 598 (UBIT), Pub 1771 (Charitable Contributions Substantiation), Pub 4221-PC (Compliance Guide for 501(c)(3)s), Pub 15-T (Federal Income Tax Withholding Methods), Pub 946 (Depreciation) — downloaded as PDF, parsed to text
      - **IRS Form Instructions:** Form 990, 990-EZ, 990-N, 990-T instructions — parsing targets: line-by-line guidance, threshold rules, schedule triggers
      - **MA-specific:** Form PC instructions (AG charity portal), MA DOR Circular M (state withholding), MA G.L. c. 186 (tenant law / security deposits), MA nonprofit FAQ from mass.gov
      - **Plain-language guides:** nonprofitaccountingbasics.org content on fund accounting, donor acknowledgment, functional expenses, 990 reporting
    - Build eCFR API client (`src/lib/copilot/ecfr-client.ts`): fetch specific CFR sections on demand (e.g., title 26, part 1, section 501(c)(3)-1). Cache responses. Use for real-time regulation lookup when copilot needs authoritative text
    - Build `taxLawSearch` copilot tool: searches the curated knowledge corpus and returns cited passages with source references (e.g., "Per IRC § 170(f)(8)(A), a donor must obtain a contemporaneous written acknowledgment for any single contribution of $250 or more")
    - Build `regulationLookup` copilot tool: fetches a specific Treasury Regulation section via eCFR API by citation (e.g., "26 CFR 1.501(c)(3)-1(d)(1)(ii)") and returns the full text. Useful when copilot needs to quote exact regulatory language
    - Build `nonprofitExplorerLookup` copilot tool: queries ProPublica Nonprofit Explorer API (free, no key) to look up comparable organizations by EIN or search — useful for benchmarking questions ("how do similar-sized nonprofits report this?"). **Implementation note from MCP testing (Feb 2025):** ProPublica search works best with short single-word queries (e.g., "housing") — multi-word queries often return 0 results. EIN-based lookups (`get_organization`, `analyze_nonprofit_financials`, `get_organization_filings`) are reliable and return rich data. Validated comps for RI: Falcon Housing Corp (04-3538884, closest match — $578K rev, $3.3M assets), Pioneer Valley Habitat (04-3049506, $1.2M rev), Valley CDC (22-2906466, $4.2M rev — where RI could grow). The `charity-mcp-server` and `propublica-mcp` dev-time MCP servers (see Phase 0) can assist with benchmarking during build
    - Store corpus as static text files in `src/lib/copilot/knowledge/` organized by topic (exempt-org-rules/, depreciation/, payroll-tax/, ma-compliance/, fund-accounting/). Loaded into copilot system prompt as relevant knowledge per context package. No vector DB needed at this scale — topic-based selection by context package is sufficient for ~50-100 documents
5. Build context package for fixed asset form: form state, asset register data, IRS publication search tool, useful life lookup tool. Tools: `regulationLookup`. Knowledge: D-127 depreciation policy, D-080 component depreciation rules, IRC § 168 (MACRS), Pub 946 excerpts on useful life by asset class (SYS-P0-004 — replaces standalone depreciation assistant D-128)
6. Build context package for Ramp categorization: transaction details, GL chart of accounts, categorization rule history, merchant pattern data. Tools: account suggestion, merchant pattern lookup. Knowledge: existing categorization rules, UBIT guidance from Pub 598 (flag if expense could relate to unrelated business activity)
7. Build context package for PO/vendor invoice: contract details, PO compliance status, budget remaining by fund. Tools: budget query, `taxLawSearch`. Knowledge: covenant terms from PO, IRC § 263A capitalization rules (relevant for CIP-coded invoices), 1099 reporting thresholds
8. Build context package for bank reconciliation: unmatched items, matching rules, transaction history. Tools: transaction history search. Knowledge: matching rules documentation
9. Build context package for compliance calendar: current deadlines, upcoming filings, functional allocation wizard state. Tools: `taxLawSearch`, `regulationLookup`, `nonprofitExplorerLookup` (with `includeBenchmarks: true` — enables copilot to answer "how does our allocation compare to similar orgs?"). Knowledge: filing requirements with statutory references (IRC § 6033 for 990 filing, MA AG Form PC rules, IRC § 6721/6722 penalty rules for late filing), MA tenant law (G.L. c. 186 for security deposit deadlines), functional allocation defaults and comparable org benchmarks
10. Build context package for transaction entry: current form state, recent transactions, chart of accounts. Tools: account lookup, recent transaction search, `taxLawSearch`. Knowledge: GAAP policies, ASC 958 fund accounting rules, donor acknowledgment thresholds (IRC § 170(f)(8) — $250+ requires written ack; quid pro quo disclosure required for $75+ contributions) (SYS-P0-004 — replaces standalone transaction assistant D-130)
11. Build context package for reports: current report data, filter state. Tools: drill-down queries, comparison queries, `nonprofitExplorerLookup`. Knowledge: report definitions, Form 990 Part IX functional expense classification rules, public support test calculation guidance (IRC § 509(a), 26 CFR 1.509(a)-3)
12. Build context package for dashboard: all dashboard section data. Tools: report navigation, transaction lookup. Knowledge: system overview
13. Build context package for revenue recording: current form state, donor/grant data. Tools: `taxLawSearch`, `regulationLookup`. Knowledge: ASC 958 revenue recognition (conditional vs unconditional contributions), donor acknowledgment letter requirements (Pub 1771), in-kind contribution valuation rules, grant restriction classification
14. Build context package for payroll: payroll run data, employee records, withholding calculations. Tools: `regulationLookup`. Knowledge: Pub 15-T withholding method excerpts, MA Circular M, FICA wage base rules, employer vs employee share rules
15. Implement tool execution: when copilot invokes a tool (e.g., "search transactions", "regulationLookup 26 CFR 1.501(c)(3)-1"), the API route executes the tool against the database or external API and returns results to the AI for incorporation into its response
16. Add copilot panel to the root layout so it's available on every page. Each page passes its context package via React context
17. Implement conversation persistence: store conversation history per user per session. Clear on explicit "New Chat" action
18. Write unit tests: context package assembly for each page, tool execution (including eCFR API client and ProPublica API client), Anthropic API request formation, tax knowledge corpus loading
19. Write E2E test: open copilot on fixed asset page, ask about useful life, verify context-aware response citing IRS publication. Open copilot on transaction entry page, ask about donor acknowledgment requirements, verify response cites IRC § 170(f)(8) threshold

**Deliverable:** AI copilot available on every page with page-specific context, tools, and tax law knowledge. Tax knowledge layer provides authoritative citations from IRC, Treasury Regulations, IRS publications, and MA compliance rules. Three copilot tools (`taxLawSearch`, `regulationLookup`, `nonprofitExplorerLookup`) connect the copilot to primary legal sources and nonprofit benchmarking data. Replaces standalone AI features (depreciation assistant, transaction assistant).

---

## 21. Phase 19: Security Deposits (MA Compliance) & Automated Entries

**Goal:** Build the MA-compliant security deposit system and remaining automated entry types.

**Tasks:**

1. Build security deposit collection workflow (TXN-P0-049): max deposit = first month's rent. GL entry: DR Security Deposit Escrow, CR Security Deposits Held. Must be in separate interest-bearing MA bank account
2. Build receipt tracking (TXN-P0-050): system tracks two required receipt dates (collection receipt, 30-day bank details receipt) and statement of condition date (10 days from tenancy start). Display status on tenant detail page
3. Build security deposit interest automation (TXN-P0-041): annual calculation per tenant on tenancy anniversary. Interest = deposit * rate (lesser of actual bank rate or 5%). GL: DR Interest Expense, CR Cash. Cron job triggers on anniversary date. Compliance calendar integration for 30-day advance warning
4. Build security deposit register (Report #22): per-tenant breakdown reconciling to GL liability + escrow bank balance
5. Build rent accrual cron job refinements: handle move-in mid-month (proration per MA G.L. c. 186 § 4), handle move-out with proration
6. Build remaining compliance calendar items: per-tenant security deposit anniversary tracking, insurance renewal reminders, annual conflict-of-interest attestation reminders, officer compensation review reminders
7. Architecture note for deferred move-out workflow (TXN-P0-051): ensure schema supports future 30-day deadline tracking, itemized deduction recording, and refund calculation without schema changes. Document the extension point
8. Write unit tests: deposit interest calculation (various rates, deposit amounts, partial years), proration formula for different month lengths
9. Write E2E test: collect security deposit for tenant, verify receipt tracking dates, run anniversary interest calculation, verify GL entry and register report

**Deliverable:** MA-compliant security deposit system with automated interest calculation, receipt tracking, and register report. All compliance calendar items active with Postmark reminders.

---

## 22. Phase 20: FY25 Migration & Data Import

**Goal:** Import all FY25 transactions from QBO and generate accrual-basis opening balances.

**Tasks:**

1. Build QBO CSV import script (`src/lib/migration/qbo-import.ts`): parse QBO CSV export format, map QBO account names to seed chart of accounts, map QBO categories to funds. Flag all imported transactions with source_type = FY25_IMPORT (SYS-P0-011)
2. Implement import validation: for each transaction, verify debits = credits (INV-001), verify valid account references, verify valid fund references. Reject invalid rows with descriptive errors. Collect all errors before failing (batch validation)
3. Implement rollback on failure: entire import runs in a single database transaction. Any validation failure rolls back all imported data
4. Build accrual-basis adjustment generator (SYS-P0-012): identify timing differences and generate adjustment entries:
    - Prepaid insurance: $501 (DR Prepaid Expenses, CR Insurance Expense)
    - Accrued reimbursements: $4,472 to Heather (DR Expense account, CR Reimbursements Payable)
    - December rent AR (DR Accounts Receivable, CR Rental Income)
    - Accrued AHP loan interest (calculated from last payment date to period end)
5. Generate conversion summary report: cash-basis ending balances → accrual-basis opening balances. Show each adjustment with explanation. Format for Jeff's review
6. Build import verification queries: total debits = total credits across all imported data, account balances match expected QBO ending balances, fund balances are correct
7. Run import against dev database first, verify, then staging, then production
8. Build initial Plaid history sync: pull up to 24 months of bank transaction history. Start from $0 balance per D-102. Match historical bank transactions against imported GL data
9. Document the import process: steps taken, account mapping table, adjustment rationale. This becomes the conversion audit trail
10. Write unit tests: CSV parsing, account mapping, adjustment calculations
11. This phase is run once — no E2E tests needed, but import script should be idempotent (can re-run after rollback)

**Deliverable:** All FY25 transactions imported from QBO with accrual-basis adjustments. Conversion summary reviewed and approved. Bank history loaded and ready for reconciliation.

---

## 23. Phase 21: Testing, Polish & Performance

**Goal:** Comprehensive testing pass, UI polish, and performance optimization before production deployment.

**Tasks:**

1. Write remaining unit tests to achieve >90% coverage on critical paths: GL engine, payroll calculations, bank reconciliation matcher, depreciation calculations, tax withholding, fund accounting logic, budget variance
2. Write E2E test suite covering the 5 primary user workflows:
    - Monthly accounting cycle: record revenue, process expenses, run payroll, reconcile bank, review reports
    - New vendor/PO/invoice/payment flow
    - Ramp categorization flow
    - Budget creation and variance review
    - CIP conversion wizard
3. Add Playwright accessibility tests: verify WCAG AA compliance on key pages (forms, reports, dashboard). shadcn/ui + Radix should provide baseline, but verify
4. Performance audit:
    - Report query performance: ensure all 29 reports load within 2 seconds for expected data volume (<1000 transactions/month * 12 months = <12,000 rows)
    - Dashboard load time: all 5 sections within 1 second
    - TanStack Table rendering: verify smooth scrolling/sorting for tables with 1000+ rows
    - Plaid/Ramp sync: verify cron jobs complete within Vercel's 60-second function timeout
5. Add loading states and error boundaries to all pages. Skeleton loaders for reports
6. Add form validation error messages: clear, specific, actionable. Every Zod validation error maps to a user-friendly message
7. Review and complete all `<HelpTooltip>` instances across the application. Ensure every non-obvious field has a tooltip
8. Verify breadcrumb trail works correctly on all nested routes. Verify entity name resolution (vendor name instead of ID)
9. Verify mobile responsiveness: not primary use case (Heather uses desktop), but ensure no broken layouts on tablet
10. Review all cron jobs: verify they handle failures gracefully, don't overlap (idempotent), and log results
11. Verify audit log completeness: spot-check that every mutation across all features produces an audit log entry
12. Fix all console errors and TypeScript strict mode warnings
13. Run security review: verify no secrets in client-side code, verify all API routes check authentication, verify encrypted fields are actually encrypted, verify restricted Postgres roles have correct permissions

**Deliverable:** Comprehensive test suite passing. All UI polished with loading states, error handling, help tooltips. Performance verified for expected data volumes. Security review complete.

---

## 24. Phase 22: Deployment & Go-Live

**Goal:** Deploy to production, verify all integrations, and hand off to users.

**Tasks:**

1. Configure production environment variables in Vercel: Neon production DB connection string, Plaid production credentials, Ramp API production key, Postmark API key, Anthropic API key, PEOPLE_ENCRYPTION_KEY, Zitadel OIDC credentials
2. Run database migrations against production Neon DB
3. Run seed scripts against production: chart of accounts, funds, CIP cost codes, compliance deadlines
4. Run FY25 import against production (if not already done in Phase 20)
5. Configure Plaid production access: connect UMass Five checking and savings accounts. Run initial history sync
6. Configure Ramp production API: verify daily sync pulls live transactions
7. Verify Postmark production: send test donor acknowledgment letter, verify formatting with Heather's signature and letterhead
8. Verify Zitadel auth: all three users (Heather, Jeff, Damien) can log in and access all pages
9. Verify cross-Neon-project connectivity: financial-system can read app-portal employee data, renewal-timesheets can INSERT into staging table, expense-reports can INSERT into staging table
10. Configure Vercel cron jobs for production: daily Plaid sync, daily Ramp sync, monthly depreciation (1st), monthly interest accrual (last day), monthly rent accrual (1st), monthly prepaid amortization (1st), daily compliance reminders
11. Run smoke tests in production: create a manual journal entry, record a test donation (verify Postmark sends), run a sync, generate Report #1 (balance sheet), verify dashboard loads
12. Set up error monitoring: Vercel function logs for cron job failures, Postmark delivery tracking for email alerts
13. Create user documentation: brief guide for Heather covering daily workflows (Ramp categorization, payment tracking, bank reconciliation), monthly workflows (payroll, depreciation review), and quarterly workflows (board pack generation, budget review). Keep minimal — the copilot supplements documentation
14. Conduct user walkthrough with Heather: demonstrate the dashboard, transaction entry, Ramp queue, bank rec workspace, and report generation. Collect immediate feedback
15. Set up staging environment as ongoing pre-production test bed: staging branch deploys to Vercel preview with staging DB. Future changes tested here before production

**Deliverable:** Production system live with all integrations verified. Users trained. Staging environment configured for ongoing development. System operational for daily use.

---

## 25. Phase Dependencies

```
Phase 0  (Tech decisions)         ── COMPLETE ──────────────────────────────────
Phase 1  (Scaffolding)            ── depends on: Phase 0
Phase 2  (Schema & Seed)          ── depends on: Phase 1
Phase 3  (GL Engine)              ── depends on: Phase 2
Phase 4  (Accounts & Funds UI)    ── depends on: Phase 3
Phase 5  (Journal Entry & Txn)    ── depends on: Phase 3, Phase 4
Phase 6  (Vendors/Tenants/Donors) ── depends on: Phase 4
Phase 7  (Revenue)                ── depends on: Phase 5, Phase 6
Phase 8  (Expenses & POs)         ── depends on: Phase 5, Phase 6
Phase 9  (Ramp)                   ── depends on: Phase 5
Phase 10 (Payroll)                ── depends on: Phase 5, Phase 6
Phase 11 (Assets & CIP)           ── depends on: Phase 5
Phase 12 (Bank Rec)               ── depends on: Phase 5, Phase 8, Phase 9
Phase 13 (Staging Integration)    ── depends on: Phase 5, Phase 10
Phase 14 (Budgeting)              ── depends on: Phase 4
Phase 15 (Reports Batch 1)        ── depends on: Phase 7, Phase 8, Phase 14
Phase 16 (Reports Batch 2)        ── depends on: Phase 10, Phase 11, Phase 12, Phase 15
Phase 17 (Dashboard & Compliance) ── depends on: Phase 15, Phase 16
Phase 18 (AI Copilot)             ── depends on: Phase 5 (can start earlier, but full context needs all features)
Phase 19 (Security Deposits)      ── depends on: Phase 6, Phase 7
Phase 20 (FY25 Migration)         ── depends on: Phase 3, Phase 12
Phase 21 (Testing & Polish)       ── depends on: all prior phases
Phase 22 (Deployment)             ── depends on: Phase 21
```

**Parallelization opportunities:**
- Phases 7, 8, 9, 10, 11 can proceed in parallel after Phase 5/6 (each is an independent domain)
- Phase 14 (Budgeting) can proceed in parallel with Phases 7-13
- Phase 18 (AI Copilot) can start after Phase 5, with context packages added incrementally as features ship
- Phase 19 (Security Deposits) can proceed in parallel with Phases 15-16
- Phase 20 (FY25 Migration) can begin as soon as Phase 3 and Phase 12 are complete

---

## 26. Risk Areas & Mitigation

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Payroll tax calculation accuracy.** Federal (Pub 15-T) and MA (Circular M) withholding tables change annually. Incorrect calculations have legal consequences. | High | Use official IRS/DOR publications as source of truth. Build comprehensive test suite with known-good calculation examples from publications. Test edge cases (wage base cap, exempt vs non-exempt, multiple withholding allowances). Plan for annual table updates. |
| **Plaid API reliability.** Bank feed sync failures could leave reconciliation incomplete. Plaid rate limits or downtime. | Medium | Retry on next daily poll. Alert via Postmark on failure. Bank transactions persist in Plaid — no data loss. Manual "Sync Now" as fallback. Monitor Plaid status page. |
| **Ramp API integration.** API docs and auth patterns to be determined at build time. Refund handling and edge cases unknown. | Medium | Build with abstraction layer. Start with basic transaction sync, iterate on edge cases. Categorization queue handles any unexpected data gracefully (falls to manual review). |
| **Cross-Neon-project database connectivity.** Integration pattern decided, but Neon-specific mechanics (cross-project connection strings vs co-location) determined at build time. | Medium | Test connectivity early in Phase 2. If cross-project connections don't work cleanly, fall back to co-locating databases in a single Neon project. The application code is identical either way. |
| **macOS dev → Linux production (Vercel).** No containers. Potential for platform-specific behavior differences. | Low | CI runs on Linux (GitHub Actions) to catch issues before production. Node.js and Next.js are fully portable. Playwright tests run on both platforms. Main risk area: native dependencies (unlikely given the pure-JS stack). Flag and investigate any CI-only failures immediately. |
| **FY25 migration data quality.** QBO CSV export may have inconsistencies, unmapped accounts, or missing fund coding. | Medium | Build validation-first: reject invalid rows with descriptive errors. Map accounts manually before running import. Run against dev DB first, review conversion summary, iterate. Keep QBO active as fallback until migration verified. |
| **29 reports at launch.** Large surface area. Risk of report bugs or performance issues discovered late. | Medium | Build reports in two batches (Phases 15-16). Use shared query/formatter infrastructure to reduce per-report effort. Prioritize core financial statements (Reports 1-4) for early user validation. |
| **AI copilot context quality.** Copilot usefulness depends on context package quality and tax knowledge corpus accuracy. Poor context = poor answers. Stale tax law = dangerous answers. | Low | Start with minimal context packages, iterate based on usage. The copilot is additive — the system works without it. Context packages are easy to update (just data/tools/knowledge arrays). Tax knowledge corpus sourced exclusively from primary authorities (IRC, Treasury Regs via eCFR API, IRS publications). Copilot responses always include source citations so users can verify. eCFR API provides point-in-time access to current regulations. Annual review of IRS publication updates (especially Pub 15-T withholding tables, Pub 946 depreciation) when new tax year guidance is released. |
| **Vercel cron job limits.** Multiple scheduled jobs (Plaid, Ramp, depreciation, interest, rent, amortization, compliance). Vercel hobby plan has cron limitations. | Low | Consolidate cron jobs where possible (e.g., single daily job handles Plaid + Ramp + compliance checks). Verify plan limits early. Upgrade Vercel plan if needed — cost is minimal for this scale. |
| **AHP interest capitalization mode switch.** Automatic switch from CIP capitalization to expense when last structure placed in service. Edge case: what if a conversion is reversed? | Low | CIP conversions are audited and reviewed — reversals are extremely unlikely. If needed, manual JE corrects. Document the mode-switch logic clearly for future maintainers. |

---

## 27. Success Criteria

The project is complete when all of the following are true:

**Core Functionality**
- [ ] GL engine enforces all 15 system invariants (INV-001 through INV-015)
- [ ] Manual journal entries with multi-fund splits working
- [ ] All revenue types recordable (rent, grants, donations, earned income, pledges, in-kind, AHP forgiveness)
- [ ] Expense processing operational (PO system, vendor invoices, Ramp, reimbursements)
- [ ] Payroll engine calculates correct federal, MA, and FICA withholdings
- [ ] Monthly depreciation runs automatically for all active fixed assets
- [ ] CIP-to-fixed-asset conversion wizard produces correct reclassification JEs
- [ ] AHP interest accrual switches modes correctly (construction vs post-construction)
- [ ] Prepaid expense amortization runs automatically

**Bank Reconciliation**
- [ ] Daily Plaid sync pulls transactions for all connected bank accounts
- [ ] Trust-escalation matching suggests correct matches
- [ ] Auto-matching rules work for recurring patterns
- [ ] Two-way reconciliation (bank-to-GL and GL-to-bank) completes
- [ ] Formal sign-off records reconciler and timestamp
- [ ] Ramp settlement cross-check verifies categorized totals

**Integrations**
- [ ] Staging table accepts INSERTs from renewal-timesheets and expense-reports-homegrown
- [ ] Staging processor converts records to GL entries
- [ ] Ramp daily sync and categorization queue functional
- [ ] Employee data readable from app-portal DB
- [ ] Postmark sends donor acknowledgment letters and compliance reminders

**Reporting & Dashboard**
- [ ] All 29 reports generate correctly with PDF and CSV export
- [ ] Dashboard home screen shows all 5 sections with live data
- [ ] Fund drill-down works on all fund-aware reports
- [ ] Budget variance color coding displays correctly
- [ ] Board pack PDF generation produces printer-ready output

**Compliance**
- [ ] Compliance calendar tracks all deadlines with 30-day and 7-day reminders
- [ ] Security deposit tracking complies with MA G.L. c. 186 requirements
- [ ] Functional allocation wizard produces correct Program/Admin/Fundraising splits
- [ ] W-2 and 1099-NEC PDF forms generate with correct data
- [ ] 990 functional expense format matches IRS Part IX line items

**AI & UX**
- [ ] AI copilot available on every page with relevant context
- [ ] Tax law knowledge layer loaded with curated corpus (~50-100 docs from IRC, Treasury Regs, IRS Pubs, MA compliance)
- [ ] `taxLawSearch`, `regulationLookup`, and `nonprofitExplorerLookup` copilot tools functional and returning cited results
- [ ] eCFR API client fetches current Treasury Regulations on demand
- [ ] Copilot responses on tax questions cite primary sources (IRC sections, CFR sections, IRS publication references)
- [ ] Help tooltips include authoritative IRC/ASC references where applicable
- [ ] Breadcrumbs display correctly on all nested routes
- [ ] User menu with App Portal link and Sign Out working
- [ ] Audit log captures every mutation across all features

**Data & Migration**
- [ ] All FY25 transactions imported from QBO with accrual adjustments
- [ ] Opening balances verified against QBO
- [ ] Bank history loaded from Plaid (up to 24 months)

**Infrastructure**
- [ ] Three environments operational (local, staging, production)
- [ ] CI pipeline passing (lint, type-check, unit tests, E2E tests on Linux)
- [ ] All cron jobs running on schedule in production
- [ ] Secrets stored in Vercel environment variables, never in code
- [ ] Restricted Postgres roles configured and tested

**User Acceptance**
- [ ] Heather can complete a full monthly accounting cycle independently
- [ ] Jeff can administer the system (settings, migration, debugging)
- [ ] Damien can access reports and audit log for treasurer review
