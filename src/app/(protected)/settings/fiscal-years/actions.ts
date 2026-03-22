'use server'

import { revalidatePath } from 'next/cache'
import { desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { fiscalYearLocks } from '@/lib/db/schema'
import { reopenYear } from '@/lib/fiscal-year-lock'
import { logAudit } from '@/lib/audit/logger'
import { getUserId } from '@/lib/auth'
import type { FiscalYearLock } from '@/lib/db/schema/fiscal-year-locks'

export async function getFiscalYearLocks(): Promise<FiscalYearLock[]> {
  return db
    .select()
    .from(fiscalYearLocks)
    .orderBy(desc(fiscalYearLocks.fiscalYear))
}

export async function reopenFiscalYear(
  year: number,
  reason: string
): Promise<void> {
  const userId = await getUserId()

  await reopenYear(year, userId, reason)

  // Write audit log entry
  await db.transaction(async (tx) => {
    await logAudit(tx as unknown as Parameters<typeof logAudit>[0], {
      userId,
      action: 'updated',
      entityType: 'fiscal_year_locks',
      entityId: year,
      beforeState: { status: 'LOCKED' },
      afterState: { status: 'REOPENED', reason },
    })
  })

  revalidatePath('/settings/fiscal-years')
}
