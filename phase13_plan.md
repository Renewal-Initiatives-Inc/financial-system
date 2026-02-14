# Phase 13: Staging Table Integration — Timesheets & Expense Reports

**Goal:** Build the staging table, processing pipeline, and configure the restricted Postgres roles for internal app integration. When this phase is complete, renewal-timesheets and expense-reports-homegrown can INSERT approved records into the staging table, and the financial-system processes them into GL entries.

**Dependencies:**
- Phase 5 (GL Engine) — `createTransaction()` in `src/lib/gl/engine.ts` ✅
- Phase 4 (Chart of Accounts / Funds) — accounts and funds schema + seed data ✅
- Key accounts: Reimbursements Payable (code `2010`), Salaries & Wages (code `5000`)
- Source types `TIMESHEET` and `EXPENSE_REPORT` already exist in `sourceTypeEnum`

**Requirements Satisfied:**
- INT-P0-001: Database-mediated integration pattern
- INT-P0-004: Staging table processing flow
- INT-P0-005: FK constraints, unique constraint, error handling
- INT-P0-006: Timesheet staging (per-fund aggregation)
- INT-P0-007: Fund selection per time entry
- INT-P0-008: Expense report staging (per line item)
- INT-P0-009: expense-reports-homegrown changes (reference data exposure)
- TXN-P0-017: Expense report GL entries (DR expense, CR Reimbursements Payable)
- design.md Section 2.5: Staging schema
- design.md Section 4.1: Internal app integration architecture

---

## Step 1: Define Staging Enums and Schema

**Files to create:**
- `src/lib/db/schema/staging-records.ts`

**Files to modify:**
- `src/lib/db/schema/enums.ts` — add `stagingSourceAppEnum`, `stagingRecordTypeEnum`, `stagingStatusEnum`
- `src/lib/db/schema/index.ts` — export staging table + relations

### 1a. Add enums to `enums.ts`

```typescript
export const stagingSourceAppEnum = pgEnum('staging_source_app', [
  'timesheets',
  'expense_reports',
])

export const stagingRecordTypeEnum = pgEnum('staging_record_type', [
  'timesheet_fund_summary',
  'expense_line_item',
])

export const stagingStatusEnum = pgEnum('staging_status', [
  'received',
  'posted',
  'matched_to_payment',
  'paid',
])
```

### 1b. Create `staging-records.ts`

Per design.md Section 2.5:

```typescript
export const stagingRecords = pgTable('staging_records', {
  id: serial('id').primaryKey(),
  sourceApp: stagingSourceAppEnum('source_app').notNull(),
  sourceRecordId: varchar('source_record_id', { length: 255 }).notNull(),
  recordType: stagingRecordTypeEnum('record_type').notNull(),
  employeeId: varchar('employee_id', { length: 255 }).notNull(),
  referenceId: varchar('reference_id', { length: 255 }).notNull(),
  dateIncurred: date('date_incurred', { mode: 'string' }).notNull(),
  amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
  fundId: integer('fund_id').notNull().references(() => funds.id),
  glAccountId: integer('gl_account_id').references(() => accounts.id),
  metadata: jsonb('metadata'),
  status: stagingStatusEnum('status').notNull().default('received'),
  glTransactionId: integer('gl_transaction_id').references(() => transactions.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  processedAt: timestamp('processed_at'),
}, (table) => [
  uniqueIndex('staging_records_source_unique').on(table.sourceApp, table.sourceRecordId),
  index('staging_records_status_idx').on(table.status),
  index('staging_records_source_app_idx').on(table.sourceApp),
  index('staging_records_fund_id_idx').on(table.fundId),
])
```

**Key design decisions:**
- `fund_id` is NOT NULL with FK — catches invalid funds at INSERT time (INT-P0-005)
- `gl_account_id` is nullable — timesheets don't specify a GL account (payroll engine determines it)
- `metadata` JSONB stores structural differences: timesheets get `{regular_hours, overtime_hours, regular_earnings, overtime_earnings}`, expense reports get `{merchant, memo, expense_type, mileage_details}`
- UNIQUE on `(source_app, source_record_id)` prevents duplicate inserts (INT-P0-005)

