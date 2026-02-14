# Staging Table Integration Guide

This guide documents how `renewal-timesheets` and `expense-reports-homegrown` write approved records into the financial system's staging table, and how the staging processor converts them into GL entries.

---

## Architecture

```
renewal-timesheets ──INSERT──┐
                              ├──► staging_records ──► staging processor ──► GL entries
expense-reports    ──INSERT──┘
```

Each source app gets a restricted Postgres role with INSERT + SELECT on `staging_records` and SELECT on reference tables (`accounts`, `funds`, `vendors`). No UPDATE or DELETE.

---

## 1. Neon Role Creation SQL

Run in Neon console for each environment (dev, staging, production):

```sql
-- Create restricted roles for source apps
CREATE ROLE timesheets_role LOGIN PASSWORD 'CHANGE_ME_timesheets';
CREATE ROLE expense_reports_role LOGIN PASSWORD 'CHANGE_ME_expense_reports';

-- Grant SELECT on reference tables (for fund/account lookups)
GRANT SELECT ON accounts, funds, vendors TO timesheets_role, expense_reports_role;

-- Grant INSERT + SELECT on staging_records (no UPDATE, no DELETE)
GRANT INSERT, SELECT ON staging_records TO timesheets_role, expense_reports_role;

-- Grant USAGE on sequences (needed for INSERT with serial PK)
GRANT USAGE ON SEQUENCE staging_records_id_seq TO timesheets_role, expense_reports_role;
```

---

## 2. Connection String Format

```
postgresql://timesheets_role:PASSWORD@NEON_HOST/financial_system?sslmode=require
postgresql://expense_reports_role:PASSWORD@NEON_HOST/financial_system?sslmode=require
```

Store as environment variables in each source app.

---

## 3. Staging Table Schema

| Column | Type | Nullable | Notes |
|--------|------|----------|-------|
| `id` | serial | PK | Auto-generated |
| `source_app` | varchar(50) | NOT NULL | `'timesheets'` or `'expense_reports'` |
| `source_record_id` | varchar(255) | NOT NULL | Unique per source_app |
| `record_type` | varchar(50) | NOT NULL | `'timesheet_fund_summary'` or `'expense_line_item'` |
| `employee_id` | varchar(255) | NOT NULL | Employee identifier from source app |
| `reference_id` | varchar(255) | NOT NULL | Source document reference (e.g., `ER-2024-001`) |
| `date_incurred` | date | NOT NULL | Date the expense/work occurred |
| `amount` | numeric(12,2) | NOT NULL | Dollar amount |
| `fund_id` | integer | NOT NULL | FK to `funds.id` |
| `gl_account_id` | integer | NULL | FK to `accounts.id` (required for expense reports, null for timesheets) |
| `metadata` | jsonb | NOT NULL | Structural data (see below) |
| `status` | varchar(20) | NOT NULL | Default: `'received'` |
| `gl_transaction_id` | integer | NULL | Set by processor after GL entry creation |
| `created_at` | timestamp | NOT NULL | Auto-set |
| `processed_at` | timestamp | NULL | Set by processor |

**Constraints:**
- UNIQUE on `(source_app, source_record_id)` — prevents duplicate inserts
- FK on `fund_id` → `funds.id` — rejects invalid funds at INSERT time
- FK on `gl_account_id` → `accounts.id` — rejects invalid accounts

---

## 4. INSERT Examples

### Timesheet Fund Summary

One record per employee per fund per pay period:

```sql
INSERT INTO staging_records (
  source_app, source_record_id, record_type,
  employee_id, reference_id, date_incurred,
  amount, fund_id, gl_account_id, metadata
) VALUES (
  'timesheets',
  'TS-2024-W50-emp001-fund1',  -- unique per source_app
  'timesheet_fund_summary',
  'emp-001',
  'TS-2024-W50',               -- pay period reference
  '2024-12-15',                -- week ending date
  '2400.00',                   -- total earnings for this fund
  1,                           -- fund_id (from funds table)
  NULL,                        -- gl_account_id: NULL for timesheets
  '{"regularHours": 40, "overtimeHours": 0, "regularEarnings": 2400.00, "overtimeEarnings": 0.00}'
);
```

### Expense Report Line Item

One record per expense line per report:

