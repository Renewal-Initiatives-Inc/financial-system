import {
  boolean,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const matchingRules = pgTable('matching_rules', {
  id: serial('id').primaryKey(),
  criteria: jsonb('criteria').notNull(),
  action: jsonb('action').notNull(),
  createdBy: varchar('created_by', { length: 255 }).notNull(),
  hitCount: integer('hit_count').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
