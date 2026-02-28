import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { importReviewStatusEnum } from './enums'
import { transactions } from './transactions'

export const importReviewItems = pgTable(
  'import_review_items',
  {
    id: serial('id').primaryKey(),
    batchId: varchar('batch_id', { length: 50 }).notNull(),
    qboTransactionNo: varchar('qbo_transaction_no', { length: 50 }).notNull(),
    transactionDate: date('transaction_date', { mode: 'string' }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    parsedData: jsonb('parsed_data').notNull(), // QboParsedTransaction
    description: text('description').notNull(),
    recommendation: jsonb('recommendation').notNull(), // { lines[]: { accountId, fundId, memo } }
    matchData: jsonb('match_data'), // { candidates[], matchType, confidence }
    accrualData: jsonb('accrual_data'), // { flag, startDate, endDate }
    userSelections: jsonb('user_selections'), // user overrides
    status: importReviewStatusEnum('status').notNull().default('pending'),
    glTransactionId: integer('gl_transaction_id').references(() => transactions.id),
    approvedBy: varchar('approved_by', { length: 255 }),
    approvedAt: timestamp('approved_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('import_review_batch_txn_idx').on(table.batchId, table.qboTransactionNo),
    index('import_review_batch_idx').on(table.batchId),
    index('import_review_status_idx').on(table.status),
  ]
)
