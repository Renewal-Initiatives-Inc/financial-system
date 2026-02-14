# Integration Spec: renewal-timesheets

**Direction:** renewal-timesheets WRITES to financial-system (staging table INSERT). renewal-timesheets also READS reference tables and staging status.
**Mechanism:** Restricted Postgres role `timesheets_role` on financial-system's Neon DB.
**Requirements:** INT-P0-001, INT-P0-004, INT-P0-005, INT-P0-006, INT-P0-007, D-118, D-121

---

## Integration Flow

```
1. Supervisor approves timesheet in renewal-timesheets
2. renewal-timesheets aggregates hours/earnings per fund
3. renewal-timesheets INSERTs one staging_records row per fund
4. Financial-system processes staging records during payroll run
5. renewal-timesheets reads status back for user visibility
```

---

## What renewal-timesheets Can READ (SELECT)

| Table | Purpose |
|-------|---------|
| `accounts` | Populate GL account dropdowns (not currently needed — timesheets don't select GL accounts) |
| `funds` | Populate fund selection dropdown for time entries |
| `vendors` | Not needed for timesheets |
| `staging_records` | Read back processing status for user-facing feedback |

---

## What renewal-timesheets Must WRITE (INSERT only)

### Staging Record — One Row Per Fund Per Approved Timesheet

| Field | Type | Source | Required |
|-------|------|--------|----------|
| `source_app` | string | Always `'timesheets'` | Yes |
| `source_record_id` | string | Unique per row (e.g., `ts_{timesheet_id}_fund_{fund_id}`) | Yes |
| `record_type` | string | Always `'timesheet_fund_summary'` | Yes |
| `employee_id` | UUID | From timesheet | Yes |
| `reference_id` | string | Timesheet ID | Yes |
| `date_incurred` | date | Pay period end date | Yes |
| `amount` | decimal | Total earnings for this fund allocation | Yes |
| `fund_id` | UUID (FK → funds) | Fund selected per time entry, aggregated | Yes |
| `gl_account_id` | UUID | NULL for timesheets (financial-system assigns Salaries & Wages) | No |
| `metadata` | JSONB | See below | Yes |
| `status` | string | Always `'received'` on INSERT | Yes |

**Metadata JSONB structure:**
```json
{
  "regular_hours": 32.0,
  "overtime_hours": 4.5,
  "regular_earnings": 800.00,
  "overtime_earnings": 168.75
}
```

**Constraints enforced at INSERT time:**
- FK on `fund_id` → catches invalid fund references immediately
- UNIQUE on `(source_app, source_record_id)` → prevents duplicate submissions
- DB transaction → atomic INSERT (all rows for a timesheet succeed or none)

---

## Changes Needed in renewal-timesheets

### Fund Selection (INT-P0-007)

- [ ] Add fund selection per time entry (dropdown populated from financial-system's `funds` table)
- [ ] Default to General Fund (Unrestricted) per D-024
- [ ] Fund selection should be optional — if not specified, defaults to General Fund

### Staging INSERT Logic (INT-P0-006)

- [ ] On timesheet approval, aggregate time entries by fund
- [ ] For each fund: sum regular_hours, overtime_hours, regular_earnings, overtime_earnings
- [ ] INSERT one `staging_records` row per fund into financial-system's DB
- [ ] Handle INSERT errors (FK constraint failures, unique constraint violations) — surface to approving supervisor

### Status Read-Back

- [ ] After approval, poll/read `staging_records` status for the submitted timesheet
- [ ] Display to user: "Submitted" → "Posted to GL" → "Matched to payment" → "Paid"
- [ ] Status field values: `received` → `posted` → `matched_to_payment` → `paid`

### Postgres Connection

- [ ] Add connection string for financial-system's Neon DB (env var)
- [ ] Use `timesheets_role` credentials (restricted: SELECT on reference tables, INSERT + SELECT on staging_records)

### People API Read (Separate from Financial-System)

renewal-timesheets also reads from app-portal for compensation data:
- [ ] Read `compensation_type`, `calculated_hourly_rate`, `exempt_status` from app-portal
- [ ] Use these for gross pay calculation before staging INSERT
- [ ] Postgres role: `timesheets_reader` on app-portal DB

---

## Postgres Role Definition

```sql
-- Created in financial-system's Neon DB
CREATE ROLE timesheets_role WITH LOGIN PASSWORD '...';

-- Read reference tables
GRANT SELECT ON accounts TO timesheets_role;
GRANT SELECT ON funds TO timesheets_role;

-- Write and read staging
GRANT INSERT, SELECT ON staging_records TO timesheets_role;

-- No UPDATE, no DELETE on anything
```

---

## Build Notes

*(Add discoveries here during implementation)*

