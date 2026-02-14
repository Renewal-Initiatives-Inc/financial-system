import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { reconciliationStatusEnum } from './enums'
import { bankAccounts } from './bank-accounts'

export const reconciliationSessions = pgTable('reconciliation_sessions', {
  id: serial('id').primaryKey(),
  bankAccountId: integer('bank_account_id')
    .notNull()
    .references(() => bankAccounts.id),
  statementDate: date('statement_date').notNull(),
  statementBalance: numeric('statement_balance', {
    precision: 15,
    scale: 2,
  }).notNull(),
  status: reconciliationStatusEnum('status').notNull().default('in_progress'),
  signedOffBy: varchar('signed_off_by', { length: 255 }),
  signedOffAt: timestamp('signed_off_at'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
