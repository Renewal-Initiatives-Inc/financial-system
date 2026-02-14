# Phase 2 Execution Plan: Core Database Schema & Seed Data

**Goal:** Define the complete core database schema in Drizzle and seed the chart of accounts, funds, and CIP cost codes.

**Depends on:** Phase 1 (verified complete — app shell, auth, DB client, Drizzle config, test infra all in place)

**Deliverable:** Complete core schema deployed to dev DB with all seed accounts, funds, and cost codes. Zod validation schemas in place. All seed data matches requirements.md Section 9.

---

## Pre-flight Checks

Before starting, verify Phase 1 foundations:

- [ ] `npm run dev` starts without errors
- [ ] `drizzle.config.ts` points to `./src/lib/db/schema/index.ts`
- [ ] `DATABASE_URL` is set in `.env.local` for the dev Neon DB
- [ ] `npm run db:push` runs (even if no-op with empty schema)
- [ ] `npm run test:run` passes (existing utils + breadcrumbs tests)

---

## Task Breakdown

### Step 1: Define Drizzle Enums

**File:** `src/lib/db/schema/enums.ts`

Define all pgEnum types used across the schema. Centralizing enums prevents circular imports and keeps the schema modular.

```
accountType:        'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE'
normalBalance:      'DEBIT' | 'CREDIT'
fundRestriction:    'RESTRICTED' | 'UNRESTRICTED'
sourceType:         'MANUAL' | 'TIMESHEET' | 'EXPENSE_REPORT' | 'RAMP' | 'BANK_FEED' | 'SYSTEM' | 'FY25_IMPORT'
cipCostCategory:    'HARD_COST' | 'SOFT_COST'
auditAction:        'created' | 'updated' | 'voided' | 'reversed' | 'deactivated' | 'signed_off' | 'imported' | 'posted'
```

**Naming convention:** Drizzle pgEnum names use snake_case for the Postgres enum type name, SCREAMING_SNAKE for values per naming_conventions.md.

**Acceptance criteria:**
- All enums from implementation_plan.md Phase 2 tasks 1-6 are defined
- Enums are exported for use in schema table definitions and Zod schemas

---

### Step 2: Define `accounts` Table

**File:** `src/lib/db/schema/accounts.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | Auto-increment |
| code | varchar(20) | UNIQUE, NOT NULL | e.g., "1000", "1100" |
| name | varchar(255) | NOT NULL | e.g., "Checking", "Accounts Receivable" |
| type | accountType enum | NOT NULL | ASSET, LIABILITY, NET_ASSET, REVENUE, EXPENSE |
| sub_type | varchar(50) | nullable | e.g., "Cash", "Current Asset", "Fixed Asset", "Payroll" |
| normal_balance | normalBalance enum | NOT NULL | DEBIT or CREDIT |
| is_active | boolean | NOT NULL, default true | Soft-delete via deactivation |
| form_990_line | varchar(10) | nullable | IRS 990 Part IX line item mapping |
| parent_account_id | integer | nullable, self-ref FK | For account hierarchy (CIP parent → children) |
| is_system_locked | boolean | NOT NULL, default false | System-locked accounts can't be deactivated or renamed |
| created_at | timestamp | NOT NULL, default now() | System timestamp |
| updated_at | timestamp | NOT NULL, default now() | System timestamp |

**Design decisions:**
- Self-referential FK for `parent_account_id` enables the CIP parent → 5 sub-accounts hierarchy and Building → component hierarchy
- `form_990_line` is nullable because not all accounts map to 990 lines
- `is_system_locked` prevents modification of seed accounts that the system depends on
- `code` is unique to prevent duplicate account codes

**Requirements satisfied:** DM-P0-001, DM-P0-002, DM-P0-003, DM-P0-004

---

### Step 3: Define `funds` Table

**File:** `src/lib/db/schema/funds.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | Auto-increment |
| name | varchar(255) | NOT NULL, UNIQUE | e.g., "General Fund", "AHP Fund" |
| restriction_type | fundRestriction enum | NOT NULL | RESTRICTED or UNRESTRICTED — immutable after creation (INV-005) |
| is_active | boolean | NOT NULL, default true | Cannot deactivate if balance non-zero (DM-P0-007) |
| description | text | nullable | Optional description |
| is_system_locked | boolean | NOT NULL, default false | General Fund is locked |
| created_at | timestamp | NOT NULL, default now() | |
| updated_at | timestamp | NOT NULL, default now() | |

