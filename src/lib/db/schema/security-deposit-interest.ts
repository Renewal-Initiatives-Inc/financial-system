import {
  date,
  integer,
  numeric,
  pgTable,
  serial,
  timestamp,
} from 'drizzle-orm/pg-core'

export const securityDepositInterestPayments = pgTable(
  'security_deposit_interest_payments',
  {
    id: serial('id').primaryKey(),
    tenantId: integer('tenant_id').notNull(),
    periodStart: date('period_start').notNull(),
    periodEnd: date('period_end').notNull(),
    depositAmount: numeric('deposit_amount', { precision: 12, scale: 2 }).notNull(),
    interestRate: numeric('interest_rate', { precision: 5, scale: 4 }).notNull(),
    interestAmount: numeric('interest_amount', { precision: 12, scale: 2 }).notNull(),
    glTransactionId: integer('gl_transaction_id'),
    paidAt: timestamp('paid_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  }
)
