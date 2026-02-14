import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { accountTypeEnum, normalBalanceEnum } from './enums'

export const accounts = pgTable(
  'accounts',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 20 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    type: accountTypeEnum('type').notNull(),
    subType: varchar('sub_type', { length: 50 }),
    normalBalance: normalBalanceEnum('normal_balance').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    form990Line: varchar('form_990_line', { length: 10 }),
    parentAccountId: integer('parent_account_id'),
    isSystemLocked: boolean('is_system_locked').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [index('accounts_parent_account_id_idx').on(table.parentAccountId)]
)
