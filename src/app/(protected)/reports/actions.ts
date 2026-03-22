'use server'

import { db } from '@/lib/db'
import { funds } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getActivitiesData as _getActivitiesData, getMultiPeriodActivitiesData as _getMultiPeriodActivitiesData } from '@/lib/reports/activities'
import { getAuditLogData as _getAuditLogData } from '@/lib/reports/audit-log'
import { getBalanceSheetData as _getBalanceSheetData } from '@/lib/reports/balance-sheet'
import { getCapitalBudgetData as _getCapitalBudgetData } from '@/lib/reports/capital-budget'
import { getDonorGivingHistoryData as _getDonorGivingHistoryData } from '@/lib/reports/donor-giving-history'
import { getForm990Data as _getForm990Data } from '@/lib/reports/form-990-data'
import { getFunctionalExpensesData as _getFunctionalExpensesData, getMultiPeriodFunctionalExpenses as _getMultiPeriodFunctionalExpenses } from '@/lib/reports/functional-expenses'
import { getFundLevelData as _getFundLevelData } from '@/lib/reports/fund-level'
import { getLateEntriesData as _getLateEntriesData } from '@/lib/reports/late-entries'
import { getRentCollectionData as _getRentCollectionData } from '@/lib/reports/rent-collection'
import { getTransactionHistoryData as _getTransactionHistoryData } from '@/lib/reports/transaction-history'
import { getCashFlows as _getCashFlows, getMultiPeriodCashFlows as _getMultiPeriodCashFlows } from '@/lib/reports/cash-flows'
import { getPropertyExpensesData as _getPropertyExpensesData, getMultiPeriodPropertyExpenses as _getMultiPeriodPropertyExpenses } from '@/lib/reports/property-expenses'
import { getQuarterlyTaxPrepData as _getQuarterlyTaxPrepData } from '@/lib/reports/quarterly-tax-prep'
import { getPayrollTaxLiabilityData as _getPayrollTaxLiabilityData } from '@/lib/reports/payroll-tax-liability'
import { getPayrollRegisterData as _getPayrollRegisterData } from '@/lib/reports/payroll-register'
import { getUtilityTrendsData as _getUtilityTrendsData } from '@/lib/reports/utility-trends'
import { getEmployerPayrollCostData as _getEmployerPayrollCostData } from '@/lib/reports/employer-payroll-cost'
import { getW2VerificationData as _getW2VerificationData } from '@/lib/reports/w2-verification'

export async function getFundsForFilter() {
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
      isActive: funds.isActive,
    })
    .from(funds)
    .where(eq(funds.isActive, true))
    .orderBy(funds.name)
}

// ---------------------------------------------------------------------------
// Report data server actions — thin wrappers so client components can call
// these via RPC instead of importing DB-dependent modules directly.
// ---------------------------------------------------------------------------

export async function getActivitiesData(
  ...args: Parameters<typeof _getActivitiesData>
) {
  return _getActivitiesData(...args)
}

export async function getMultiPeriodActivitiesData(
  ...args: Parameters<typeof _getMultiPeriodActivitiesData>
) {
  return _getMultiPeriodActivitiesData(...args)
}

export async function getAuditLogData(
  ...args: Parameters<typeof _getAuditLogData>
) {
  return _getAuditLogData(...args)
}

export async function getBalanceSheetData(
  ...args: Parameters<typeof _getBalanceSheetData>
) {
  return _getBalanceSheetData(...args)
}

export async function getCapitalBudgetData(
  ...args: Parameters<typeof _getCapitalBudgetData>
) {
  return _getCapitalBudgetData(...args)
}

export async function getDonorGivingHistoryData(
  ...args: Parameters<typeof _getDonorGivingHistoryData>
) {
  return _getDonorGivingHistoryData(...args)
}

export async function getForm990Data(
  ...args: Parameters<typeof _getForm990Data>
) {
  return _getForm990Data(...args)
}

export async function getFunctionalExpensesData(
  ...args: Parameters<typeof _getFunctionalExpensesData>
) {
  return _getFunctionalExpensesData(...args)
}

export async function getFundLevelData(
  ...args: Parameters<typeof _getFundLevelData>
) {
  return _getFundLevelData(...args)
}

export async function getLateEntriesData(
  ...args: Parameters<typeof _getLateEntriesData>
) {
  return _getLateEntriesData(...args)
}

export async function getRentCollectionData(
  ...args: Parameters<typeof _getRentCollectionData>
) {
  return _getRentCollectionData(...args)
}

export async function getTransactionHistoryData(
  ...args: Parameters<typeof _getTransactionHistoryData>
) {
  return _getTransactionHistoryData(...args)
}

export async function getCashFlowsData(
  ...args: Parameters<typeof _getCashFlows>
) {
  return _getCashFlows(...args)
}

export async function getMultiPeriodCashFlowsData(
  ...args: Parameters<typeof _getMultiPeriodCashFlows>
) {
  return _getMultiPeriodCashFlows(...args)
}

export async function getMultiPeriodFunctionalExpensesData(
  ...args: Parameters<typeof _getMultiPeriodFunctionalExpenses>
) {
  return _getMultiPeriodFunctionalExpenses(...args)
}

