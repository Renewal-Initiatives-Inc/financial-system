import {
  date,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { projectionTypeEnum } from './enums'

export const cashProjections = pgTable('cash_projections', {
  id: serial('id').primaryKey(),
  fiscalYear: integer('fiscal_year').notNull(),
  asOfDate: date('as_of_date', { mode: 'string' }).notNull(),
  projectionType: projectionTypeEnum('projection_type').notNull().default('MONTHLY'),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
