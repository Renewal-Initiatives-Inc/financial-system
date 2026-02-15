import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { functionalAllocations } from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

export interface AllocationInput {
  accountId: number
  programPct: number
  adminPct: number
  fundraisingPct: number
  isPermanentRule: boolean
}

export interface AllocationRow {
  id: number
  fiscalYear: number
  accountId: number
  programPct: number
  adminPct: number
  fundraisingPct: number
  isPermanentRule: boolean
}

export interface BenchmarkComparison {
  riProgram: number
  riAdmin: number
  riFundraising: number
  peers: { name: string; program: number; admin: number; fundraising: number }[]
  industryMinProgram: number
  isBelowMinimum: boolean
  isOutlierHigh: boolean
}

/**
 * Fetch existing allocations for a fiscal year.
 */
export async function getAllocationsForYear(
  fiscalYear: number
): Promise<AllocationRow[]> {
  const rows = await db
    .select()
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, fiscalYear))

  return rows.map((r) => ({
    id: r.id,
    fiscalYear: r.fiscalYear,
    accountId: r.accountId,
    programPct: parseFloat(r.programPct),
    adminPct: parseFloat(r.adminPct),
    fundraisingPct: parseFloat(r.fundraisingPct),
    isPermanentRule: r.isPermanentRule,
  }))
}

/**
 * Bulk upsert allocations for a fiscal year.
 */
export async function saveAllocations(
  fiscalYear: number,
  allocations: AllocationInput[],
  userId: string
): Promise<{ saved: number }> {
  let saved = 0

  await db.transaction(async (tx) => {
    for (const alloc of allocations) {
      // Validate sum = 100
      const sum = alloc.programPct + alloc.adminPct + alloc.fundraisingPct
      if (Math.abs(sum - 100) > 0.01) {
        throw new Error(
          `Allocation for account ${alloc.accountId} sums to ${sum}, must be 100`
        )
      }

      // Check for existing
      const [existing] = await tx
        .select()
        .from(functionalAllocations)
        .where(
          and(
            eq(functionalAllocations.fiscalYear, fiscalYear),
            eq(functionalAllocations.accountId, alloc.accountId)
          )
        )

      if (existing) {
        await tx
          .update(functionalAllocations)
          .set({
            programPct: String(alloc.programPct),
            adminPct: String(alloc.adminPct),
            fundraisingPct: String(alloc.fundraisingPct),
            isPermanentRule: alloc.isPermanentRule,
            updatedAt: new Date(),
          })
          .where(eq(functionalAllocations.id, existing.id))

        await logAudit(tx as unknown as NeonHttpDatabase<any>, {
          userId,
          action: 'updated',
          entityType: 'functional_allocation',
          entityId: existing.id,
          beforeState: {
            programPct: existing.programPct,
            adminPct: existing.adminPct,
            fundraisingPct: existing.fundraisingPct,
          },
          afterState: {
            programPct: alloc.programPct,
            adminPct: alloc.adminPct,
            fundraisingPct: alloc.fundraisingPct,
          },
        })
      } else {
        const [inserted] = await tx
          .insert(functionalAllocations)
          .values({
            fiscalYear,
            accountId: alloc.accountId,
            programPct: String(alloc.programPct),
            adminPct: String(alloc.adminPct),
            fundraisingPct: String(alloc.fundraisingPct),
            isPermanentRule: alloc.isPermanentRule,
            createdBy: userId,
          })
          .returning({ id: functionalAllocations.id })

        await logAudit(tx as unknown as NeonHttpDatabase<any>, {
          userId,
          action: 'created',
          entityType: 'functional_allocation',
          entityId: inserted.id,
          afterState: {
            fiscalYear,
            accountId: alloc.accountId,
            programPct: alloc.programPct,
            adminPct: alloc.adminPct,
            fundraisingPct: alloc.fundraisingPct,
          },
        })
      }

      saved++
    }
  })

  return { saved }
}

/**
 * Compute benchmark comparison for RI's allocations vs peer orgs.
 */
export function computeBenchmarkComparison(
  allocations: { programPct: number; adminPct: number; fundraisingPct: number }[]
): BenchmarkComparison {
  if (allocations.length === 0) {
    return {
      riProgram: 0,
      riAdmin: 0,
      riFundraising: 0,
      peers: [],
      industryMinProgram: 65,
      isBelowMinimum: true,
      isOutlierHigh: false,
    }
  }

  // Simple average of all allocation rows
  const total = allocations.length
  const riProgram = Math.round(
    (allocations.reduce((s, a) => s + a.programPct, 0) / total) * 10
  ) / 10
  const riAdmin = Math.round(
    (allocations.reduce((s, a) => s + a.adminPct, 0) / total) * 10
  ) / 10
  const riFundraising = Math.round(
    (allocations.reduce((s, a) => s + a.fundraisingPct, 0) / total) * 10
  ) / 10

  // Peer benchmarks for comparable small housing nonprofits
  const peers = [
    { name: 'Falcon Housing', program: 82, admin: 14, fundraising: 4 },
    { name: 'Pioneer Valley Habitat', program: 78, admin: 18, fundraising: 4 },
    { name: 'Valley CDC', program: 75, admin: 20, fundraising: 5 },
  ]

  return {
    riProgram,
    riAdmin,
    riFundraising,
    peers,
    industryMinProgram: 65,
    isBelowMinimum: riProgram < 65,
    isOutlierHigh: riProgram > 90,
  }
}
