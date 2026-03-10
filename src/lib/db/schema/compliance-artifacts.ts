import {
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'

export const complianceArtifacts = pgTable(
  'compliance_artifacts',
  {
    id: serial('id').primaryKey(),
    deadlineId: integer('deadline_id').notNull(),
    artifactType: varchar('artifact_type', { length: 50 }).notNull(),
    blobUrl: text('blob_url').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: integer('file_size'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('compliance_artifacts_deadline_idx').on(table.deadlineId),
    index('compliance_artifacts_created_at_idx').on(table.createdAt),
  ]
)
