import {
  date,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const ahpLoanConfig = pgTable('ahp_loan_config', {
  id: serial('id').primaryKey(),
  creditLimit: numeric('credit_limit', { precision: 15, scale: 2 }).notNull(),
  currentDrawnAmount: numeric('current_drawn_amount', {
    precision: 15,
    scale: 2,
  })
    .notNull()
    .default('0'),
  currentInterestRate: numeric('current_interest_rate', {
    precision: 7,
    scale: 5,
  }).notNull(),
  rateEffectiveDate: date('rate_effective_date', { mode: 'string' }).notNull(),
  annualPaymentDate: varchar('annual_payment_date', { length: 5 })
    .notNull()
    .default('12-31'),
  lastPaymentDate: date('last_payment_date', { mode: 'string' }),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})
