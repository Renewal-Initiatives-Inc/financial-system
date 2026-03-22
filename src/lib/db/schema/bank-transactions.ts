import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { bankAccounts } from './bank-accounts'
import { transactionLines } from './transaction-lines'
import { matchingRules } from './matching-rules'

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
    // Pre-computed match classification (written at sync time)
    matchTier: smallint('match_tier'), // 1=auto, 2=review, 3=exception, null=unclassified
    suggestedGlLineId: integer('suggested_gl_line_id').references(
      () => transactionLines.id
    ),
    suggestedConfidence: numeric('suggested_confidence', {
      precision: 5,
      scale: 2,
    }),
    suggestedReason: text('suggested_reason'),
    suggestedRuleId: integer('suggested_rule_id').references(
      () => matchingRules.id
    ),
    // Invoice match suggestion (written alongside GL suggestions)
    // FK to invoices.id enforced at DB level (migration 0030); no TS import to avoid circular dep
    suggestedInvoiceId: integer('suggested_invoice_id'),
    invoiceMatchConfidence: numeric('invoice_match_confidence', {
      precision: 5,
      scale: 2,
    }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bank_transactions_plaid_id_idx').on(table.plaidTransactionId),
    index('bank_transactions_account_date_idx').on(
      table.bankAccountId,
      table.date
    ),
    index('bank_transactions_account_tier_idx').on(
      table.bankAccountId,
      table.matchTier
    ),
  ]
)
