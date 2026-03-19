import {
  pgTable,
  serial,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'

export const appSettings = pgTable(
  'app_settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 100 }).notNull(),
    value: varchar('value', { length: 500 }).notNull(),
    description: varchar('description', { length: 255 }),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [uniqueIndex('app_settings_key_idx').on(table.key)]
)
