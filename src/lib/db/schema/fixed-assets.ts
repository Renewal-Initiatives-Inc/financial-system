import {
  boolean,
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
import { depreciationMethodEnum } from './enums'
import { accounts } from './accounts'

export const fixedAssets = pgTable(
  'fixed_assets',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    acquisitionDate: date('acquisition_date', { mode: 'string' }).notNull(),
    cost: numeric('cost', { precision: 15, scale: 2 }).notNull(),
    salvageValue: numeric('salvage_value', { precision: 15, scale: 2 })
      .notNull()
      .default('0'),
    usefulLifeMonths: integer('useful_life_months').notNull(),
    depreciationMethod: depreciationMethodEnum('depreciation_method')
      .notNull()
      .default('STRAIGHT_LINE'),
    datePlacedInService: date('date_placed_in_service', { mode: 'string' }),
    glAssetAccountId: integer('gl_asset_account_id')
      .notNull()
      .references(() => accounts.id),
    glAccumDeprAccountId: integer('gl_accum_depr_account_id')
      .notNull()
      .references(() => accounts.id),
    glExpenseAccountId: integer('gl_expense_account_id')
      .notNull()
      .references(() => accounts.id),
    cipConversionId: integer('cip_conversion_id'),
    parentAssetId: integer('parent_asset_id'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('fixed_assets_gl_asset_account_id_idx').on(table.glAssetAccountId),
    index('fixed_assets_parent_asset_id_idx').on(table.parentAssetId),
    index('fixed_assets_is_active_idx').on(table.isActive),
  ]
)
