import {
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

export const annualRateConfig = pgTable(
  'annual_rate_config',
  {
    id: serial('id').primaryKey(),
    fiscalYear: integer('fiscal_year').notNull(),
    configKey: varchar('config_key', { length: 100 }).notNull(),
    value: numeric('value', { precision: 15, scale: 6 }).notNull(),
    effectiveDate: date('effective_date', { mode: 'string' }),
    notes: text('notes'),
    sourceDocument: varchar('source_document', { length: 255 }),
    sourceUrl: text('source_url'),
    verifiedDate: date('verified_date', { mode: 'string' }),
    jsonValue: jsonb('json_value'),
    updatedBy: varchar('updated_by', { length: 255 }).notNull(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    unique('annual_rate_config_year_key_date_uniq').on(
      table.fiscalYear,
      table.configKey,
      table.effectiveDate
    ),
  ]
)
