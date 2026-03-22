'use server'

import { eq, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { functionalAllocations, fiscalYearLocks } from '@/lib/db/schema'
import { getDefaultAllocations } from '@/lib/compliance/functional-defaults'
import {
  saveAllocations,
  getAllocationsForYear,
  computeBenchmarkComparison,
  type AllocationInput,
} from '@/lib/compliance/functional-allocation-logic'
import { getUserId } from '@/lib/auth'

export async function loadDefaults(fiscalYear: number) {
  const defaults = await getDefaultAllocations(fiscalYear)
  const existing = await getAllocationsForYear(fiscalYear)

  // Merge existing saved values over defaults
  const existingMap = new Map(existing.map((e) => [e.accountId, e]))

  const merged = defaults.map((d) => {
    const saved = existingMap.get(d.accountId)
    if (saved) {
      return {
        ...d,
        programPct: saved.programPct,
        adminPct: saved.adminPct,
        fundraisingPct: saved.fundraisingPct,
        isPermanentRule: saved.isPermanentRule,
        source: d.source,
      }
    }
    return d
  })

  return merged
}

export async function saveAllAllocations(
  fiscalYear: number,
  allocations: AllocationInput[]
) {
  const userId = await getUserId()
  const result = await saveAllocations(fiscalYear, allocations, userId)
  return result
}

export async function getBenchmark(
  allocations: { programPct: number; adminPct: number; fundraisingPct: number }[]
) {
  return computeBenchmarkComparison(allocations)
}

export interface FiscalYearAllocSummary {
  fiscalYear: number
  accountCount: number
  isLocked: boolean
  updatedAt: string | null
}

export async function getAllocationYearSummaries(): Promise<FiscalYearAllocSummary[]> {
  // Get years that have allocations
  const yearRows = await db
    .select({
      fiscalYear: functionalAllocations.fiscalYear,
      accountCount: sql<number>`count(*)::int`,
      updatedAt: sql<string>`max(${functionalAllocations.updatedAt})`,
    })
    .from(functionalAllocations)
    .groupBy(functionalAllocations.fiscalYear)
    .orderBy(desc(functionalAllocations.fiscalYear))

  // Get lock statuses
  const locks = await db
    .select({
      fiscalYear: fiscalYearLocks.fiscalYear,
      status: fiscalYearLocks.status,
    })
    .from(fiscalYearLocks)

  const lockMap = new Map(locks.map((l) => [l.fiscalYear, l.status === 'LOCKED']))

  return yearRows.map((r) => ({
    fiscalYear: r.fiscalYear,
    accountCount: r.accountCount,
    isLocked: lockMap.get(r.fiscalYear) ?? false,
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toLocaleDateString() : null,
  }))
}