### 1c. Update `index.ts`

Add exports and relations for `stagingRecords`:

```typescript
export * from './staging-records'
import { stagingRecords } from './staging-records'

export const stagingRecordsRelations = relations(stagingRecords, ({ one }) => ({
  fund: one(funds, { fields: [stagingRecords.fundId], references: [funds.id] }),
  glAccount: one(accounts, { fields: [stagingRecords.glAccountId], references: [accounts.id] }),
  glTransaction: one(transactions, { fields: [stagingRecords.glTransactionId], references: [transactions.id] }),
}))
```

### Acceptance Criteria
- [ ] Staging table defined with all columns per design.md Section 2.5
- [ ] FK constraints on `fund_id` and `gl_account_id` enforce referential integrity
- [ ] UNIQUE constraint on `(source_app, source_record_id)` prevents duplicates
- [ ] Three new enums: source app, record type, status

---

## Step 2: Run Migration

**Command:** `npm run db:generate && npm run db:push`

### Acceptance Criteria
- [ ] Migration SQL generated cleanly
- [ ] Schema pushed to dev database without errors
- [ ] `staging_records` table visible in Drizzle Studio

---

## Step 3: Create Zod Validators for Staging Records

**File to create:**
- `src/lib/validators/staging.ts`

**File to modify:**
- `src/lib/validators/index.ts` — re-export staging validators

### Schema definitions

```typescript
// Timesheet metadata shape
const timesheetMetadataSchema = z.object({
  regularHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative(),
  regularEarnings: z.number().nonnegative(),
  overtimeEarnings: z.number().nonnegative(),
})

// Expense report metadata shape
const expenseMetadataSchema = z.object({
  merchant: z.string().min(1),
  memo: z.string().optional(),
  expenseType: z.enum(['out_of_pocket', 'mileage']),
  mileageDetails: z.object({
    miles: z.number().positive(),
    rate: z.number().positive(),
  }).optional(),
})

// Insert schema for staging records
export const insertStagingRecordSchema = z.object({
  sourceApp: z.enum(['timesheets', 'expense_reports']),
  sourceRecordId: z.string().min(1).max(255),
  recordType: z.enum(['timesheet_fund_summary', 'expense_line_item']),
  employeeId: z.string().min(1).max(255),
  referenceId: z.string().min(1).max(255),
  dateIncurred: z.string().date(),
  amount: z.number().positive(),
  fundId: z.number().int().positive(),
  glAccountId: z.number().int().positive().nullable().optional(),
  metadata: z.union([timesheetMetadataSchema, expenseMetadataSchema]).optional(),
})
```

Add refinements:
- `expense_line_item` records MUST have `glAccountId` (expenses need a GL account)
- `timesheet_fund_summary` records MUST NOT have `glAccountId` (payroll engine assigns it)
- `sourceApp` and `recordType` must be consistent: timesheets → timesheet_fund_summary, expense_reports → expense_line_item

### Acceptance Criteria
- [ ] Zod schemas validate timesheet and expense report metadata shapes
- [ ] Cross-field validation enforces consistency between sourceApp and recordType
- [ ] glAccountId required for expense line items, null for timesheets

---

## Step 4: Build Staging Table Processor

**File to create:**
- `src/lib/staging/processor.ts`

This is the core business logic. The processor:
1. Queries `staging_records WHERE status = 'received'`
2. Routes records by `record_type`
3. Creates GL entries via the GL engine for expense reports
4. Marks timesheet records as received (they accumulate for payroll)
5. Updates status and sets `gl_transaction_id` where applicable

### 4a. Main processor function

```typescript
export interface ProcessingResult {
  processed: number
  expenseReportsPosted: number
  timesheetsReceived: number
  errors: Array<{ recordId: number; error: string }>
}

export async function processReceivedStagingRecords(): Promise<ProcessingResult>
```

**Processing logic:**