export async function getPropertyExpensesServerData(
  ...args: Parameters<typeof _getPropertyExpensesData>
) {
  return _getPropertyExpensesData(...args)
}

export async function getMultiPeriodPropertyExpensesData(
  ...args: Parameters<typeof _getMultiPeriodPropertyExpenses>
) {
  return _getMultiPeriodPropertyExpenses(...args)
}

// --- Cash Projection Regeneration ---

export async function saveMonthlyOverrideAction(
  projectionId: number,
  lineId: number,
  overrideAmount: number | null
): Promise<{ success: true } | { error: string }> {
  // Monthly view is now derived from weekly lines, so save to the same table
  return saveWeeklyOverrideAction(projectionId, lineId, overrideAmount)
}

export async function saveWeeklyOverrideAction(
  projectionId: number,
  lineId: number,
  overrideAmount: number | null
): Promise<{ success: true } | { error: string }> {
  try {
    const { eq } = await import('drizzle-orm')
    const { db } = await import('@/lib/db')
    const { weeklyCashProjectionLines } = await import('@/lib/db/schema')

    await db
      .update(weeklyCashProjectionLines)
      .set({
        overrideAmount: overrideAmount !== null ? overrideAmount.toFixed(2) : null,
      })
      .where(eq(weeklyCashProjectionLines.id, lineId))

    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save override' }
  }
}

export async function regenerateMonthlyProjectionAction(): Promise<
  { success: true } | { error: string }
> {
  // Monthly view is derived from weekly data — regenerating weekly is sufficient.
  // This is a no-op; the Regenerate button calls both, so weekly handles it.
  return { success: true }
}

// Keep the old monthly generation code for reference but unused
async function _legacyRegenerateMonthly(): Promise<
  { success: true } | { error: string }
> {
  try {
    const { generateProjectionLines, getStartingCash } = await import(
      '@/lib/budget/projection'
    )
    const {
      createCashProjection,
      saveCashProjectionLines,
      getBudgetByFiscalYear,
    } = await import('@/lib/budget/queries')

    const now = new Date()
    const fiscalYear = now.getFullYear()
    const startMonth = now.getMonth() + 2
    const asOfDate = now.toISOString().split('T')[0]

    const budget = await getBudgetByFiscalYear(fiscalYear)
    const monthlyData = await generateProjectionLines(startMonth, budget?.id)
    const startingCash = await getStartingCash()

    const projection = await createCashProjection({
      fiscalYear,
      asOfDate,
      createdBy: 'report-regenerate',
    })

    const allLines: {
      month: number
      sourceLabel: string
      autoAmount: number
      lineType: 'INFLOW' | 'OUTFLOW'
      sortOrder: number
    }[] = []

    for (const md of monthlyData) {
      allLines.push({
        month: md.month,
        sourceLabel: 'Starting Cash',
        autoAmount: startingCash,
        lineType: 'INFLOW',
        sortOrder: -1,
      })
      for (const line of md.lines) {
        allLines.push({ month: md.month, ...line })
      }
    }

    await saveCashProjectionLines(projection.id, allLines)
    return { success: true }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to regenerate monthly projection',
    }
  }
}

export async function regenerateWeeklyProjectionAction(): Promise<
  { success: true } | { error: string }
> {
  try {
    const { generateWeeklyProjection } = await import(
      '@/lib/budget/weekly-projection'
    )
    const { getStartingCash } = await import('@/lib/budget/projection')
    const {
      createWeeklyCashProjection,
      saveWeeklyCashProjectionLines,
    } = await import('@/lib/budget/queries')

    const now = new Date()
    const fiscalYear = now.getFullYear()
    const asOfDate = now.toISOString().split('T')[0]

    const lines = await generateWeeklyProjection(fiscalYear)
    const projection = await createWeeklyCashProjection({
      fiscalYear,
      asOfDate,
      createdBy: 'report-regenerate',
    })

    await saveWeeklyCashProjectionLines(projection.id, lines)
    return { success: true }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to regenerate weekly projection',
    }
  }
}

export async function getQuarterlyTaxPrepData(
  ...args: Parameters<typeof _getQuarterlyTaxPrepData>
) {
  return _getQuarterlyTaxPrepData(...args)
}

export async function getPayrollTaxLiabilityData(
  ...args: Parameters<typeof _getPayrollTaxLiabilityData>
) {
  return _getPayrollTaxLiabilityData(...args)
}

export async function getPayrollRegisterData(
  ...args: Parameters<typeof _getPayrollRegisterData>
) {
  return _getPayrollRegisterData(...args)
}

export async function getUtilityTrendsData(
  ...args: Parameters<typeof _getUtilityTrendsData>
) {
  return _getUtilityTrendsData(...args)
}

export async function getEmployerPayrollCostData(
  ...args: Parameters<typeof _getEmployerPayrollCostData>
) {
  return _getEmployerPayrollCostData(...args)
}

export async function getW2VerificationData(
  ...args: Parameters<typeof _getW2VerificationData>
) {
  return _getW2VerificationData(...args)
}