**Requirements satisfied:** DM-P0-005, DM-P0-006, DM-P0-007, DM-P0-008, DM-P0-009, INV-005

---

### Step 4: Define `transactions` Table

**File:** `src/lib/db/schema/transactions.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | Auto-increment |
| date | date | NOT NULL | Business date of the transaction |
| memo | text | NOT NULL | Description of the entry |
| source_type | sourceType enum | NOT NULL | Immutable provenance (INV-011) |
| source_reference_id | varchar(255) | nullable | External reference (e.g., Ramp ID, timesheet ID) |
| is_system_generated | boolean | NOT NULL, default false | INV-008: true for depreciation, interest, net asset releases |
| is_voided | boolean | NOT NULL, default false | Excluded from GL totals when true |
| reversal_of_id | integer | nullable, FK → transactions | Points to the original entry this reverses |
| reversed_by_id | integer | nullable, FK → transactions | Points to the reversing entry |
| created_by | varchar(255) | NOT NULL | User ID from auth session |
| created_at | timestamp | NOT NULL, default now() | |

**Design decisions:**
- No `updated_at` on transactions — they are append-only (corrections via reversal, not modification). Edit-in-place for unmatched transactions is handled at the application layer with audit logging.
- `reversal_of_id` and `reversed_by_id` form a bidirectional link per design.md Section 2.1.
- `source_type` + `source_reference_id` are set at creation and immutable (INV-011).

**Requirements satisfied:** INV-006, INV-008, INV-011, INV-014

---

### Step 5: Define `transaction_lines` Table

**File:** `src/lib/db/schema/transaction-lines.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| transaction_id | integer | NOT NULL, FK → transactions, CASCADE delete | |
| account_id | integer | NOT NULL, FK → accounts | Must reference active account (INV-002, INV-004) |
| fund_id | integer | NOT NULL, FK → funds | Every line has a fund (INV-003) |
| cip_cost_code_id | integer | nullable, FK → cip_cost_codes | Only when account is CIP sub-account |
| debit | numeric(15,2) | nullable | Exactly one of debit/credit must be non-null and positive |
| credit | numeric(15,2) | nullable | |
| memo | text | nullable | Optional line-level memo |

**CHECK constraint:** Enforce at DB level that exactly one of debit/credit is non-null and positive:
```sql
CHECK (
  (debit IS NOT NULL AND debit > 0 AND credit IS NULL) OR
  (credit IS NOT NULL AND credit > 0 AND debit IS NULL)
)
```

**Design decisions:**
- `numeric(15,2)` gives 13 digits before decimal, 2 after — sufficient for any amount up to $9,999,999,999,999.99
- Fund lives on the line, not the header (D-051: multi-fund splits)
- CIP cost code is a metadata tag, not an account — only populated for CIP sub-account lines

**Requirements satisfied:** INV-001 (via GL engine validation), INV-002, INV-003, INV-004, DM-P0-010, DM-P0-027, DM-P0-028

---

### Step 6: Define `cip_cost_codes` Table

