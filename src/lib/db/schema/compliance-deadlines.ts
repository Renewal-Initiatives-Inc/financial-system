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
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
