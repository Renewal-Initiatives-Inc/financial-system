import { db } from '@/lib/db'
import { accounts, transactions, transactionLines, funds } from '@/lib/db/schema'
import { eq, and, lte, gte, inArray, isNull, sql } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashFlowLine {
  label: string
  amount: number
  indent?: number
  isSubtotal?: boolean
  isTotal?: boolean
}

export interface CashFlowSection {
  title: string
  lines: CashFlowLine[]
  subtotal: number
}

export interface CashFlowsData {
  startDate: string
  endDate: string
  operating: CashFlowSection
  investing: CashFlowSection
  financing: CashFlowSection
  netChangeInCash: number
  beginningCash: number
  endingCash: number
  fundName: string | null
}

export interface CashFlowsFilters {
  startDate: string
  endDate: string
  fundId?: number | null
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch account IDs whose type and/or subType match the given criteria.
 */
async function getAccountIdsByFilter(
  type?: string,
  subTypes?: string[]
): Promise<number[]> {
  const conditions = []
  if (type) {
    conditions.push(eq(accounts.type, type as 'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE'))
  }
  if (subTypes && subTypes.length > 0) {
    conditions.push(inArray(accounts.subType, subTypes))
  }

  const rows = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)

  return rows.map((r) => r.id)
}

/**
 * Get the balance for a set of accounts as of a given date (inclusive).
 * Balance = debits - credits for DEBIT-normal accounts,
 *           credits - debits for CREDIT-normal accounts.
 *
 * Sums across all provided accounts, respecting each account's normalBalance.
 * Excludes voided transactions.
 */
