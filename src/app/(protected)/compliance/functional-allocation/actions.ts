'use server'

import { getDefaultAllocations } from '@/lib/compliance/functional-defaults'
import {
  saveAllocations,
  getAllocationsForYear,
  computeBenchmarkComparison,
  type AllocationInput,
} from '@/lib/compliance/functional-allocation-logic'

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
  const result = await saveAllocations(fiscalYear, allocations, 'system')
  return result
}

export async function getBenchmark(
  allocations: { programPct: number; adminPct: number; fundraisingPct: number }[]
) {
  return computeBenchmarkComparison(allocations)
}
