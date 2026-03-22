import { and, eq, gte, lte, ne, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
} from '@/lib/db/schema'

// ── Types ──

export interface FundClosingEntry {
  fundId: number
  fundName: string
  restrictionType: 'RESTRICTED' | 'UNRESTRICTED'
  revenueLines: {
    accountId: number
    accountCode: string
    accountName: string
    amount: number // positive = revenue earned
  }[]
  expenseLines: {
    accountId: number
    accountCode: string
    accountName: string
    amount: number // positive = expense incurred
  }[]
  netToRetainedEarnings: number // positive = surplus, negative = deficit
  retainedEarningsAccountId: number
  retainedEarningsAccountCode: string
}

export interface ClosingEntriesPreview {
  fiscalYear: number
  funds: FundClosingEntry[]
  totalNetChange: number
}

// ── Computation ──

/**
 * Computes closing journal entries for a given fiscal year.
 * Pure read — no DB writes. Returns a preview for the wizard to display.
 *
 * Logic per fund:
 * - Sum each REVENUE account balance (credit − debit for the period = positive revenue)
 * - Sum each EXPENSE account balance (debit − credit for the period = positive expense)
 * - netToRetainedEarnings = totalRevenue − totalExpense
 * - Route to account 3000 (UNRESTRICTED) or 3100 (RESTRICTED) based on fund.restrictionType
 *
 * Excludes voided transactions and YEAR_END_CLOSE entries (idempotent recompute).
 */
export async function computeClosingEntries(
  fiscalYear: number
): Promise<ClosingEntriesPreview> {
  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`

  // Get retained earnings accounts (3000 = unrestricted, 3100 = restricted)
  const reAccounts = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(inArray(accounts.code, ['3000', '3100']))

  const reAccountMap = new Map(reAccounts.map((a) => [a.code, a]))
  const re3000 = reAccountMap.get('3000')
  const re3100 = reAccountMap.get('3100')

  if (!re3000 || !re3100) {
    throw new Error(
      'Retained earnings accounts 3000 and/or 3100 not found. Cannot compute closing entries.'
    )
  }

  // Query all revenue and expense activity for the fiscal year, grouped by fund and account.
  // Excludes voided transactions and any prior YEAR_END_CLOSE entries.
  const rows = await db
    .select({
      fundId: transactionLines.fundId,
      fundName: funds.name,
      fundRestrictionType: funds.restrictionType,
      accountId: transactionLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      totalDebit: sql<string>`coalesce(sum(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(
      and(
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        eq(transactions.isVoided, false),
        ne(transactions.sourceType, 'YEAR_END_CLOSE'),
        inArray(accounts.type, ['REVENUE', 'EXPENSE'])
      )
    )
    .groupBy(
      transactionLines.fundId,
      funds.name,
      funds.restrictionType,
      transactionLines.accountId,
      accounts.code,
      accounts.name,
      accounts.type
    )

  // Group by fund
  const fundMap = new Map<
    number,
    {
      fundId: number
      fundName: string
      restrictionType: 'RESTRICTED' | 'UNRESTRICTED'
      revenueLines: FundClosingEntry['revenueLines']
      expenseLines: FundClosingEntry['expenseLines']
    }
  >()

  for (const row of rows) {
    let fund = fundMap.get(row.fundId)
    if (!fund) {
      fund = {
        fundId: row.fundId,
        fundName: row.fundName,
        restrictionType: row.fundRestrictionType as 'RESTRICTED' | 'UNRESTRICTED',
        revenueLines: [],
        expenseLines: [],
      }
      fundMap.set(row.fundId, fund)
    }

    const totalDebit = parseFloat(row.totalDebit)
    const totalCredit = parseFloat(row.totalCredit)

    if (row.accountType === 'REVENUE') {
      // Revenue balance = credit − debit (positive = revenue earned)
      const amount = totalCredit - totalDebit
      if (amount !== 0) {
        fund.revenueLines.push({
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          amount,
        })
      }
    } else if (row.accountType === 'EXPENSE') {
      // Expense balance = debit − credit (positive = expense incurred)
      const amount = totalDebit - totalCredit
      if (amount !== 0) {
        fund.expenseLines.push({
          accountId: row.accountId,
          accountCode: row.accountCode,
          accountName: row.accountName,
          amount,
        })
      }
    }
  }

  // Build closing entries per fund
  const fundEntries: FundClosingEntry[] = []
  let totalNetChange = 0

  for (const fund of fundMap.values()) {
    const totalRevenue = fund.revenueLines.reduce((sum, l) => sum + l.amount, 0)
    const totalExpense = fund.expenseLines.reduce((sum, l) => sum + l.amount, 0)
    const netToRetainedEarnings = totalRevenue - totalExpense

    // Only include funds with non-zero activity
    if (totalRevenue === 0 && totalExpense === 0) continue

    const isRestricted = fund.restrictionType === 'RESTRICTED'
    const reAccount = isRestricted ? re3100 : re3000

    fundEntries.push({
      fundId: fund.fundId,
      fundName: fund.fundName,
      restrictionType: fund.restrictionType,
      revenueLines: fund.revenueLines,
      expenseLines: fund.expenseLines,
      netToRetainedEarnings: Math.round(netToRetainedEarnings * 100) / 100,
      retainedEarningsAccountId: reAccount.id,
      retainedEarningsAccountCode: reAccount.code,
    })

    totalNetChange += netToRetainedEarnings
  }

  return {
    fiscalYear,
    funds: fundEntries,
    totalNetChange: Math.round(totalNetChange * 100) / 100,
  }
}
