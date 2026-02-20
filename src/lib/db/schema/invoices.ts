import {
  date,
  index,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { invoicePaymentStatusEnum } from './enums'
import { purchaseOrders } from './purchase-orders'
import { vendors } from './vendors'
import { transactions } from './transactions'
import { funds } from './funds'

export const invoices = pgTable(
  'invoices',
  {
    id: serial('id').primaryKey(),
    // 'AP' = accounts payable (vendor invoice against PO)
    // 'AR' = accounts receivable (billing a funder)
    direction: varchar('direction', { length: 2 }).notNull().default('AP'),
    purchaseOrderId: integer('purchase_order_id').references(
      () => purchaseOrders.id
    ),
    fundId: integer('fund_id').references(() => funds.id),
    vendorId: integer('vendor_id').references(() => vendors.id),
    invoiceNumber: varchar('invoice_number', { length: 100 }),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    glTransactionId: integer('gl_transaction_id').references(
      () => transactions.id
    ),
    paymentStatus: invoicePaymentStatusEnum('payment_status')
      .notNull()
      .default('PENDING'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('invoices_purchase_order_id_idx').on(table.purchaseOrderId),
    index('invoices_vendor_id_idx').on(table.vendorId),
    index('invoices_payment_status_idx').on(table.paymentStatus),
    index('invoices_fund_id_idx').on(table.fundId),
    index('invoices_direction_idx').on(table.direction),
  ]
)
