import {
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { poStatusEnum } from './enums'
import { vendors } from './vendors'
import { accounts } from './accounts'
import { funds } from './funds'
import { cipCostCodes } from './cip-cost-codes'

export const purchaseOrders = pgTable(
  'purchase_orders',
  {
    id: serial('id').primaryKey(),
    vendorId: integer('vendor_id')
      .notNull()
      .references(() => vendors.id),
    description: text('description').notNull(),
    contractPdfUrl: text('contract_pdf_url'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
    glDestinationAccountId: integer('gl_destination_account_id')
      .notNull()
      .references(() => accounts.id),
    fundId: integer('fund_id')
      .notNull()
      .references(() => funds.id),
    cipCostCodeId: integer('cip_cost_code_id').references(
      () => cipCostCodes.id
    ),
    status: poStatusEnum('status').notNull().default('DRAFT'),
    extractedMilestones: jsonb('extracted_milestones'),
    extractedTerms: jsonb('extracted_terms'),
    extractedCovenants: jsonb('extracted_covenants'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('purchase_orders_vendor_id_idx').on(table.vendorId),
    index('purchase_orders_status_idx').on(table.status),
    index('purchase_orders_fund_id_idx').on(table.fundId),
  ]
)
