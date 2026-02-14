import {
  boolean,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { fundRestrictionEnum } from './enums'

export const funds = pgTable('funds', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull().unique(),
  restrictionType: fundRestrictionEnum('restriction_type').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  description: text('description'),
  isSystemLocked: boolean('is_system_locked').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
