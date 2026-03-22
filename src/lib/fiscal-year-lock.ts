import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { fiscalYearLocks } from '@/lib/db/schema'

/**
 * Returns array of currently locked fiscal years (status = 'LOCKED').
 * REOPENED years are NOT included — they are open.
 */
export async function getLockedYears(): Promise<number[]> {
  try {
    const rows = await db
      .select({ fiscalYear: fiscalYearLocks.fiscalYear })
      .from(fiscalYearLocks)
      .where(eq(fiscalYearLocks.status, 'LOCKED'))
    return rows.map((r) => r.fiscalYear)
  } catch {
    // Table may not exist yet (migration 0028 not applied)
    return []
  }
}

/**
 * Returns true if a LOCKED record exists for the given year.
 * No record = open. REOPENED = open.
 */
export async function isYearLocked(year: number): Promise<boolean> {
  try {
    const [row] = await db
      .select({ status: fiscalYearLocks.status })
      .from(fiscalYearLocks)
      .where(eq(fiscalYearLocks.fiscalYear, year))
    if (!row) return false
    return row.status === 'LOCKED'
  } catch {
    // Table may not exist yet (migration 0028 not applied) — treat as unlocked
    return false
  }
}

/**
 * Inserts or updates a fiscal_year_locks record to LOCKED status.
 * Idempotent — calling twice for the same year updates, doesn't create duplicates.
 */
export async function lockYear(
  year: number,
  lockedBy: string
): Promise<void> {
  const [existing] = await db
    .select({ id: fiscalYearLocks.id })
    .from(fiscalYearLocks)
    .where(eq(fiscalYearLocks.fiscalYear, year))

  if (existing) {
    await db
      .update(fiscalYearLocks)
      .set({
        status: 'LOCKED',
        lockedAt: new Date(),
        lockedBy,
        reopenedAt: null,
        reopenedBy: null,
        reopenReason: null,
      })
      .where(eq(fiscalYearLocks.fiscalYear, year))
  } else {
    await db.insert(fiscalYearLocks).values({
      fiscalYear: year,
      status: 'LOCKED',
      lockedBy,
    })
  }
}

/**
 * Updates a fiscal year lock to REOPENED status.
 * Requires a non-blank reason.
 */
export async function reopenYear(
  year: number,
  reopenedBy: string,
  reason: string
): Promise<void> {
  if (!reason || !reason.trim()) {
    throw new Error('A reason is required to reopen a fiscal year')
  }

  await db
    .update(fiscalYearLocks)
    .set({
      status: 'REOPENED',
      reopenedAt: new Date(),
      reopenedBy,
      reopenReason: reason.trim(),
    })
    .where(eq(fiscalYearLocks.fiscalYear, year))
}

/**
 * Parses a YYYY-MM-DD date string and returns the year as integer.
 */
export function getFiscalYearFromDate(date: string): number {
  const year = parseInt(date.substring(0, 4), 10)
  if (isNaN(year)) {
    throw new Error(`Invalid date format: ${date}`)
  }
  return year
}