For each received record:
- **expense_line_item**: Create GL entry via `createTransaction()`:
  - DR: `gl_account_id` (from staging record) for `amount`, coded to `fund_id`
  - CR: Reimbursements Payable (code `2010`) for `amount`, coded to `fund_id`
  - `sourceType`: `'EXPENSE_REPORT'`
  - `sourceReferenceId`: staging record's `reference_id`
  - `memo`: from metadata merchant + memo, or reference_id
  - `createdBy`: `'system:staging-processor'`
  - On success: update status → `'posted'`, set `gl_transaction_id`, set `processed_at`
  - On failure: log error, skip record (retry on next run)

- **timesheet_fund_summary**: No GL entry — timesheets accumulate for payroll.
  - Status stays `'received'` — payroll processing (Phase 10) will consume these
  - No `gl_transaction_id` set yet

### 4b. Account lookup helper

```typescript
// Look up Reimbursements Payable account by code '2010'
async function getReimbursementsPayableAccount(): Promise<{ id: number }>
```

Cache the account ID on first call (it's a system-locked account that never changes).

### 4c. Error handling

- Each record processed independently (one failure doesn't block others)
- GL engine validation catches invalid accounts/funds (INV-002, INV-003, INV-004)
- Processor catches and logs errors per record, continues with next
- Returns summary with error details

### Acceptance Criteria
- [ ] Processor queries unprocessed records and routes by record_type
- [ ] Expense report records create balanced GL entries (DR expense, CR Reimbursements Payable)
- [ ] GL entries use `sourceType: 'EXPENSE_REPORT'` and carry `sourceReferenceId`
- [ ] Status updated to `'posted'` with `gl_transaction_id` after successful GL entry
- [ ] Timesheet records acknowledged but left for payroll processing
- [ ] Individual record failures don't block other records
- [ ] Audit log entries created via GL engine for all posted transactions

---

## Step 5: Build Staging Processor Cron Job

**File to create:**
- `src/app/api/cron/staging-processor/route.ts`

**File to modify:**
- `vercel.json` — add cron schedule (if cron config exists)

### Pattern

Follow existing cron pattern from `src/app/api/cron/ramp-sync/route.ts`:
- POST handler
- Bearer token auth against `CRON_SECRET`
- Call `processReceivedStagingRecords()`
- Return JSON with processing summary
- Error handling with console.error

### Cron frequency

Run every 15 minutes during business hours, or on-demand via manual trigger. The staging processor is idempotent (records already in `'posted'` status are skipped).

### Acceptance Criteria
- [ ] Cron endpoint at `/api/cron/staging-processor`
- [ ] Auth via `CRON_SECRET` Bearer token
- [ ] Returns processing summary JSON
- [ ] Idempotent — safe to call multiple times

---

## Step 6: Build Manual Trigger Server Action

**File to create:**
- `src/app/(protected)/settings/staging/actions.ts`

### Actions

```typescript
'use server'

// Manually trigger staging processor (useful for debugging)
export async function triggerStagingProcessor(): Promise<ProcessingResult>

// Update staging record status (for manual intervention)
export async function updateStagingRecordStatus(
  id: number,
  status: 'matched_to_payment' | 'paid'
): Promise<{ success: boolean } | { error: string }>
```

The manual trigger calls the same `processReceivedStagingRecords()` function. Status updates support the payment lifecycle: when a payment is matched in bank rec or confirmed paid.

### Acceptance Criteria
- [ ] Manual trigger invokes same processor as cron
- [ ] Status can be advanced through the lifecycle (posted → matched_to_payment → paid)
- [ ] Actions follow existing server action pattern (discriminated union returns)

---

## Step 7: Build Staging Records Viewer Page

**Files to create:**
- `src/app/(protected)/settings/staging/page.tsx`
- `src/app/(protected)/settings/staging/staging-table.tsx` (client component)
- `src/app/(protected)/settings/staging/columns.tsx` (TanStack Table column defs)

**File to modify:**
- `src/app/(protected)/settings/page.tsx` — add link to staging viewer

### Page features

- TanStack Table showing all staging records
- Columns: ID, Source App, Record Type, Employee ID, Reference ID, Date, Amount, Fund, GL Account, Status, GL Transaction ID, Created At, Processed At
- Filters: status dropdown, source app dropdown
- Status badges with color coding: received (blue), posted (green), matched_to_payment (yellow), paid (gray)
- "Run Processor" button that calls `triggerStagingProcessor()` action
- Processing result toast notification
- Link to GL transaction for posted records

### Settings page update

Add a card/link on the settings page that points to `/settings/staging`:
```
Staging Records
View and manage records from renewal-timesheets and expense-reports.
→ View Records
```

### Acceptance Criteria
- [ ] Staging viewer page at `/settings/staging`
- [ ] All staging records displayed in TanStack Table with sorting
- [ ] Filterable by status and source app
- [ ] Manual processor trigger button works
- [ ] Posted records link to their GL transaction
- [ ] Settings page links to staging viewer

---

## Step 8: Build Staging Record Queries

**File to create:**
- `src/lib/staging/queries.ts`

### Query functions

```typescript
// Get all staging records with optional filters
export async function getStagingRecords(filters?: {
  status?: StagingStatus
  sourceApp?: StagingSourceApp
  limit?: number
  offset?: number
}): Promise<StagingRecordWithRelations[]>

// Get staging records by reference (for source app status read-back)
export async function getStagingRecordsByReference(
  sourceApp: string,
  referenceId: string
): Promise<StagingRecord[]>

// Get staging record counts by status (for settings dashboard)
export async function getStagingRecordCounts(): Promise<Record<string, number>>

// Get unprocessed records (for processor)
export async function getUnprocessedRecords(): Promise<StagingRecord[]>
```

### Acceptance Criteria
- [ ] Query functions support filtering, pagination
- [ ] Reference lookup enables source app status read-back (INT-P0-004)
- [ ] Count query provides dashboard metrics

---

## Step 9: Document Postgres Role Configuration

**File to create:**
- `docs/staging-integration-guide.md`

This is documentation for Jeff (who maintains all RI apps) describing:

1. **Neon role creation SQL** (to run in Neon console):
```sql
-- Create restricted roles for source apps
CREATE ROLE timesheets_role LOGIN PASSWORD '...';
CREATE ROLE expense_reports_role LOGIN PASSWORD '...';

-- Grant SELECT on reference tables
GRANT SELECT ON accounts, funds, vendors TO timesheets_role, expense_reports_role;

-- Grant INSERT + SELECT on staging_records (no UPDATE, no DELETE)
GRANT INSERT, SELECT ON staging_records TO timesheets_role, expense_reports_role;

-- Grant USAGE on sequences (needed for INSERT with serial PK)
GRANT USAGE ON SEQUENCE staging_records_id_seq TO timesheets_role, expense_reports_role;
```

2. **Connection string format** for source apps
3. **INSERT format** with example payloads for timesheets and expense reports
4. **Status read-back** query pattern
5. **Error handling**: what FK violations look like, what unique constraint violations look like
6. **Metadata shape** documentation for each record type

### Acceptance Criteria
- [ ] Complete SQL for Neon role creation
- [ ] Example INSERT payloads for both source apps
- [ ] Error scenarios documented
- [ ] Ready for Jeff to configure in Neon console

---

## Step 10: Write Unit Tests

**File to create:**
- `src/lib/staging/processor.test.ts`

### Test cases

**Staging processor tests:**
1. Processes expense report records into GL entries
   - Verify DR expense account, CR Reimbursements Payable
   - Verify amount matches staging record
   - Verify fund_id carried through to GL lines
   - Verify sourceType = 'EXPENSE_REPORT'
   - Verify sourceReferenceId set from reference_id
   - Verify status updated to 'posted'
   - Verify gl_transaction_id set
   - Verify processed_at set

2. Leaves timesheet records in 'received' status
   - Verify no GL entry created
   - Verify status remains 'received'
   - Verify gl_transaction_id is null

3. Handles mixed batch (timesheets + expense reports)
   - Verify only expense reports get GL entries
   - Verify correct counts in ProcessingResult

4. Skips already-processed records
   - Insert records with status 'posted'
   - Verify processor returns 0 processed

5. Handles individual record failures gracefully
   - Insert record with invalid gl_account_id
   - Verify other records still processed
   - Verify error captured in result

6. Restricted fund triggers net asset release
   - Insert expense report with restricted fund
   - Verify GL engine creates release entry (INV-007)

**Validator tests:**
7. Validates expense_line_item requires glAccountId
8. Validates timesheet_fund_summary rejects glAccountId
9. Validates sourceApp/recordType consistency
10. Validates metadata shape per record type
11. Validates UNIQUE constraint (mock duplicate insert)

### Acceptance Criteria
- [ ] All test cases pass
- [ ] GL entry creation verified end-to-end (mocking DB)
- [ ] Error handling tested
- [ ] Restricted fund release tested

---

## Step 11: Write Integration/E2E Tests

**File to create:**
- `src/lib/staging/staging.integration.test.ts` (integration test with real DB patterns)

### Integration test scenarios

1. **Full expense report lifecycle:**
   - INSERT staging record (expense_line_item)
   - Run processor
   - Verify GL transaction exists in `transactions` table
   - Verify transaction lines balance
   - Verify staging status = 'posted'
   - Verify audit log entry created

2. **Duplicate prevention:**
   - INSERT staging record
   - INSERT same `(source_app, source_record_id)` again
   - Verify unique constraint error

3. **FK constraint enforcement:**
   - INSERT staging record with non-existent fund_id
   - Verify FK violation error

4. **Multi-record batch processing:**
   - INSERT 5 expense reports + 3 timesheets
   - Run processor
   - Verify 5 GL entries created, 3 timesheets untouched
   - Verify ProcessingResult counts

5. **Status read-back:**
   - INSERT and process records
   - Query by reference_id
   - Verify status and gl_transaction_id readable

### Acceptance Criteria
- [ ] Full lifecycle test passes
- [ ] Constraint violations caught at INSERT time
- [ ] Batch processing verified
- [ ] Status read-back works

---

## File Summary

### New files (9)
| File | Purpose |
|------|---------|
| `src/lib/db/schema/staging-records.ts` | Drizzle schema for staging_records table |
| `src/lib/staging/processor.ts` | Core staging processor business logic |
| `src/lib/staging/queries.ts` | Query functions for staging records |
| `src/lib/validators/staging.ts` | Zod validation schemas |
| `src/app/api/cron/staging-processor/route.ts` | Cron endpoint for periodic processing |
| `src/app/(protected)/settings/staging/page.tsx` | Staging records viewer page |
| `src/app/(protected)/settings/staging/staging-table.tsx` | Client component for TanStack Table |
| `src/app/(protected)/settings/staging/columns.tsx` | Column definitions |
| `src/app/(protected)/settings/staging/actions.ts` | Server actions (manual trigger, status update) |

### Modified files (4)
| File | Change |
|------|--------|
| `src/lib/db/schema/enums.ts` | Add 3 staging enums |
| `src/lib/db/schema/index.ts` | Export staging table + relations |
| `src/lib/validators/index.ts` | Re-export staging validators |
| `src/app/(protected)/settings/page.tsx` | Add link to staging viewer |

### Documentation (1)
| File | Purpose |
|------|---------|
| `docs/staging-integration-guide.md` | Postgres role setup + source app integration guide |

### Test files (2)
| File | Purpose |
|------|---------|
| `src/lib/staging/processor.test.ts` | Unit tests for processor + validators |
| `src/lib/staging/staging.integration.test.ts` | Integration tests with DB |

---

## Execution Order

| Order | Step | Depends On | Est. Complexity |
|-------|------|-----------|-----------------|
| 1 | Schema + enums | — | Low |
| 2 | Migration | Step 1 | Low |
| 3 | Validators | Step 1 | Low |
| 4 | Queries | Step 2 | Low |
| 5 | Processor | Steps 3, 4 | Medium |
| 6 | Cron job | Step 5 | Low |
| 7 | Server actions | Step 5 | Low |
| 8 | Viewer page | Steps 4, 7 | Medium |
| 9 | Unit tests | Step 5 | Medium |
| 10 | Integration tests | Steps 5, 6 | Medium |
| 11 | Documentation | All steps | Low |

Steps 3 and 4 can run in parallel after Step 2.
Steps 6 and 7 can run in parallel after Step 5.
Step 8 can start after Steps 4 and 7.
