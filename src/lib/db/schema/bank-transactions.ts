import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { bankAccounts } from './bank-accounts'

export const bankTransactions = pgTable(
  'bank_transactions',
  {
    id: serial('id').primaryKey(),
    bankAccountId: integer('bank_account_id')
      .notNull()
      .references(() => bankAccounts.id),
    plaidTransactionId: varchar('plaid_transaction_id', {
      length: 255,
    }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    date: date('date').notNull(),
    merchantName: varchar('merchant_name', { length: 500 }),
    category: varchar('category', { length: 255 }),
    isPending: boolean('is_pending').notNull().default(false),
    paymentChannel: varchar('payment_channel', { length: 50 }),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bank_transactions_plaid_id_idx').on(table.plaidTransactionId),
    index('bank_transactions_account_date_idx').on(
      table.bankAccountId,
      table.date
    ),
  ]
)
