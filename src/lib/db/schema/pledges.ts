import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
} from 'drizzle-orm/pg-core'
import { pledgeStatusEnum } from './enums'
import { donors } from './donors'
import { funds } from './funds'
import { transactions } from './transactions'

export const pledges = pgTable(
  'pledges',
  {
    id: serial('id').primaryKey(),
    donorId: integer('donor_id')
      .notNull()
      .references(() => donors.id),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    expectedDate: date('expected_date', { mode: 'string' }),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    status: pledgeStatusEnum('status').notNull().default('PLEDGED'),
    glTransactionId: integer('gl_transaction_id').references(
      () => transactions.id
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('pledges_donor_id_idx').on(table.donorId),
    index('pledges_fund_id_idx').on(table.fundId),
    index('pledges_status_idx').on(table.status),
  ]
)
