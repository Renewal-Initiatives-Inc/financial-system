import type { Account, Fund } from './types'
import type { TransactionLine } from '@/lib/validators'

export type RestrictedFundExpense = {
  fundId: number
  amount: number
}

/**
 * INV-007: Detect expense lines debiting restricted funds.
 *
 * Triggers when ALL three conditions are met:
 * 1. The line has a debit (expense side)
 * 2. The account type is EXPENSE
 * 3. The fund's restrictionType is RESTRICTED
 *
 * Returns one entry per unique fund, with amounts consolidated.
 */
export function detectRestrictedFundExpenses(
  lines: TransactionLine[],
  accountMap: Map<number, Account>,
  fundMap: Map<number, Fund>
): RestrictedFundExpense[] {
  const fundTotals = new Map<number, number>()

  for (const line of lines) {
    if (line.debit == null || line.debit <= 0) continue

    const account = accountMap.get(line.accountId)
    if (!account || account.type !== 'EXPENSE') continue

    const fund = fundMap.get(line.fundId)
    if (!fund || fund.restrictionType !== 'RESTRICTED') continue

    const current = fundTotals.get(line.fundId) ?? 0
    fundTotals.set(line.fundId, current + line.debit)
  }

  return Array.from(fundTotals.entries()).map(([fundId, amount]) => ({
    fundId,
    amount,
  }))
}

/**
 * Build net asset release lines from detected restricted fund expenses.
 *
 * For each restricted fund expense:
 *   DR Net Assets With Donor Restrictions (3100) — same fund, same amount
 *   CR Net Assets Without Donor Restrictions (3000) — same fund, same amount
 */
export function buildReleaseLines(
  expenses: RestrictedFundExpense[],
  netAssetAccounts: { unrestricted: Account; restricted: Account }
): TransactionLine[] {
  const lines: TransactionLine[] = []

  for (const expense of expenses) {
    // DR Net Assets With Donor Restrictions (3100)
    lines.push({
      accountId: netAssetAccounts.restricted.id,
      fundId: expense.fundId,
      debit: expense.amount,
      credit: null,
      cipCostCodeId: null,
      memo: null,
    })

    // CR Net Assets Without Donor Restrictions (3000)
    lines.push({
      accountId: netAssetAccounts.unrestricted.id,
      fundId: expense.fundId,
      debit: null,
      credit: expense.amount,
      cipCostCodeId: null,
      memo: null,
    })
  }

  return lines
}