**File:** `src/lib/db/schema/cip-cost-codes.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| code | varchar(10) | NOT NULL, UNIQUE | CSI division number or soft cost code |
| name | varchar(255) | NOT NULL | Human-readable name |
| category | cipCostCategory enum | NOT NULL | HARD_COST or SOFT_COST |
| is_active | boolean | NOT NULL, default true | |
| sort_order | integer | NOT NULL, default 0 | For display ordering |
| created_at | timestamp | NOT NULL, default now() | |

**Requirements satisfied:** DM-P0-027

---

### Step 7: Define `audit_log` Table

**File:** `src/lib/db/schema/audit-log.ts`

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | serial | PK | |
| timestamp | timestamp | NOT NULL, default now() | When the action occurred |
| user_id | varchar(255) | NOT NULL | Who performed the action |
| action | auditAction enum | NOT NULL | What happened |
| entity_type | varchar(50) | NOT NULL | e.g., "transaction", "account", "fund" |
| entity_id | integer | NOT NULL | ID of the affected entity |
| before_state | jsonb | nullable | Previous state (null for creates) |
| after_state | jsonb | NOT NULL | New state after the action |
| metadata | jsonb | nullable | Additional context (e.g., reason for void) |

**Design decisions:**
- Append-only: no UPDATE or DELETE operations in application code (INV-012)
- `before_state` is nullable for creation events
- `jsonb` for flexibility — different entity types have different shapes
- No FK constraints on entity_id — audit log references any entity type

**Requirements satisfied:** INV-012, SYS-P0-005

---

### Step 8: Schema Index File

**File:** `src/lib/db/schema/index.ts` (replace existing placeholder)

Re-export all tables, enums, and relations from individual files:

```typescript
export * from './enums'
export * from './accounts'
export * from './funds'
export * from './transactions'
export * from './transaction-lines'
export * from './cip-cost-codes'
export * from './audit-log'
```

Define Drizzle `relations()` for:
- `accounts` → self-referential (parent/children)
- `transactions` → `transaction_lines` (one-to-many)
- `transactions` → self-referential (reversal chain)
- `transaction_lines` → `accounts`, `funds`, `cip_cost_codes`
- No relations on `audit_log` (intentionally decoupled)

---

### Step 9: Generate & Push Schema to Dev DB

**Commands:**
```bash
npm run db:generate   # Generate SQL migration files
npm run db:push       # Push schema to dev Neon DB
```

**Verification:**
- All 6 tables created in Neon dev DB
- CHECK constraint on transaction_lines enforced
- FK constraints working (self-ref on accounts, transactions)
- Indexes on frequently queried columns created

**Additional indexes to create:**
- `accounts.code` — unique (already via column constraint)
- `accounts.parent_account_id` — for hierarchy queries
- `transactions.date` — for date-range queries
- `transactions.source_type` — for filtering by source
- `transaction_lines.transaction_id` — for joining lines to header
- `transaction_lines.account_id` — for account balance queries
- `transaction_lines.fund_id` — for fund balance queries
- `audit_log.entity_type, entity_id` — for entity-specific audit queries
- `audit_log.timestamp` — for date-range filtering

---

### Step 10: Zod Validation Schemas

**File:** `src/lib/validators/index.ts`

Export sub-modules:

**File:** `src/lib/validators/accounts.ts`
- `insertAccountSchema` — for creating new accounts (code, name, type, sub_type, normalBalance, form990Line, parentAccountId, isSystemLocked)
- `updateAccountSchema` — partial of insertAccountSchema (only mutable fields: name, isActive, sub_type)

**File:** `src/lib/validators/funds.ts`
- `insertFundSchema` — for creating new funds (name, restrictionType, description, isSystemLocked)
- `updateFundSchema` — partial (only mutable fields: name, isActive, description)

**File:** `src/lib/validators/transactions.ts`
- `transactionLineSchema` — single line validation (accountId, fundId, debit?, credit?, cipCostCodeId?, memo?)
  - Custom refinement: exactly one of debit/credit must be provided and > 0
- `insertTransactionSchema` — full transaction (date, memo, sourceType, sourceReferenceId?, isSystemGenerated?, lines[])
  - Custom refinement: sum(debits) must equal sum(credits) (INV-001)
  - Minimum 2 lines
- `editTransactionSchema` — for editing unmatched transactions (date?, memo?, lines[]?)

**File:** `src/lib/validators/cip-cost-codes.ts`
- `insertCipCostCodeSchema` — (code, name, category, sortOrder?)
- `updateCipCostCodeSchema` — partial

**File:** `src/lib/validators/audit-log.ts`
- `insertAuditLogSchema` — (userId, action, entityType, entityId, beforeState?, afterState, metadata?)

**Zod v4 notes:** This project uses Zod 4.3.6. Use `z.object()`, `z.enum()`, `z.refine()` per Zod v4 API. Zod v4 moved to `z.string().check()` for custom validations but `z.refine()` still works.

**Naming convention:** Schema names use camelCase + `Schema` suffix per naming_conventions.md.

---

### Step 11: Seed Script — Chart of Accounts

**File:** `src/lib/db/seed/accounts.ts`

Seed all accounts from requirements.md Section 9.1. Here is the complete account list organized by type:

**Assets (22 accounts):**

| Code | Name | Sub-Type | Normal | Locked | 990 Line | Parent |
|------|------|----------|--------|--------|----------|--------|
| 1000 | Checking | Cash | DEBIT | No | — | — |
| 1010 | Savings | Cash | DEBIT | No | — | — |
| 1020 | Security Deposit Escrow | Cash | DEBIT | Yes | — | — |
| 1030 | Restricted Cash - Operating Reserve | Cash | DEBIT | Yes | — | — |
| 1040 | Restricted Cash - Replacement Reserve | Cash | DEBIT | Yes | — | — |
| 1050 | Restricted Cash - Transition Reserve | Cash | DEBIT | Yes | — | — |
| 1100 | Accounts Receivable | Current Asset | DEBIT | Yes | — | — |
| 1110 | Grants Receivable | Current Asset | DEBIT | Yes | — | — |
| 1120 | Pledges Receivable | Current Asset | DEBIT | No | — | — |
| 1200 | Prepaid Expenses | Current Asset | DEBIT | Yes | — | — |
| 1500 | Construction in Progress | Fixed Asset | DEBIT | Yes | — | — |
| 1510 | CIP - Hard Costs | Fixed Asset | DEBIT | Yes | — | 1500 |
| 1520 | CIP - Soft Costs | Fixed Asset | DEBIT | Yes | — | 1500 |
| 1530 | CIP - Reserves & Contingency | Fixed Asset | DEBIT | Yes | — | 1500 |
| 1540 | CIP - Developer Fee | Fixed Asset | DEBIT | Yes | — | 1500 |
| 1550 | CIP - Construction Interest | Fixed Asset | DEBIT | Yes | — | 1500 |
| 1600 | Building - Lodging | Fixed Asset | DEBIT | Yes | — | — |
| 1610 | Building - Barn | Fixed Asset | DEBIT | Yes | — | — |
| 1620 | Building - Garage | Fixed Asset | DEBIT | Yes | — | — |
| 1700 | Equipment | Fixed Asset | DEBIT | No | — | — |
| 1800 | Accum. Depreciation - Lodging | Contra-Asset | CREDIT | Yes | — | — |
| 1810 | Accum. Depreciation - Barn | Contra-Asset | CREDIT | Yes | — | — |
| 1820 | Accum. Depreciation - Garage | Contra-Asset | CREDIT | Yes | — | — |
| 1830 | Accum. Depreciation - Equipment | Contra-Asset | CREDIT | No | — | — |

**Liabilities (16 accounts):**

| Code | Name | Sub-Type | Normal | Locked | 990 Line |
|------|------|----------|--------|--------|----------|
| 2000 | Accounts Payable | Current | CREDIT | Yes | — |
| 2010 | Reimbursements Payable | Current | CREDIT | Yes | — |
| 2020 | Credit Card Payable | Current | CREDIT | Yes | — |
| 2030 | Accrued Expenses Payable | Current | CREDIT | Yes | — |
| 2040 | Deferred Revenue | Current | CREDIT | Yes | — |
| 2050 | Refundable Advance | Current | CREDIT | Yes | — |
| 2060 | Security Deposits Held | Current | CREDIT | Yes | — |
| 2100 | Accrued Payroll Payable | Payroll | CREDIT | Yes | — |
| 2110 | Federal Income Tax Payable | Payroll | CREDIT | Yes | — |
| 2120 | State Income Tax Payable | Payroll | CREDIT | Yes | — |
| 2130 | Social Security Payable | Payroll | CREDIT | Yes | — |
| 2140 | Medicare Payable | Payroll | CREDIT | Yes | — |
| 2150 | Workers Comp Payable | Payroll | CREDIT | No | — |
| 2160 | 401(k) Withholding Payable | Payroll | CREDIT | No | — |
| 2500 | AHP Loan Payable | Long-Term | CREDIT | Yes | — |
| 2510 | Deferred Developer Fee Payable | Long-Term | CREDIT | Yes | — |
| 2520 | Accrued Interest Payable | Current | CREDIT | Yes | — |

**Net Assets (2 accounts):**

| Code | Name | Sub-Type | Normal | Locked |
|------|------|----------|--------|--------|
| 3000 | Net Assets Without Donor Restrictions | Unrestricted | CREDIT | Yes |
| 3100 | Net Assets With Donor Restrictions | Restricted | CREDIT | Yes |

**Revenue (12 accounts):**

| Code | Name | Sub-Type | Normal | Locked | 990 Line |
|------|------|----------|--------|--------|----------|
| 4000 | Rental Income | Operating | CREDIT | Yes | 2 |
| 4010 | Rental Income - Proration Adj. | Contra | DEBIT | No | — |
| 4020 | Rental Income - Hardship Adj. | Contra | DEBIT | No | — |
| 4030 | Rental Income - Vacate Adj. | Contra | DEBIT | No | — |
| 4040 | Vacancy Loss | Contra-Revenue | DEBIT | No | — |
| 4100 | Grant Revenue | Restricted | CREDIT | Yes | 1e |
| 4200 | Donation Income | Contribution | CREDIT | Yes | 1a |
| 4300 | Earned Income | Operating | CREDIT | No | 2 |
| 4400 | Investment Income | Operating | CREDIT | No | 3 |
| 4500 | In-Kind Goods | Contribution | CREDIT | No | 1g |
| 4510 | In-Kind Services | Contribution | CREDIT | No | 1g |
| 4520 | In-Kind Facility Use | Contribution | CREDIT | No | 1g |

**Expenses (17 accounts):**

| Code | Name | Sub-Type | Normal | Locked | 990 Line |
|------|------|----------|--------|--------|----------|
| 5000 | Salaries & Wages | Payroll | DEBIT | Yes | 5 |
| 5100 | Interest Expense | Financial | DEBIT | Yes | 15 |
| 5200 | Depreciation Expense | Non-Cash | DEBIT | Yes | 22 |
| 5300 | Bad Debt Expense | Operating | DEBIT | No | 24a |
| 5400 | Property Taxes | Property Ops | DEBIT | No | 24a |
| 5410 | Property Insurance | Property Ops | DEBIT | No | 24a |
| 5420 | Management Fees | Property Ops | DEBIT | No | 11g |
| 5430 | Commissions | Property Ops | DEBIT | No | 24a |
| 5440 | Landscaping & Grounds | Property Ops | DEBIT | No | 24a |
| 5450 | Repairs & Maintenance | Property Ops | DEBIT | No | 24a |
| 5500 | Utilities - Electric | Property Ops | DEBIT | No | 24a |
| 5510 | Utilities - Gas | Property Ops | DEBIT | No | 24a |
| 5520 | Utilities - Water/Sewer | Property Ops | DEBIT | No | 24a |
| 5530 | Utilities - Internet | Property Ops | DEBIT | No | 24a |
| 5540 | Utilities - Security & Fire Monitoring | Property Ops | DEBIT | No | 24a |
| 5550 | Utilities - Trash | Property Ops | DEBIT | No | 24a |
| 5600 | Other Operating Costs | Property Ops | DEBIT | No | 24a |

**Total: 69 seed accounts** (24 assets + 17 liabilities + 2 net assets + 12 revenue + 17 expenses) — the plan says "44+" but requirements.md Section 9 actually lists ~69.

**Implementation note:** Seed must run in two passes — first insert accounts without parent references, then update CIP sub-accounts with `parent_account_id` pointing to the CIP parent (code 1500).

---

### Step 12: Seed Script — Funds

**File:** `src/lib/db/seed/funds.ts`

| Name | Restriction | Locked |
|------|------------|--------|
| General Fund | UNRESTRICTED | Yes |
| AHP Fund | RESTRICTED | No |
| CPA Fund | RESTRICTED | No |
| MassDev Fund | RESTRICTED | No |
| HTC Equity Fund | RESTRICTED | No |
| MassSave Fund | RESTRICTED | No |

**6 seed funds** per requirements.md Section 9.2.

---

### Step 13: Seed Script — CIP Cost Codes

**File:** `src/lib/db/seed/cip-cost-codes.ts`

**Hard Cost codes (CSI divisions):**

| Code | Name | Category | Sort |
|------|------|----------|------|
| 03 | Concrete | HARD_COST | 10 |
| 07 | Thermal & Moisture Protection | HARD_COST | 20 |
| 08 | Openings | HARD_COST | 30 |
| 09 | Finishes | HARD_COST | 40 |
| 22 | Plumbing | HARD_COST | 50 |
| 23 | HVAC | HARD_COST | 60 |
| 26 | Electrical | HARD_COST | 70 |
| 31 | Earthwork | HARD_COST | 80 |

**Soft Cost codes:**

| Code | Name | Category | Sort |
|------|------|----------|------|
| S01 | Architectural & Engineering | SOFT_COST | 100 |
| S02 | Legal | SOFT_COST | 110 |
| S03 | Permitting | SOFT_COST | 120 |
| S04 | Inspection | SOFT_COST | 130 |
| S05 | Environmental | SOFT_COST | 140 |
| S06 | Appraisal | SOFT_COST | 150 |
| S07 | Insurance (Builder's Risk) | SOFT_COST | 160 |
| S08 | Accounting & Audit | SOFT_COST | 170 |
| S09 | Project Management | SOFT_COST | 180 |

**17 seed cost codes** (8 hard + 9 soft).

---

### Step 14: Seed Runner Script

**File:** `src/lib/db/seed/index.ts`

Orchestrates all seed scripts in order:
1. Seed accounts (pass 1: insert all, pass 2: set parent_account_id for CIP children)
2. Seed funds
3. Seed CIP cost codes

Features:
- Idempotent: uses `onConflictDoNothing()` or checks for existing records
- Logs progress to console (e.g., "Seeded 69 accounts", "Seeded 6 funds", "Seeded 17 cost codes")
- Runs inside a database transaction — all-or-nothing
- Can be re-run safely

**Package.json script:**
```json
"db:seed": "npx tsx src/lib/db/seed/index.ts"
```

---

### Step 15: Unit Tests

**File:** `src/lib/db/schema/schema.test.ts`

Test the schema definitions and seed data:

1. **Seed data integrity tests:**
   - All 69 seed accounts have valid type/normalBalance combinations (Assets → DEBIT, Liabilities → CREDIT, etc.)
   - All CIP sub-accounts (1510-1550) have parent_account_id pointing to CIP parent (1500)
   - All 6 seed funds have correct restriction types
   - General Fund is system-locked
   - All 17 cost codes have valid categories

2. **Account hierarchy tests:**
   - CIP parent (1500) has exactly 5 children
   - CIP parent is non-postable (is_system_locked = true)
   - Building accounts (1600, 1610, 1620) have corresponding accum. depreciation accounts

3. **Account code uniqueness:**
   - No duplicate codes in seed data

4. **Balance type consistency:**
   - All Asset accounts have normalBalance = DEBIT
   - All Liability accounts have normalBalance = CREDIT
   - All Net Asset accounts have normalBalance = CREDIT
   - All Revenue accounts have normalBalance = CREDIT (except contra-revenue which are DEBIT)
   - All Expense accounts have normalBalance = DEBIT

**File:** `src/lib/validators/validators.test.ts`

Test Zod validation schemas:

1. **Transaction line validation:**
   - Valid line with debit only → passes
   - Valid line with credit only → passes
   - Line with both debit and credit → fails
   - Line with neither debit nor credit → fails
   - Line with zero amount → fails
   - Line with negative amount → fails

2. **Transaction validation:**
   - Balanced entry (debits = credits) → passes
   - Unbalanced entry → fails with descriptive error
   - Entry with fewer than 2 lines → fails
   - Valid multi-fund entry → passes

3. **Account validation:**
   - Valid account insert → passes
   - Account with empty code → fails
   - Account with empty name → fails

4. **Fund validation:**
   - Valid fund insert → passes
   - Fund with invalid restriction type → fails

**File:** `src/lib/db/seed/seed.test.ts`

Test that seed data can be validated through Zod schemas:
- Each seed account passes `insertAccountSchema`
- Each seed fund passes `insertFundSchema`
- Each seed cost code passes `insertCipCostCodeSchema`

---

### Step 16: Database Integration Test

**File:** `src/lib/db/seed/seed.integration.test.ts`

If DATABASE_URL is available, run integration tests:

1. Seed data loads without errors
2. Account hierarchy query returns correct parent/child relationships
3. CHECK constraint on transaction_lines works:
   - Insert with valid debit-only → succeeds
   - Insert with both debit and credit → fails
   - Insert with neither → fails
4. FK constraints work:
   - transaction_line with invalid account_id → fails
   - transaction_line with invalid fund_id → fails
5. Unique constraints work:
   - Duplicate account code → fails
   - Duplicate fund name → fails

**Note:** Integration tests should be skippable when no DATABASE_URL is set (CI without DB access). Use `describe.skipIf(!process.env.DATABASE_URL)`.

---

## Files Created/Modified Summary

### New Files (14)

| File | Purpose |
|------|---------|
| `src/lib/db/schema/enums.ts` | Postgres enum definitions |
| `src/lib/db/schema/accounts.ts` | Accounts table definition |
| `src/lib/db/schema/funds.ts` | Funds table definition |
| `src/lib/db/schema/transactions.ts` | Transactions table definition |
| `src/lib/db/schema/transaction-lines.ts` | Transaction lines table definition |
| `src/lib/db/schema/cip-cost-codes.ts` | CIP cost codes table definition |
| `src/lib/db/schema/audit-log.ts` | Audit log table definition |
| `src/lib/db/schema/schema.test.ts` | Schema + seed data integrity tests |
| `src/lib/db/seed/accounts.ts` | Account seed data |
| `src/lib/db/seed/funds.ts` | Fund seed data |
| `src/lib/db/seed/cip-cost-codes.ts` | CIP cost code seed data |
| `src/lib/db/seed/index.ts` | Seed runner orchestrator |
| `src/lib/db/seed/seed.test.ts` | Seed Zod validation tests |
| `src/lib/validators/index.ts` | Zod schema exports |

Plus 5 validator files:
| `src/lib/validators/accounts.ts` | Account Zod schemas |
| `src/lib/validators/funds.ts` | Fund Zod schemas |
| `src/lib/validators/transactions.ts` | Transaction Zod schemas |
| `src/lib/validators/cip-cost-codes.ts` | CIP cost code Zod schemas |
| `src/lib/validators/audit-log.ts` | Audit log Zod schema |

Plus 1 test file:
| `src/lib/validators/validators.test.ts` | Zod schema validation tests |

### Modified Files (2)

| File | Change |
|------|--------|
| `src/lib/db/schema/index.ts` | Replace placeholder with re-exports + relations |
| `package.json` | Add `db:seed` script |

---

## Execution Order

1. **Step 1:** Enums → no dependencies
2. **Steps 2-7:** Table definitions → depend on enums, can be done in parallel
3. **Step 8:** Schema index → depends on all table definitions
4. **Step 9:** Generate + push → depends on schema index
5. **Step 10:** Zod validators → depends on enums (for enum values) but not on DB
6. **Steps 11-13:** Seed data files → depend on Zod validators (validate seed data shape)
7. **Step 14:** Seed runner → depends on seed data files + DB schema
8. **Steps 15-16:** Tests → depend on everything above

Recommended build sequence:
```
Enums → Tables (parallel) → Index + Relations → DB Push
                                                    ↓
