import type { CopilotContextPackage } from '../types'
import { getAccountsContext } from './accounts'
import { getFundsContext } from './funds'
import { getDashboardContext } from './dashboard'
import { getTransactionsContext } from './transactions'
import { getVendorsContext } from './vendors'
import { getTenantsContext } from './tenants'
import { getDonorsContext } from './donors'
import { getRevenueContext } from './revenue'
import { getExpensesContext } from './expenses'
import { getRampContext } from './ramp'
import { getPayrollContext } from './payroll'
import { getAssetsContext } from './assets'
import { getBankRecContext } from './bank-rec'
import { getBudgetsContext } from './budgets'
import { getReportsContext } from './reports'
import { getComplianceContext } from './compliance'
import { getMigrationReviewContext } from './migration-review'

type ContextFactory = (data?: Record<string, unknown>) => CopilotContextPackage

/** Registry mapping page IDs to context package factories */
const contextRegistry: Record<string, ContextFactory> = {
  dashboard: getDashboardContext,
  accounts: getAccountsContext,
  funds: getFundsContext,
  transactions: getTransactionsContext,
  vendors: getVendorsContext,
  tenants: getTenantsContext,
  donors: getDonorsContext,
  revenue: getRevenueContext,
  expenses: getExpensesContext,
  ramp: getRampContext,
  payroll: getPayrollContext,
  assets: getAssetsContext,
  'bank-rec': getBankRecContext,
  budgets: getBudgetsContext,
  reports: getReportsContext,
  compliance: getComplianceContext,
  'migration-review': getMigrationReviewContext,
}

/**
 * Get the context package for a given page.
 * Optionally pass page-specific data to inject into the context.
 */
export function getContextForPage(
  pageId: string,
  data?: Record<string, unknown>
): CopilotContextPackage {
  const factory = contextRegistry[pageId]
  if (!factory) {
    return {
      pageId,
      pageDescription: `User is viewing the ${pageId} page.`,
      data: data || {},
      tools: [],
      knowledge: ['fund-accounting'],
    }
  }
  return factory(data)
}

export function getRegisteredPageIds(): string[] {
  return Object.keys(contextRegistry)
}
