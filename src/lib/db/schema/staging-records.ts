import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  unique,
  varchar,
  index,
} from 'drizzle-orm/pg-core'
import { funds } from './funds'
import { accounts } from './accounts'
import { transactions } from './transactions'

export const stagingRecords = pgTable(
  'staging_records',
  {
    id: serial('id').primaryKey(),
    sourceApp: varchar('source_app', { length: 50 }).notNull(),
    sourceRecordId: varchar('source_record_id', { length: 255 }).notNull(),
    recordType: varchar('record_type', { length: 50 }).notNull(),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    referenceId: varchar('reference_id', { length: 255 }).notNull(),
    dateIncurred: date('date_incurred', { mode: 'string' }).notNull(),
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    glAccountId: integer('gl_account_id').references(() => accounts.id),
    metadata: jsonb('metadata').notNull().default({}),
    status: varchar('status', { length: 20 }).notNull().default('received'),
    glTransactionId: integer('gl_transaction_id').references(
      () => transactions.id
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    processedAt: timestamp('processed_at'),
  },
  (table) => [
    unique('staging_records_source_uniq').on(
      table.sourceApp,
      table.sourceRecordId
    ),
    index('staging_records_employee_idx').on(table.employeeId),
    index('staging_records_status_idx').on(table.status),
    index('staging_records_date_idx').on(table.dateIncurred),
  ]
)
