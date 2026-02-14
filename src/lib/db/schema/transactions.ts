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
import { sourceTypeEnum } from './enums'

export const transactions = pgTable(
  'transactions',
  {
    id: serial('id').primaryKey(),
    date: date('date', { mode: 'string' }).notNull(),
    memo: text('memo').notNull(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    sourceReferenceId: varchar('source_reference_id', { length: 255 }),
    isSystemGenerated: boolean('is_system_generated').notNull().default(false),
    isVoided: boolean('is_voided').notNull().default(false),
    reversalOfId: integer('reversal_of_id'),
    reversedById: integer('reversed_by_id'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('transactions_date_idx').on(table.date),
    index('transactions_source_type_idx').on(table.sourceType),
  ]
)
