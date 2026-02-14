import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  date,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { transactions } from './transactions'

export const cipConversions = pgTable(
  'cip_conversions',
  {
    id: serial('id').primaryKey(),
    structureName: varchar('structure_name', { length: 100 }).notNull(),
    placedInServiceDate: date('placed_in_service_date', {
      mode: 'string',
    }).notNull(),
    totalAmountConverted: numeric('total_amount_converted', {
      precision: 15,
      scale: 2,
    }).notNull(),
    glTransactionId: integer('gl_transaction_id')
      .notNull()
      .references(() => transactions.id),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('cip_conversions_structure_name_idx').on(table.structureName),
  ]
)
