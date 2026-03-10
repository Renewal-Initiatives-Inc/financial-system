import {
  boolean,
  date,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import {
  complianceDeadlineCategoryEnum,
  complianceDeadlineRecurrenceEnum,
  complianceDeadlineStatusEnum,
  workflowStateEnum,
  workflowTypeEnum,
} from './enums'

export const complianceDeadlines = pgTable('compliance_deadlines', {
  id: serial('id').primaryKey(),
  taskName: varchar('task_name', { length: 255 }).notNull(),
  dueDate: date('due_date').notNull(),
  category: complianceDeadlineCategoryEnum('category').notNull(),
  recurrence: complianceDeadlineRecurrenceEnum('recurrence').notNull(),
  status: complianceDeadlineStatusEnum('status').notNull().default('upcoming'),
  hasReminder30dSent: boolean('reminder_30d_sent').notNull().default(false),
  hasReminder7dSent: boolean('reminder_7d_sent').notNull().default(false),
  tenantId: integer('tenant_id'),
  fundId: integer('fund_id'),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  // Workflow state tracking
  workflowState: workflowStateEnum('workflow_state').notNull().default('not_started'),
  workflowType: workflowTypeEnum('workflow_type'),
  isReminder: boolean('is_reminder').notNull().default(false),
  parentDeadlineId: integer('parent_deadline_id'),
  googleEventId: varchar('google_event_id', { length: 255 }),
  googleReminderEventId: varchar('google_reminder_event_id', { length: 255 }),
  // Rich metadata for detail cards
  legalCitation: text('legal_citation'),
  referenceUrl: text('reference_url'),
  recommendedActions: text('recommended_actions'),
  authoritySource: varchar('authority_source', { length: 100 }),
})
