import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'
import { funds } from './funds'

export const categorizationRules = pgTable(
  'categorization_rules',
  {
    id: serial('id').primaryKey(),
    criteria: jsonb('criteria').$type<{
      merchantPattern?: string
      descriptionKeywords?: string[]
    }>().notNull(),
    glAccountId: integer('gl_account_id')
      .references(() => accounts.id)
      .notNull(),
    fundId: integer('fund_id')
      .references(() => funds.id)
      .notNull(),
    autoApply: boolean('auto_apply').notNull().default(true),
    hitCount: integer('hit_count').notNull().default(0),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [index('categorization_rules_auto_apply_idx').on(table.autoApply)]
)
