import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cipConversions, fundingSourceRateHistory } from '@/lib/db/schema'

// The 3 structures that must be converted for construction to be "complete"
const REQUIRED_STRUCTURES = ['Lodging', 'Barn', 'Garage']

export interface ConstructionStatus {
  isConstructionComplete: boolean
  structuresConverted: string[]
}

/**
 * Determine whether all structures have been converted from CIP to fixed assets.
 * Construction is complete when all 3 structures have conversion records.
 */
export async function getConstructionStatus(): Promise<ConstructionStatus> {
  const conversions = await db
    .select({ structureName: cipConversions.structureName })
    .from(cipConversions)

  const convertedNames = conversions.map((c) => c.structureName)

  const isComplete = REQUIRED_STRUCTURES.every((s) =>
    convertedNames.includes(s)
  )

  return {
    isConstructionComplete: isComplete,
    structuresConverted: convertedNames,
  }
}

/**
 * Look up the effective interest rate for a funding source at a given date.
 * Returns the most recent rate entry on or before the target date, or null.
 */
export async function getEffectiveRate(
  fundId: number,
  asOfDate: string
): Promise<number | null> {
  const [row] = await db
    .select({ rate: fundingSourceRateHistory.rate })
    .from(fundingSourceRateHistory)
    .where(
      and(
        eq(fundingSourceRateHistory.fundId, fundId),
        sql`${fundingSourceRateHistory.effectiveDate} <= ${asOfDate}`
      )
    )
    .orderBy(desc(fundingSourceRateHistory.effectiveDate))
    .limit(1)

  return row ? parseFloat(row.rate) : null
}

/**
 * Calculate interest for a given period using Actual/365 day-count convention.
 * Interest = principal * rate * (daysInPeriod / 365)
 */
export function calculatePeriodInterest(
  drawnAmount: number,
  interestRate: number,
  periodStartDate: string,
  periodEndDate: string
): number {
  if (drawnAmount <= 0 || interestRate <= 0) return 0

  const start = new Date(periodStartDate)
  const end = new Date(periodEndDate)
  const daysInPeriod = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysInPeriod <= 0) return 0

  const interest = drawnAmount * interestRate * (daysInPeriod / 365)
  return Math.round(interest * 100) / 100
}
