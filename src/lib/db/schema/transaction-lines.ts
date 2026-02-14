import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { transactions } from './transactions'
import { accounts } from './accounts'
import { funds } from './funds'
import { cipCostCodes } from './cip-cost-codes'

export const transactionLines = pgTable(
  'transaction_lines',
  {
    id: serial('id').primaryKey(),
    transactionId: integer('transaction_id')
      .notNull()
      .references(() => transactions.id, { onDelete: 'cascade' }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    cipCostCodeId: integer('cip_cost_code_id').references(
      () => cipCostCodes.id
    ),
    debit: numeric('debit', { precision: 15, scale: 2 }),
    credit: numeric('credit', { precision: 15, scale: 2 }),
    memo: text('memo'),
  },
  (table) => [
    check(
      'debit_credit_check',
      sql`(${table.debit} IS NOT NULL AND ${table.debit} > 0 AND ${table.credit} IS NULL) OR (${table.credit} IS NOT NULL AND ${table.credit} > 0 AND ${table.debit} IS NULL)`
    ),
    index('transaction_lines_transaction_id_idx').on(table.transactionId),
    index('transaction_lines_account_id_idx').on(table.accountId),
    index('transaction_lines_fund_id_idx').on(table.fundId),
  ]
)
