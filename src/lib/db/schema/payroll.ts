import {
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { payrollRunStatusEnum } from './enums'
import { transactions } from './transactions'

export const payrollRuns = pgTable(
  'payroll_runs',
  {
    id: serial('id').primaryKey(),
    payPeriodStart: date('pay_period_start', { mode: 'string' }).notNull(),
    payPeriodEnd: date('pay_period_end', { mode: 'string' }).notNull(),
    status: payrollRunStatusEnum('status').notNull().default('DRAFT'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    postedAt: timestamp('posted_at'),
  },
  (table) => [
    index('payroll_runs_period_idx').on(
      table.payPeriodStart,
      table.payPeriodEnd
    ),
  ]
)

export const payrollEntries = pgTable(
  'payroll_entries',
  {
    id: serial('id').primaryKey(),
    payrollRunId: integer('payroll_run_id')
      .notNull()
      .references(() => payrollRuns.id, { onDelete: 'cascade' }),
    employeeId: varchar('employee_id', { length: 255 }).notNull(),
    employeeName: varchar('employee_name', { length: 255 }).notNull(),
    grossPay: numeric('gross_pay', { precision: 12, scale: 2 }).notNull(),
    federalWithholding: numeric('federal_withholding', {
      precision: 12,
      scale: 2,
    }).notNull(),
    stateWithholding: numeric('state_withholding', {
      precision: 12,
      scale: 2,
    }).notNull(),
    socialSecurityEmployee: numeric('social_security_employee', {
      precision: 12,
      scale: 2,
    }).notNull(),
    medicareEmployee: numeric('medicare_employee', {
      precision: 12,
      scale: 2,
    }).notNull(),
    socialSecurityEmployer: numeric('social_security_employer', {
      precision: 12,
      scale: 2,
    }).notNull(),
    medicareEmployer: numeric('medicare_employer', {
      precision: 12,
      scale: 2,
    }).notNull(),
    netPay: numeric('net_pay', { precision: 12, scale: 2 }).notNull(),
    contractorType: varchar('contractor_type', { length: 10 }).default('W2'),
    fundAllocations: jsonb('fund_allocations').notNull(),
    glTransactionId: integer('gl_transaction_id').references(
      () => transactions.id
    ),
    glEmployerTransactionId: integer('gl_employer_transaction_id').references(
      () => transactions.id
    ),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('payroll_entries_run_idx').on(table.payrollRunId),
  ]
)
