import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { spreadMethodEnum } from './enums'
import { budgets } from './budgets'
import { accounts } from './accounts'
import { funds } from './funds'

export const budgetLines = pgTable(
  'budget_lines',
  {
    id: serial('id').primaryKey(),
    budgetId: integer('budget_id')
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    annualAmount: numeric('annual_amount', { precision: 15, scale: 2 }).notNull(),
    spreadMethod: spreadMethodEnum('spread_method').notNull().default('EVEN'),
    monthlyAmounts: jsonb('monthly_amounts').notNull().$type<number[]>(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('budget_lines_budget_account_fund_idx').on(
      table.budgetId,
      table.accountId,
      table.fundId
    ),
    index('budget_lines_budget_id_idx').on(table.budgetId),
  ]
)
