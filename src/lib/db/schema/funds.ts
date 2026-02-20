import {
  boolean,
  date,
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
import { fundRestrictionEnum, fundingTypeEnum, fundingStatusEnum } from './enums'

export const funds = pgTable(
  'funds',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 255 }).notNull().unique(),
    restrictionType: fundRestrictionEnum('restriction_type').notNull(),
    isActive: boolean('is_active').notNull().default(true),
    description: text('description'),
    isSystemLocked: boolean('is_system_locked').notNull().default(false),
    // Funding source fields (nullable — unrestricted funds don't need these)
    funderId: integer('funder_id'), // FK → vendors.id (defined in migration SQL, avoids circular import)
    amount: numeric('amount', { precision: 15, scale: 2 }),
    type: fundingTypeEnum('type'),
    conditions: text('conditions'),
    startDate: date('start_date', { mode: 'string' }),
    endDate: date('end_date', { mode: 'string' }),
    status: fundingStatusEnum('status').default('ACTIVE'),
    isUnusualGrant: boolean('is_unusual_grant').notNull().default(false),
    contractPdfUrl: text('contract_pdf_url'),
    extractedMilestones: jsonb('extracted_milestones'),
    extractedTerms: jsonb('extracted_terms'),
    extractedCovenants: jsonb('extracted_covenants'),
    matchRequirementPercent: numeric('match_requirement_percent', {
      precision: 5,
      scale: 2,
    }),
    retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }),
    reportingFrequency: varchar('reporting_frequency', { length: 50 }),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (table) => [
    index('funds_funder_id_idx').on(table.funderId),
    index('funds_status_idx').on(table.status),
  ]
)