Zod Validators ─────────────────────────────→ Seed Scripts → Seed Runner
                                                    ↓
                                              Unit Tests → Integration Tests
```

---

## Acceptance Criteria

### From implementation_plan.md Phase 2:
- [ ] All 6 core tables created in dev Neon DB
- [ ] CHECK constraint enforces exactly one of debit/credit per transaction line
- [ ] FK constraints working (accounts, funds, transactions)
- [ ] Self-referential FK on accounts for hierarchy
- [ ] Self-referential FK on transactions for reversal chain
- [ ] 69 seed accounts loaded matching requirements.md Section 9.1
- [ ] 6 seed funds loaded matching requirements.md Section 9.2
- [ ] 17 seed CIP cost codes loaded (8 CSI hard + 9 soft)
- [ ] Zod schemas validate all table inputs
- [ ] `npm run db:seed` command works
- [ ] All unit tests pass

### From requirements.md:
- [ ] DM-P0-001: Five account types defined
- [ ] DM-P0-002: Account fields include code, name, type, sub-type, normal balance, form_990_line, parent_id
- [ ] DM-P0-003: System-locked flag prevents modification of critical accounts
- [ ] DM-P0-004: Seed chart of accounts bootstrapped
- [ ] DM-P0-005: Fund fields include name, restriction type, active flag, description
- [ ] DM-P0-006: Restriction type set at creation
- [ ] DM-P0-009: General Fund is system-locked and unrestricted
- [ ] DM-P0-026: CIP tracked via 5 sub-accounts under locked parent
- [ ] DM-P0-027: CIP cost codes defined as reference data
- [ ] INV-005: Fund restriction type is immutable (enforced at Zod level, further enforced in Phase 3 GL engine)
- [ ] INV-012: Audit log table ready for append-only writes

### Test coverage targets:
- [ ] Schema integrity tests: verify all seed data relationships
- [ ] Zod validation tests: verify all validation rules (balance check, required fields, enum constraints)
- [ ] Seed script tests: verify seed data passes validators
- [ ] Integration tests (when DB available): verify DB constraints work

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Drizzle CHECK constraint syntax | Test with `db:push` early. If Drizzle's `.check()` method doesn't work cleanly, fall back to raw SQL migration for the constraint. |
| Zod v4 API differences | Zod 4.3.6 is installed. Verify `z.refine()` and `z.enum()` work as expected. If v4 has breaking changes, the validator tests will catch them immediately. |
| Seed script idempotency | Use `onConflictDoNothing()` on unique columns. Test re-running seed multiple times. |
| Account code numbering | The code assignments (1000, 1010, etc.) are a reasonable convention. If Jeff wants different codes, they're easy to change in the seed file before any transactions reference them. |
| Large seed data accuracy | Every seed account is cross-referenced against requirements.md Section 9.1. The schema.test.ts validates completeness. |
