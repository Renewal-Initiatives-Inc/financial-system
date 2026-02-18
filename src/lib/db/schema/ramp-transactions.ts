import {
  boolean,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { rampTransactionStatusEnum } from './enums'
import { accounts } from './accounts'
import { funds } from './funds'
import { transactions } from './transactions'
import { categorizationRules } from './categorization-rules'

export const rampTransactions = pgTable(
  'ramp_transactions',
  {
    id: serial('id').primaryKey(),
    rampId: varchar('ramp_id', { length: 255 }).notNull(),
    date: varchar('date', { length: 10 }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    merchantName: varchar('merchant_name', { length: 500 }).notNull(),
    description: text('description'),
    cardholder: varchar('cardholder', { length: 255 }).notNull(),
    isPending: boolean('is_pending').notNull().default(false),
    status: rampTransactionStatusEnum('status').notNull().default('uncategorized'),
    glAccountId: integer('gl_account_id').references(() => accounts.id),
    fundId: integer('fund_id').references(() => funds.id),
    glTransactionId: integer('gl_transaction_id').references(() => transactions.id),
    categorizationRuleId: integer('categorization_rule_id').references(
      () => categorizationRules.id
    ),
    syncedAt: timestamp('synced_at').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('ramp_transactions_ramp_id_idx').on(table.rampId),
    index('ramp_transactions_status_idx').on(table.status),
    index('ramp_transactions_date_idx').on(table.date),
    index('ramp_transactions_gl_transaction_id_idx').on(table.glTransactionId),
  ]
)
