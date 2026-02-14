import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { funds } from '@/lib/db/schema'
import { getBalanceSheetData, type BalanceSheetData } from './balance-sheet'
import { getActivitiesData, type ActivitiesData } from './activities'

export interface FundLevelData {
  fundId: number
  fundName: string
  restrictionType: string
  balanceSheet: BalanceSheetData
  activities: ActivitiesData
}

export async function getFundLevelData(
  fundId: number,
  endDate?: string
): Promise<FundLevelData> {
  const [fund] = await db.select().from(funds).where(eq(funds.id, fundId))
  if (!fund) throw new Error(`Fund ${fundId} not found`)

  const today = endDate ?? new Date().toISOString().split('T')[0]
  const year = parseInt(today.substring(0, 4))
  const startOfYear = `${year}-01-01`

  const [balanceSheet, activities] = await Promise.all([
    getBalanceSheetData({ endDate: today, fundId }),
    getActivitiesData({ startDate: startOfYear, endDate: today, fundId }),
  ])

  return {
    fundId: fund.id,
    fundName: fund.name,
    restrictionType: fund.restrictionType,
    balanceSheet,
    activities,
  }
}
