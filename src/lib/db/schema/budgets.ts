import {
  integer,
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { budgetStatusEnum } from './enums'

export const budgets = pgTable(
  'budgets',
  {
    id: serial('id').primaryKey(),
    fiscalYear: integer('fiscal_year').notNull(),
    status: budgetStatusEnum('status').notNull().default('DRAFT'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('budgets_fiscal_year_idx').on(table.fiscalYear)]
)
