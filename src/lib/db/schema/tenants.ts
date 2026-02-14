import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { fundingSourceTypeEnum } from './enums'

export const tenants = pgTable(
  'tenants',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    unitNumber: varchar('unit_number', { length: 20 }).notNull(),
    leaseStart: date('lease_start'),
    leaseEnd: date('lease_end'),
    monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).notNull(),
    fundingSourceType: fundingSourceTypeEnum('funding_source_type').notNull(),
    moveInDate: date('move_in_date'),
    securityDepositAmount: numeric('security_deposit_amount', { precision: 12, scale: 2 }),
    escrowBankRef: varchar('escrow_bank_ref', { length: 255 }),
    depositDate: date('deposit_date'),
    interestRate: numeric('interest_rate', { precision: 5, scale: 4 }),
    statementOfConditionDate: date('statement_of_condition_date'),
    tenancyAnniversary: date('tenancy_anniversary'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('tenants_unit_number_idx').on(table.unitNumber),
    index('tenants_is_active_idx').on(table.isActive),
  ]
)