async function getBalanceAsOf(
  accountIds: number[],
  asOfDate: string,
  fundId?: number | null
): Promise<number> {
  if (accountIds.length === 0) return 0

  const conditions = [
    inArray(transactionLines.accountId, accountIds),
    lte(transactions.date, asOfDate),
    eq(transactions.isVoided, false),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  // Join accounts to get normalBalance per line
  const rows = await db
    .select({
      normalBalance: accounts.normalBalance,
      totalDebit: sql<string>`coalesce(sum(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(accounts.normalBalance)

  let balance = 0
  for (const row of rows) {
    const debits = Number(row.totalDebit)
    const credits = Number(row.totalCredit)
    if (row.normalBalance === 'DEBIT') {
      balance += debits - credits
    } else {
      balance += credits - debits
    }
  }

  return balance
}

/**
 * Get the net activity (debits total, credits total) for a set of accounts
 * within a date range. Returns the sum of debits in the period.
 */
async function getPeriodDebits(
  accountIds: number[],
  startDate: string,
  endDate: string,
  fundId?: number | null
): Promise<number> {
  if (accountIds.length === 0) return 0

  const conditions = [
    inArray(transactionLines.accountId, accountIds),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    eq(transactions.isVoided, false),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  const [row] = await db
    .select({
      totalDebit: sql<string>`coalesce(sum(${transactionLines.debit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(and(...conditions))

  return Number(row?.totalDebit ?? 0)
}

/**
 * Get net income for the period: (revenues - expenses).
 * Revenue accounts are CREDIT-normal => balance = credits - debits.
 * Expense accounts are DEBIT-normal => balance = debits - credits.
 * Net income = revenue balance - expense balance (both computed for the period).
 */
async function getChangeInNetAssets(
  startDate: string,
  endDate: string,
  fundId?: number | null
): Promise<number> {
  const conditions = [
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    eq(transactions.isVoided, false),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  const rows = await db
    .select({
      accountType: accounts.type,
      normalBalance: accounts.normalBalance,
      totalDebit: sql<string>`coalesce(sum(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`coalesce(sum(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        inArray(accounts.type, ['REVENUE', 'EXPENSE']),
        ...conditions
      )
    )
    .groupBy(accounts.type, accounts.normalBalance)

  let revenue = 0
  let expense = 0

  for (const row of rows) {
    const debits = Number(row.totalDebit)
    const credits = Number(row.totalCredit)

    if (row.accountType === 'REVENUE') {
      // CREDIT-normal: balance = credits - debits
      revenue += credits - debits
    } else if (row.accountType === 'EXPENSE') {
      // DEBIT-normal: balance = debits - credits
      expense += debits - credits
    }
  }

  return revenue - expense
}

/**
 * Compute the day before a given date string (YYYY-MM-DD).
 */
function dayBefore(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

// ---------------------------------------------------------------------------
// Main report function
// ---------------------------------------------------------------------------

export async function getCashFlows(
  filters: CashFlowsFilters
): Promise<CashFlowsData> {
  const { startDate, endDate, fundId } = filters
  const beforeStart = dayBefore(startDate)

  // Resolve fund name if filtered
  let fundName: string | null = null
  if (fundId) {
    const [fund] = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, fundId))
    fundName = fund?.name ?? null
  }

  // -----------------------------------------------------------------------
  // Gather account IDs by category
  // -----------------------------------------------------------------------

  const [
    cashAccountIds,
    depreciationAccountIds,
    arAccountIds,
    prepaidAccountIds,
    apAccountIds,
    accruedLiabilityAccountIds,
    deferredRevenueAccountIds,
    cipAccountIds,
    fixedAssetAccountIds,
    ahpLoanAccountIds,
  ] = await Promise.all([
    getAccountIdsByFilter('ASSET', ['Cash', 'Cash and Cash Equivalents']),
    getAccountIdsByFilter('EXPENSE', ['Non-Cash', 'Depreciation']),
    getAccountIdsByFilter('ASSET', ['Accounts Receivable']),
    getAccountIdsByFilter('ASSET', ['Prepaid']),
    getAccountIdsByFilter('LIABILITY', ['Accounts Payable']),
    getAccountIdsByFilter('LIABILITY', ['Accrued', 'Payroll Payable']),
    getAccountIdsByFilter('LIABILITY', ['Deferred', 'Deferred Revenue']),
    getAccountIdsByFilter('ASSET', ['CIP']),
    getAccountIdsByFilter('ASSET', ['Fixed Asset', 'Property and Equipment']),
    getAccountIdsByFilter('LIABILITY', ['AHP Loan']),
  ])

  // -----------------------------------------------------------------------
  // Operating Activities
  // -----------------------------------------------------------------------

  const changeInNetAssets = await getChangeInNetAssets(startDate, endDate, fundId)

  // Non-cash adjustments: depreciation in the period (add back)
  const depreciationBeginning = await getBalanceAsOf(depreciationAccountIds, beforeStart, fundId)
  const depreciationEnding = await getBalanceAsOf(depreciationAccountIds, endDate, fundId)
  const depreciation = depreciationEnding - depreciationBeginning

  // Working capital changes
  const arBegin = await getBalanceAsOf(arAccountIds, beforeStart, fundId)
  const arEnd = await getBalanceAsOf(arAccountIds, endDate, fundId)
  const arChange = -(arEnd - arBegin) // asset increase = cash used (negative)

  const prepaidBegin = await getBalanceAsOf(prepaidAccountIds, beforeStart, fundId)
  const prepaidEnd = await getBalanceAsOf(prepaidAccountIds, endDate, fundId)
  const prepaidChange = -(prepaidEnd - prepaidBegin)

  const apBegin = await getBalanceAsOf(apAccountIds, beforeStart, fundId)
  const apEnd = await getBalanceAsOf(apAccountIds, endDate, fundId)
  const apChange = apEnd - apBegin // liability increase = cash provided (positive)

  const accruedBegin = await getBalanceAsOf(accruedLiabilityAccountIds, beforeStart, fundId)
  const accruedEnd = await getBalanceAsOf(accruedLiabilityAccountIds, endDate, fundId)
  const accruedChange = accruedEnd - accruedBegin

  const deferredBegin = await getBalanceAsOf(deferredRevenueAccountIds, beforeStart, fundId)
  const deferredEnd = await getBalanceAsOf(deferredRevenueAccountIds, endDate, fundId)
  const deferredChange = deferredEnd - deferredBegin

  const operatingLines: CashFlowLine[] = [
    { label: 'Change in Net Assets', amount: changeInNetAssets, indent: 0 },
    { label: 'Adjustments to reconcile to net cash:', amount: 0, indent: 0, isSubtotal: false },
    { label: 'Depreciation', amount: depreciation, indent: 1 },
  ]

  // Working capital adjustments — only include lines with non-zero amounts
  const workingCapitalItems: { label: string; amount: number }[] = [
    { label: '(Increase)/Decrease in Accounts Receivable', amount: arChange },
    { label: '(Increase)/Decrease in Prepaid Expenses', amount: prepaidChange },
    { label: 'Increase/(Decrease) in Accounts Payable', amount: apChange },
    { label: 'Increase/(Decrease) in Accrued Liabilities', amount: accruedChange },
    { label: 'Increase/(Decrease) in Deferred Revenue', amount: deferredChange },
  ]

  for (const item of workingCapitalItems) {
    operatingLines.push({ label: item.label, amount: item.amount, indent: 1 })
  }

  const operatingSubtotal =
    changeInNetAssets +
    depreciation +
    arChange +
    prepaidChange +
    apChange +
    accruedChange +
    deferredChange

  operatingLines.push({
    label: 'Net Cash from Operating Activities',
    amount: operatingSubtotal,
    isSubtotal: true,
  })

  // -----------------------------------------------------------------------
  // Investing Activities
  // -----------------------------------------------------------------------

  const cipDebits = await getPeriodDebits(cipAccountIds, startDate, endDate, fundId)
  const fixedAssetDebits = await getPeriodDebits(fixedAssetAccountIds, startDate, endDate, fundId)

  const investingLines: CashFlowLine[] = []
  if (cipDebits !== 0) {
    investingLines.push({ label: 'CIP Additions', amount: -cipDebits, indent: 1 })
  }
  if (fixedAssetDebits !== 0) {
    investingLines.push({ label: 'Purchase of Fixed Assets', amount: -fixedAssetDebits, indent: 1 })
  }

  const investingSubtotal = -cipDebits + -fixedAssetDebits

  investingLines.push({
    label: 'Net Cash from Investing Activities',
    amount: investingSubtotal,
    isSubtotal: true,
  })

  // -----------------------------------------------------------------------
  // Financing Activities
  // -----------------------------------------------------------------------

  const ahpBegin = await getBalanceAsOf(ahpLoanAccountIds, beforeStart, fundId)
  const ahpEnd = await getBalanceAsOf(ahpLoanAccountIds, endDate, fundId)
  const ahpNetChange = ahpEnd - ahpBegin

  const financingLines: CashFlowLine[] = []
  if (ahpNetChange !== 0) {
    financingLines.push({
      label: ahpNetChange >= 0 ? 'AHP Loan Proceeds' : 'AHP Loan Repayments',
      amount: ahpNetChange,
      indent: 1,
    })
  }

  const financingSubtotal = ahpNetChange

  financingLines.push({
    label: 'Net Cash from Financing Activities',
    amount: financingSubtotal,
    isSubtotal: true,
  })

  // -----------------------------------------------------------------------
  // Reconciliation
  // -----------------------------------------------------------------------

  const netChangeInCash = operatingSubtotal + investingSubtotal + financingSubtotal
  const beginningCash = await getBalanceAsOf(cashAccountIds, beforeStart, fundId)
  const endingCash = beginningCash + netChangeInCash

  return {
    startDate,
    endDate,
    operating: { title: 'Cash Flows from Operating Activities', lines: operatingLines, subtotal: operatingSubtotal },
    investing: { title: 'Cash Flows from Investing Activities', lines: investingLines, subtotal: investingSubtotal },
    financing: { title: 'Cash Flows from Financing Activities', lines: financingLines, subtotal: financingSubtotal },
    netChangeInCash,
    beginningCash,
    endingCash,
    fundName,
  }
}
