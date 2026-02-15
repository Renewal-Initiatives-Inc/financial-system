import { getBalanceSheetData } from './balance-sheet'
import { getActivitiesData } from './activities'
import { getCashFlows } from './cash-flows'
import { getAHPLoanSummaryData } from './ahp-loan-summary'
import type { BalanceSheetData } from './balance-sheet'
import type { ActivitiesData } from './activities'
import type { CashFlowsData } from './cash-flows'
import type { AHPLoanSummaryData } from './ahp-loan-summary'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AHPAnnualPackageData {
  fiscalYear: number
  balanceSheet: BalanceSheetData
  activities: ActivitiesData
  cashFlows: CashFlowsData
  loanSummary: AHPLoanSummaryData
  generatedAt: string
}

export interface AHPAnnualPackageFilters {
  fiscalYear?: number
}

// ---------------------------------------------------------------------------
// Main query — orchestrator that calls existing report functions
// ---------------------------------------------------------------------------

export async function getAHPAnnualPackageData(
  filters?: AHPAnnualPackageFilters
): Promise<AHPAnnualPackageData> {
  const now = new Date().toISOString()
  const fiscalYear = filters?.fiscalYear ?? new Date().getFullYear()
  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`

  // Fetch all sub-reports in parallel
  const [balanceSheet, activities, cashFlows, loanSummary] = await Promise.all([
    getBalanceSheetData({ endDate }),
    getActivitiesData({ startDate, endDate }),
    getCashFlows({ startDate, endDate }),
    getAHPLoanSummaryData(),
  ])

  return {
    fiscalYear,
    balanceSheet,
    activities,
    cashFlows,
    loanSummary,
    generatedAt: now,
  }
}
