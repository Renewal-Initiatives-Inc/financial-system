import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { projectionLineTypeEnum, confidenceLevelEnum } from './enums'
import { cashProjections } from './cash-projections'
import { funds } from './funds'

export const weeklyCashProjectionLines = pgTable(
  'weekly_cash_projection_lines',
  {
    id: serial('id').primaryKey(),
    projectionId: integer('projection_id')
      .notNull()
      .references(() => cashProjections.id, { onDelete: 'cascade' }),
    weekNumber: integer('week_number').notNull(),
    weekStartDate: date('week_start_date', { mode: 'string' }).notNull(),
    sourceLabel: varchar('source_label', { length: 255 }).notNull(),
    autoAmount: numeric('auto_amount', { precision: 15, scale: 2 }).notNull(),
    overrideAmount: numeric('override_amount', { precision: 15, scale: 2 }),
    overrideNote: text('override_note'),
    lineType: projectionLineTypeEnum('line_type').notNull(),
    confidenceLevel: confidenceLevelEnum('confidence_level').notNull(),
    fundId: integer('fund_id').references(() => funds.id),
    sortOrder: integer('sort_order').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('weekly_cash_proj_lines_projection_id_idx').on(table.projectionId),
    index('weekly_cash_proj_lines_week_number_idx').on(table.weekNumber),
  ]
)
