import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { projectionLineTypeEnum } from './enums'
import { cashProjections } from './cash-projections'

export const cashProjectionLines = pgTable(
  'cash_projection_lines',
  {
    id: serial('id').primaryKey(),
    projectionId: integer('projection_id')
      .notNull()
      .references(() => cashProjections.id, { onDelete: 'cascade' }),
    month: integer('month').notNull(),
    sourceLabel: varchar('source_label', { length: 255 }).notNull(),
    autoAmount: numeric('auto_amount', { precision: 15, scale: 2 }).notNull(),
    overrideAmount: numeric('override_amount', { precision: 15, scale: 2 }),
    overrideNote: text('override_note'),
    lineType: projectionLineTypeEnum('line_type').notNull(),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('cash_projection_lines_projection_id_idx').on(table.projectionId),
  ]
)
