import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { auditActionEnum } from './enums'

export const auditLog = pgTable(
  'audit_log',
  {
    id: serial('id').primaryKey(),
    timestamp: timestamp('timestamp').notNull().defaultNow(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    action: auditActionEnum('action').notNull(),
    entityType: varchar('entity_type', { length: 50 }).notNull(),
    entityId: integer('entity_id').notNull(),
    beforeState: jsonb('before_state'),
    afterState: jsonb('after_state').notNull(),
    metadata: jsonb('metadata'),
  },
  (table) => [
    index('audit_log_entity_idx').on(table.entityType, table.entityId),
    index('audit_log_timestamp_idx').on(table.timestamp),
  ]
)
