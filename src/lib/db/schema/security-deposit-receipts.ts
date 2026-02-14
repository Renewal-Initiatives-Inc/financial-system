import {
  date,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const securityDepositReceipts = pgTable('security_deposit_receipts', {
  id: serial('id').primaryKey(),
  tenantId: integer('tenant_id').notNull(),
  receiptType: varchar('receipt_type', { length: 50 }).notNull(),
  dueDate: date('due_date').notNull(),
  completedDate: date('completed_date'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
