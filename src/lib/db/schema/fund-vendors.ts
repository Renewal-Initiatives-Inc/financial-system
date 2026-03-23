import {
  boolean,
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  unique,
} from 'drizzle-orm/pg-core'
import { funds } from './funds'
import { vendors } from './vendors'

export const fundVendors = pgTable(
  'fund_vendors',
  {
    id: serial('id').primaryKey(),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    vendorId: integer('vendor_id')
      .notNull()
      .references(() => vendors.id),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('fund_vendors_fund_vendor_unique').on(table.fundId, table.vendorId),
    index('fund_vendors_fund_id_idx').on(table.fundId),
    index('fund_vendors_vendor_id_idx').on(table.vendorId),
  ]
)
