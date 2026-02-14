import {
  boolean,
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { grantTypeEnum, grantStatusEnum } from './enums'
import { vendors } from './vendors'
import { funds } from './funds'

export const grants = pgTable(
  'grants',
  {
    id: serial('id').primaryKey(),
    funderId: integer('funder_id')
      .notNull()
      .references(() => vendors.id),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    type: grantTypeEnum('type').notNull(),
    conditions: text('conditions'),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    status: grantStatusEnum('status').notNull().default('ACTIVE'),
    isUnusualGrant: boolean('is_unusual_grant').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('grants_funder_id_idx').on(table.funderId),
    index('grants_fund_id_idx').on(table.fundId),
    index('grants_status_idx').on(table.status),
  ]
)
