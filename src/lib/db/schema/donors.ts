import {
  boolean,
  date,
  index,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { donorTypeEnum } from './enums'

export const donors = pgTable(
  'donors',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    address: varchar('address', { length: 1000 }),
    email: varchar('email', { length: 255 }),
    type: donorTypeEnum('type').notNull(),
    firstGiftDate: date('first_gift_date'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('donors_name_idx').on(table.name),
    index('donors_is_active_idx').on(table.isActive),
  ]
)
