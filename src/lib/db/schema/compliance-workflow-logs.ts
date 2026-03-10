import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { workflowStepEnum } from './enums'

export const complianceWorkflowLogs = pgTable(
  'compliance_workflow_logs',
  {
    id: serial('id').primaryKey(),
    deadlineId: integer('deadline_id').notNull(),
    step: workflowStepEnum('step').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('compliance_workflow_logs_deadline_idx').on(table.deadlineId),
    index('compliance_workflow_logs_created_at_idx').on(table.createdAt),
  ]
)
