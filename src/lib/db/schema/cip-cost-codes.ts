import {
  boolean,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { cipCostCategoryEnum } from './enums'

export const cipCostCodes = pgTable('cip_cost_codes', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 10 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  category: cipCostCategoryEnum('category').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
