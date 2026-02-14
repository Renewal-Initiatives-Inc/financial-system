# Integration Spec: expense-reports-homegrown

**Direction:** expense-reports WRITES to financial-system (staging table INSERT). expense-reports also READS reference tables and staging status.
**Mechanism:** Restricted Postgres role `expense_reports_role` on financial-system's Neon DB.
**Requirements:** INT-P0-001, INT-P0-004, INT-P0-005, INT-P0-008, INT-P0-009, D-118, D-122

---

## Integration Flow

```
1. User submits expense report in expense-reports-homegrown
2. Approver approves the report
3. expense-reports INSERTs one staging_records row per line item
4. Financial-system processes staging records → creates GL entries
5. expense-reports reads status back for user visibility
6. Payment happens externally (UMass Five portal)
7. Bank rec matches payment → staging status updates to paid
```

---

## What expense-reports Can READ (SELECT)

| Table | Purpose |
|-------|---------|
| `accounts` | Populate GL account selection dropdown (user picks GL account per expense line) |
| `funds` | Populate funding source dropdown (renamed from "Projects") |
| `vendors` | Not needed for expense reports |
| `staging_records` | Read back processing status for user-facing feedback |

---

## What expense-reports Must WRITE (INSERT only)

### Staging Record — One Row Per Expense Line Item

| Field | Type | Source | Required |
|-------|------|--------|----------|
| `source_app` | string | Always `'expense_reports'` | Yes |
| `source_record_id` | string | Unique per line (e.g., `er_{report_id}_line_{line_num}`) | Yes |
| `record_type` | string | Always `'expense_line_item'` | Yes |
| `employee_id` | UUID | Submitting employee | Yes |
| `reference_id` | string | Expense report ID | Yes |
| `date_incurred` | date | Date of the expense | Yes |
| `amount` | decimal | Line item amount | Yes |
| `fund_id` | UUID (FK → funds) | Funding source selected by user | Yes |
| `gl_account_id` | UUID (FK → accounts) | GL account selected by user | Yes |
| `metadata` | JSONB | See below | Yes |
| `status` | string | Always `'received'` on INSERT | Yes |

**Metadata JSONB structure:**
```json
{
  "merchant": "Home Depot",
  "memo": "Construction supplies for barn renovation",
  "expense_type": "out_of_pocket",
  "mileage_details": null
}
```

For mileage expenses:
```json
{
  "merchant": null,
  "memo": "Site visit to Easthampton property",
  "expense_type": "mileage",
  "mileage_details": {
    "miles": 45.2,
    "rate": 0.67,
    "origin": "Springfield office",
    "destination": "75 Oliver St, Easthampton"
  }
}
```

**Constraints enforced at INSERT time:**
- FK on `fund_id` → catches invalid fund references
- FK on `gl_account_id` → catches invalid GL account references
- UNIQUE on `(source_app, source_record_id)` → prevents duplicates
- DB transaction → all line items for one report succeed or none

---

## Changes Needed in expense-reports-homegrown

### UI Changes (INT-P0-009)

- [ ] **Rename "Projects" → "Funding Source"** throughout the UI
  - Navigation labels
  - Form field labels
  - Column headers
  - Settings/admin pages
- [ ] **Add GL account selection** per expense line item
  - Dropdown populated from financial-system's `accounts` table (SELECT on accounts)
  - Filter to active expense-type accounts only
  - This is a NEW field — expense-reports currently doesn't have GL account selection
- [ ] **Add fund selection** per expense line item (replacing "Projects")
  - Dropdown populated from financial-system's `funds` table
  - Default to General Fund per D-024

### Deprecate QBO Artifacts (INT-P0-009)

- [ ] Remove QuickBooks Online integration code (`intuit-oauth` dependency)
- [ ] Remove QBO category sync
- [ ] Remove QBO export functionality
- [ ] Remove any QBO-specific UI (sync buttons, QBO status indicators)
- [ ] Clean up QBO-related environment variables

### Staging INSERT Logic (INT-P0-008)

- [ ] On expense report approval, INSERT one `staging_records` row per line item
- [ ] Each line has its own `gl_account_id` and `fund_id` (set by user during expense entry)
- [ ] No receipt data in staging — receipts stay in expense-reports app
- [ ] Handle INSERT errors (FK failures, unique violations) — surface to approver

### Status Read-Back

- [ ] After approval, read `staging_records` status for the submitted report
- [ ] Display to user: "Submitted to Financial System" → "Posted to GL" → "Payment Matched" → "Paid"
- [ ] Status field values: `received` → `posted` → `matched_to_payment` → `paid`

### Postgres Connection

- [ ] Add connection string for financial-system's Neon DB (env var)
- [ ] Use `expense_reports_role` credentials
- [ ] Remove QBO connection credentials

---

## Postgres Role Definition

```sql
-- Created in financial-system's Neon DB
CREATE ROLE expense_reports_role WITH LOGIN PASSWORD '...';

-- Read reference tables
GRANT SELECT ON accounts TO expense_reports_role;
GRANT SELECT ON funds TO expense_reports_role;

-- Write and read staging
GRANT INSERT, SELECT ON staging_records TO expense_reports_role;

-- No UPDATE, no DELETE on anything
```

---

## Migration Strategy

The expense-reports app currently sends data to QBO. The cutover:

1. **Before financial-system launch:** expense-reports continues with QBO
2. **At launch:**
   - Deploy expense-reports update (GL account + fund fields, staging INSERT, QBO removal)
   - Financial-system is ready to receive staging records
   - New expense reports go to financial-system
   - Historical expense data lives in QBO (covered by FY25 migration)
3. **No dual-write period** — clean cutover

---

## Build Notes

*(Add discoveries here during implementation)*

