import {
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
} from 'drizzle-orm/pg-core'
import { cipConversions } from './cip-conversions'
import { accounts } from './accounts'
import { cipCostCodes } from './cip-cost-codes'
import { fixedAssets } from './fixed-assets'

export const cipConversionLines = pgTable(
  'cip_conversion_lines',
  {
    id: serial('id').primaryKey(),
    conversionId: integer('conversion_id')
      .notNull()
      .references(() => cipConversions.id, { onDelete: 'cascade' }),
    sourceCipAccountId: integer('source_cip_account_id')
      .notNull()
      .references(() => accounts.id),
    sourceCostCodeId: integer('source_cost_code_id').references(
      () => cipCostCodes.id
    ),
    targetFixedAssetId: integer('target_fixed_asset_id')
      .notNull()
      .references(() => fixedAssets.id),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('cip_conversion_lines_conversion_id_idx').on(table.conversionId),
  ]
)
