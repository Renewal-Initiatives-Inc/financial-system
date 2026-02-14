import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { w9StatusEnum } from './enums'
import { accounts } from './accounts'
import { funds } from './funds'

export const vendors = pgTable(
  'vendors',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    address: text('address'),
    taxId: text('tax_id'),
    entityType: varchar('entity_type', { length: 50 }),
    is1099Eligible: boolean('is_1099_eligible').notNull().default(false),
    defaultAccountId: integer('default_account_id').references(() => accounts.id),
    defaultFundId: integer('default_fund_id').references(() => funds.id),
    w9Status: w9StatusEnum('w9_status').notNull().default('NOT_REQUIRED'),
    w9CollectedDate: date('w9_collected_date'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('vendors_name_idx').on(table.name),
    index('vendors_is_active_idx').on(table.isActive),
  ]
)
