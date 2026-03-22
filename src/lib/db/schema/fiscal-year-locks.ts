import { integer, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core'
import { pgTable } from 'drizzle-orm/pg-core'

// fiscal_year integer — the 4-digit calendar year (e.g., 2025)
// status — 'LOCKED' or 'REOPENED'
// locked_at, locked_by — set when status becomes LOCKED
// reopened_at, reopened_by, reopen_reason — set when status becomes REOPENED (reason required)
// created_at — immutable row creation timestamp
export const fiscalYearLocks = pgTable('fiscal_year_locks', {
  id: serial('id').primaryKey(),
  fiscalYear: integer('fiscal_year').notNull().unique(),
  status: varchar('status', { length: 20 }).notNull(), // 'LOCKED' | 'REOPENED'
  lockedAt: timestamp('locked_at').notNull().defaultNow(),
  lockedBy: varchar('locked_by', { length: 255 }).notNull(),
  reopenedAt: timestamp('reopened_at'),
  reopenedBy: varchar('reopened_by', { length: 255 }),
  reopenReason: text('reopen_reason'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export type FiscalYearLock = typeof fiscalYearLocks.$inferSelect
export type NewFiscalYearLock = typeof fiscalYearLocks.$inferInsert
