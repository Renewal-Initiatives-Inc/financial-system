import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { funds } from './funds'
import { bankAccounts } from './bank-accounts'

export const recurringExpectationFrequencyEnum = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as const
export type RecurringExpectationFrequency = (typeof recurringExpectationFrequencyEnum)[number]

export const recurringExpectations = pgTable(
  'recurring_expectations',
  {
    id: serial('id').primaryKey(),
    merchantPattern: varchar('merchant_pattern', { length: 255 }).notNull(),
    description: varchar('description', { length: 255 }).notNull(),
    expectedAmount: numeric('expected_amount', { precision: 15, scale: 2 }).notNull(),
    amountTolerance: numeric('amount_tolerance', { precision: 5, scale: 2 }).notNull().default('0.00'),
    frequency: varchar('frequency', { length: 20 }).notNull(),
    expectedDay: integer('expected_day').notNull(),
    glAccountId: integer('gl_account_id')
      .notNull()
      .references(() => accounts.id),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id),
    isActive: boolean('is_active').notNull().default(true),
    lastMatchedAt: timestamp('last_matched_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('recurring_expectations_bank_account_idx').on(table.bankAccountId),
    index('recurring_expectations_active_idx').on(table.isActive),
  ]
)
