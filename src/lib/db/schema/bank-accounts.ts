import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core'
import { accounts } from './accounts'

export const bankAccounts = pgTable(
  'bank_accounts',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    institution: varchar('institution', { length: 255 }).notNull(),
    last4: varchar('last_4', { length: 4 }).notNull(),
    plaidAccessToken: text('plaid_access_token').notNull(),
    plaidItemId: varchar('plaid_item_id', { length: 255 }).notNull(),
    plaidAccountId: varchar('plaid_account_id', { length: 255 }),
    plaidCursor: text('plaid_cursor'),
    glAccountId: integer('gl_account_id')
      .notNull()
      .references(() => accounts.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex('bank_accounts_item_account_idx').on(
      table.plaidItemId,
      table.plaidAccountId
    ),
  ]
)
