'use server'

import { db } from '@/lib/db'
import { funds } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { getActivitiesData as _getActivitiesData } from '@/lib/reports/activities'
import { getAuditLogData as _getAuditLogData } from '@/lib/reports/audit-log'
import { getBalanceSheetData as _getBalanceSheetData } from '@/lib/reports/balance-sheet'
import { getCapitalBudgetData as _getCapitalBudgetData } from '@/lib/reports/capital-budget'
import { getDonorGivingHistoryData as _getDonorGivingHistoryData } from '@/lib/reports/donor-giving-history'
import { getForm990Data as _getForm990Data } from '@/lib/reports/form-990-data'
import { getFunctionalExpensesData as _getFunctionalExpensesData } from '@/lib/reports/functional-expenses'
import { getFundLevelData as _getFundLevelData } from '@/lib/reports/fund-level'
import { getLateEntriesData as _getLateEntriesData } from '@/lib/reports/late-entries'
import { getRentCollectionData as _getRentCollectionData } from '@/lib/reports/rent-collection'
import { getTransactionHistoryData as _getTransactionHistoryData } from '@/lib/reports/transaction-history'

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
