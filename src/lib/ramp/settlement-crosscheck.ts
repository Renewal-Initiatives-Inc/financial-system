/**
 * Ramp settlement cross-check (REC-P0-014 foundation).
 *
 * Provides a summary of categorized+posted Ramp transactions for a period,
 * to be compared against the Ramp autopay settlement amount during bank rec (Phase 12).
 */

import { and, sql, gte, lte, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rampTransactions } from '@/lib/db/schema'

export async function getRampSettlementSummary(
  periodStart: string,
  periodEnd: string
): Promise<{
  totalCategorized: number
  transactionCount: number
}> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${rampTransactions.amount}), 0)`,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(rampTransactions)
    .where(
      and(
        gte(rampTransactions.date, periodStart),
        lte(rampTransactions.date, periodEnd),
        ne(rampTransactions.status, 'uncategorized')
      )
    )

  return {
    totalCategorized: parseFloat(result[0]?.total ?? '0'),
    transactionCount: result[0]?.count ?? 0,
  }
}
