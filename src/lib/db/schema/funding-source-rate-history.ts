import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const fundingSourceRateHistory = pgTable(
  'funding_source_rate_history',
  {
    id: serial('id').primaryKey(),
    fundId: integer('fund_id').notNull(), // FK → funds.id (defined in migration SQL)
    rate: numeric('rate', { precision: 7, scale: 4 }).notNull(), // e.g. 0.0525 = 5.25%
    effectiveDate: date('effective_date', { mode: 'string' }).notNull(),
    reason: text('reason').notNull(),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('fsrh_fund_id_idx').on(table.fundId),
    index('fsrh_fund_effective_idx').on(table.fundId, table.effectiveDate),
  ]
)
