/**
 * Ramp sync health status query.
 *
 * Powers the dashboard "Alerts/Attention" section for uncategorized Ramp transactions.
 */

import { eq, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rampTransactions } from '@/lib/db/schema'

export async function getRampSyncStatus(): Promise<{
  lastSyncAt: Date | null
  uncategorizedCount: number
  syncHealthy: boolean
}> {
  // Get the most recent sync timestamp
  const [latest] = await db
    .select({ syncedAt: rampTransactions.syncedAt })
    .from(rampTransactions)
    .orderBy(desc(rampTransactions.syncedAt))
    .limit(1)

  const lastSyncAt = latest?.syncedAt ?? null

  // Count uncategorized transactions
  const [uncategorized] = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(rampTransactions)
    .where(eq(rampTransactions.status, 'uncategorized'))

  const uncategorizedCount = uncategorized?.count ?? 0

  // Healthy if last sync was within 36 hours
  const syncHealthy = lastSyncAt
    ? Date.now() - lastSyncAt.getTime() < 36 * 60 * 60 * 1000
    : false

  return { lastSyncAt, uncategorizedCount, syncHealthy }
}