```sql
INSERT INTO staging_records (
  source_app, source_record_id, record_type,
  employee_id, reference_id, date_incurred,
  amount, fund_id, gl_account_id, metadata
) VALUES (
  'expense_reports',
  'ER-2024-001-LINE-1',        -- unique per source_app
  'expense_line_item',
  'emp-001',
  'ER-2024-001',               -- expense report reference
  '2024-12-10',                -- date of expense
  '125.50',
  1,                           -- fund_id
  10,                          -- gl_account_id (required for expense reports)
  '{"merchant": "Home Depot", "memo": "Maintenance supplies", "expenseType": "out_of_pocket"}'
);
```

### Mileage Expense

```sql
INSERT INTO staging_records (
  source_app, source_record_id, record_type,
  employee_id, reference_id, date_incurred,
  amount, fund_id, gl_account_id, metadata
) VALUES (
  'expense_reports',
  'ER-2024-002-LINE-1',
  'expense_line_item',
  'emp-002',
  'ER-2024-002',
  '2024-12-12',
  '30.15',                     -- miles * rate
  1,
  10,
  '{"merchant": "Mileage Reimbursement", "expenseType": "mileage", "mileageDetails": {"miles": 45.0, "rate": 0.67}}'
);
```

---

## 5. Metadata Shape

### Timesheet metadata

```json
{
  "regularHours": 40,
  "overtimeHours": 5,
  "regularEarnings": 2400.00,
  "overtimeEarnings": 450.00
}
```

### Expense report metadata (out-of-pocket)

```json
{
  "merchant": "Home Depot",
  "memo": "Maintenance supplies for unit 3B",
  "expenseType": "out_of_pocket"
}
```

### Expense report metadata (mileage)

```json
{
  "merchant": "Mileage Reimbursement",
  "expenseType": "mileage",
  "mileageDetails": {
    "miles": 45.0,
    "rate": 0.67
  }
}
```

---

## 6. Status Lifecycle

```
received → posted → matched_to_payment → paid
```

| Status | Set By | Meaning |
|--------|--------|---------|
| `received` | Source app INSERT | Record ingested, awaiting processing |
| `posted` | Staging processor | GL entry created (`gl_transaction_id` set) |
| `matched_to_payment` | Bank reconciliation | Payment matched to this expense |
| `paid` | Manual/bank rec | Payment confirmed |

Timesheet records stay in `received` until the payroll engine consumes them (Phase 10).

---

## 7. Status Read-Back

Source apps can query their own records to check processing status:

```sql
SELECT id, status, gl_transaction_id, processed_at
FROM staging_records
WHERE source_app = 'expense_reports'
  AND reference_id = 'ER-2024-001'
ORDER BY created_at;
```

---

## 8. Reference Data Lookup

Source apps can query available funds and accounts to populate dropdowns:

```sql
-- Get active funds
SELECT id, name, restriction FROM funds WHERE is_active = true ORDER BY name;

-- Get active expense accounts (for expense report GL account selection)
SELECT id, code, name FROM accounts WHERE type = 'EXPENSE' AND is_active = true ORDER BY code;
```

---

## 9. Error Handling

### FK Violation (invalid fund)

```
ERROR:  insert or update on table "staging_records" violates foreign key constraint "staging_records_fund_id_funds_id_fk"
DETAIL:  Key (fund_id)=(999) is not present in table "funds".
```

**Fix:** Query the `funds` table first to get valid fund IDs.

### FK Violation (invalid account)

```
ERROR:  insert or update on table "staging_records" violates foreign key constraint "staging_records_gl_account_id_accounts_id_fk"
DETAIL:  Key (gl_account_id)=(999) is not present in table "accounts".
```

**Fix:** Query the `accounts` table first to get valid account IDs.

### Unique Constraint Violation (duplicate)

```
ERROR:  duplicate key value violates unique constraint "staging_records_source_uniq"
DETAIL:  Key (source_app, source_record_id)=(expense_reports, ER-2024-001-LINE-1) already exists.
```

**Fix:** This means the record was already inserted. This is expected for idempotent retries — the source app can safely catch this error and continue.

---

## 10. Processing Schedule

The staging processor runs:
- **Cron:** Every 15 minutes, weekdays, business hours (UTC 12:00-22:00)
- **Manual:** Via the "Run Processor" button at `/settings/staging`

Processing is idempotent — running the processor multiple times has no effect on already-posted records.
