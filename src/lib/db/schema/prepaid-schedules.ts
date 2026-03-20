import {
  boolean,
  date,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { funds } from './funds'
import { transactions } from './transactions'

export const prepaidSchedules = pgTable('prepaid_schedules', {
  id: serial('id').primaryKey(),
  description: varchar('description', { length: 255 }).notNull(),
  totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
  startDate: date('start_date', { mode: 'string' }).notNull(),
  endDate: date('end_date', { mode: 'string' }).notNull(),
  glExpenseAccountId: integer('gl_expense_account_id')
    .notNull()
    .references(() => accounts.id),
  glPrepaidAccountId: integer('gl_prepaid_account_id')
    .notNull()
    .references(() => accounts.id),
  fundId: integer('fund_id')
    .notNull()
    .references(() => funds.id),
  monthlyAmount: numeric('monthly_amount', {
    precision: 15,
    scale: 2,
  }).notNull(),
  amountAmortized: numeric('amount_amortized', { precision: 15, scale: 2 })
    .notNull()
    .default('0'),
  isActive: boolean('is_active').notNull().default(true),
  sourceTransactionId: integer('source_transaction_id').references(
    () => transactions.id
  ),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  cancelledAt: timestamp('cancelled_at'),
})
