import {
  boolean,
  check,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { accounts } from './accounts'

export const functionalAllocations = pgTable(
  'functional_allocations',
  {
    id: serial('id').primaryKey(),
    fiscalYear: integer('fiscal_year').notNull(),
    accountId: integer('account_id')
      .notNull()
      .references(() => accounts.id),
    programPct: numeric('program_pct', { precision: 5, scale: 2 }).notNull(),
    adminPct: numeric('admin_pct', { precision: 5, scale: 2 }).notNull(),
    fundraisingPct: numeric('fundraising_pct', { precision: 5, scale: 2 }).notNull(),
    isPermanentRule: boolean('is_permanent_rule').notNull().default(false),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('functional_allocations_account_id_idx').on(table.accountId),
    index('functional_allocations_fiscal_year_idx').on(table.fiscalYear),
    check(
      'allocation_sum_check',
      sql`${table.programPct} + ${table.adminPct} + ${table.fundraisingPct} = 100`
    ),
  ]
)
