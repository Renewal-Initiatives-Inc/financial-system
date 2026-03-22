import { eq, and, sql, lte, gte, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  funds,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BalanceSheetRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  balance: number
}

export interface BalanceSheetSection {
  title: string
  rows: BalanceSheetRow[]
  total: number
}

export interface BalanceSheetData {
  asOfDate: string
  currentAssets: BalanceSheetSection
  noncurrentAssets: BalanceSheetSection
  totalAssets: number
  currentLiabilities: BalanceSheetSection
  longTermLiabilities: BalanceSheetSection
  totalLiabilities: number
  netAssetsUnrestricted: BalanceSheetSection
  netAssetsRestricted: BalanceSheetSection
  totalNetAssets: number
  totalLiabilitiesAndNetAssets: number
  fundName: string | null
}

// ---------------------------------------------------------------------------
// SubType classification helpers
// ---------------------------------------------------------------------------

const CURRENT_ASSET_SUBTYPES = new Set([
  'Cash',
  'Receivable',          // actual value in DB (1100–1120)
  'Accounts Receivable', // legacy/compatibility
  'Prepaid',
  'Short-Term Investment',
])

const NONCURRENT_ASSET_SUBTYPES = new Set([
  'Fixed Asset',
  'CIP',
  'Contra',              // actual value in DB for depreciation accounts (1800–1830)
  'Accumulated Depreciation',
  'Long-Term Investment',
])

const CURRENT_LIABILITY_SUBTYPES = new Set([
  'Current',             // actual value in DB (2000–2060, 2520)
  'Payroll',             // actual value in DB (2100–2160)
  // legacy/compatibility
  'Accounts Payable',
  'Accrued',
  'Payroll Payable',
  'Short-Term',
  'Credit Card Payable',
  'Reimbursements Payable',
])

const LONG_TERM_LIABILITY_SUBTYPES = new Set([
  'Long-Term',           // actual value in DB (2500–2510)
  'Deferred',
])

function isCurrentAsset(subType: string | null, accountCode: string): boolean {
  if (subType && CURRENT_ASSET_SUBTYPES.has(subType)) return true
  if (subType && NONCURRENT_ASSET_SUBTYPES.has(subType)) return false
  // Null subType: classify by account code — codes starting with 10, 11, 12 are current
  if (!subType && /^1[0-2]/.test(accountCode)) return true
  if (!subType) return false
  return false
}

function isCurrentLiability(subType: string | null): boolean {
  if (subType && CURRENT_LIABILITY_SUBTYPES.has(subType)) return true
  if (subType && LONG_TERM_LIABILITY_SUBTYPES.has(subType)) return false
  // Null subType defaults to current for liabilities
  if (!subType) return true
  return false
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

interface BalanceSheetParams {
  endDate: string
  fundId?: number | null
}

export async function getBalanceSheetData(
  params: BalanceSheetParams
): Promise<BalanceSheetData> {
  const { endDate, fundId } = params

  // Build WHERE conditions for the aggregation query
  const conditions = [
    eq(transactions.isVoided, false),
    lte(transactions.date, endDate),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  // ---- Aggregate GL balances per account (ASSET, LIABILITY only) ----
  const balanceRows = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(
      accounts.id,
      accounts.code,
      accounts.name,
      accounts.type,
      accounts.subType,
      accounts.normalBalance
    )
    .orderBy(accounts.code)

  // ---- Net assets query: group by account AND fund restriction type ----
  const netAssetConditions = [
    eq(transactions.isVoided, false),
    lte(transactions.date, endDate),
    eq(accounts.type, 'NET_ASSET'),
  ]
  if (fundId) {
    netAssetConditions.push(eq(transactionLines.fundId, fundId))
  }

  const netAssetRows = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
      restrictionType: funds.restrictionType,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(and(...netAssetConditions))
    .groupBy(
      accounts.id,
      accounts.code,
      accounts.name,
      accounts.subType,
      accounts.normalBalance,
      funds.restrictionType
    )
    .orderBy(accounts.code)

  // Also need REVENUE and EXPENSE to roll into net assets (retained earnings)
  // Use fiscal year start date to avoid inception-to-date accumulation.
  // After closing entries post, prior-year rev/exp are zeroed and captured
  // in retained earnings (NET_ASSET) accounts, so only the current fiscal
  // year's rev/exp should appear in "Change in Net Assets."
  const fiscalYearStart = `${endDate.slice(0, 4)}-01-01`
  const revenueExpenseConditions = [
    eq(transactions.isVoided, false),
    gte(transactions.date, fiscalYearStart),
    lte(transactions.date, endDate),
    ne(transactions.sourceType, 'YEAR_END_CLOSE'),
  ]
  if (fundId) {
    revenueExpenseConditions.push(eq(transactionLines.fundId, fundId))
  }

  const revenueExpenseRows = await db
    .select({
      accountType: accounts.type,
      normalBalance: accounts.normalBalance,
      restrictionType: funds.restrictionType,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(
      and(
        ...revenueExpenseConditions,
        sql`${accounts.type} IN ('REVENUE', 'EXPENSE')`
      )
    )
    .groupBy(accounts.type, accounts.normalBalance, funds.restrictionType)

  // ---- Compute balances ----
  function computeBalance(
    normalBalance: string,
    totalDebit: string,
    totalCredit: string
  ): number {
    const d = parseFloat(totalDebit) || 0
    const c = parseFloat(totalCredit) || 0
    return normalBalance === 'DEBIT' ? d - c : c - d
  }

  // ---- Classify rows ----
  const currentAssetRows: BalanceSheetRow[] = []
  const noncurrentAssetRows: BalanceSheetRow[] = []
  const currentLiabilityRows: BalanceSheetRow[] = []
  const longTermLiabilityRows: BalanceSheetRow[] = []

  for (const row of balanceRows) {
    const balance = computeBalance(
      row.normalBalance,
      row.totalDebit,
      row.totalCredit
    )
    if (balance === 0) continue

    const bsRow: BalanceSheetRow = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      subType: row.subType,
      balance,
    }

    if (row.accountType === 'ASSET') {
      if (isCurrentAsset(row.subType, row.accountCode)) {
        currentAssetRows.push(bsRow)
      } else {
        noncurrentAssetRows.push(bsRow)
      }
    } else if (row.accountType === 'LIABILITY') {
      if (isCurrentLiability(row.subType)) {
        currentLiabilityRows.push(bsRow)
      } else {
        longTermLiabilityRows.push(bsRow)
      }
    }
    // NET_ASSET, REVENUE, EXPENSE handled separately
  }

  // ---- Net assets by restriction type ----
  // Aggregate NET_ASSET accounts by restriction
  const unrestrictedNetAssetRows: BalanceSheetRow[] = []
  const restrictedNetAssetRows: BalanceSheetRow[] = []

  // Group net asset rows by accountId+restriction
  const netAssetMap = new Map<
    string,
    { row: (typeof netAssetRows)[0]; balance: number }
  >()
  for (const row of netAssetRows) {
    const key = `${row.accountId}-${row.restrictionType}`
    const balance = computeBalance(
      row.normalBalance,
      row.totalDebit,
      row.totalCredit
    )
    const existing = netAssetMap.get(key)
    if (existing) {
      existing.balance += balance
    } else {
      netAssetMap.set(key, { row, balance })
    }
  }

  for (const { row, balance } of netAssetMap.values()) {
    if (balance === 0) continue
    const bsRow: BalanceSheetRow = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      subType: row.subType,
      balance,
    }
    if (row.restrictionType === 'UNRESTRICTED') {
      unrestrictedNetAssetRows.push(bsRow)
    } else {
      restrictedNetAssetRows.push(bsRow)
    }
  }

  // Roll revenue/expense into net assets as "Change in Net Assets"
  let unrestrictedRevenueExpenseNet = 0
  let restrictedRevenueExpenseNet = 0

  for (const row of revenueExpenseRows) {
    const balance = computeBalance(
      row.normalBalance,
      row.totalDebit,
      row.totalCredit
    )
    // Revenue has CREDIT normal balance: credits - debits = positive revenue
    // Expense has DEBIT normal balance: debits - credits = positive expense
    // Net effect on net assets: revenue increases, expense decreases
    const netEffect = row.accountType === 'REVENUE' ? balance : -balance
    if (row.restrictionType === 'UNRESTRICTED') {
      unrestrictedRevenueExpenseNet += netEffect
    } else {
      restrictedRevenueExpenseNet += netEffect
    }
  }

  // Add the revenue/expense net as a synthetic row
  if (unrestrictedRevenueExpenseNet !== 0) {
    unrestrictedNetAssetRows.push({
      accountId: 0,
      accountCode: '',
      accountName: 'Change in Retained Earnings',
      subType: null,
      balance: unrestrictedRevenueExpenseNet,
    })
  }
  if (restrictedRevenueExpenseNet !== 0) {
    restrictedNetAssetRows.push({
      accountId: 0,
      accountCode: '',
      accountName: 'Change in Retained Earnings',
      subType: null,
      balance: restrictedRevenueExpenseNet,
    })
  }

  // ---- Compute totals ----
  const sumSection = (rows: BalanceSheetRow[]) =>
    rows.reduce((s, r) => s + r.balance, 0)

  const currentAssetsTotal = sumSection(currentAssetRows)
  const noncurrentAssetsTotal = sumSection(noncurrentAssetRows)
  const totalAssets = currentAssetsTotal + noncurrentAssetsTotal

  const currentLiabilitiesTotal = sumSection(currentLiabilityRows)
  const longTermLiabilitiesTotal = sumSection(longTermLiabilityRows)
  const totalLiabilities = currentLiabilitiesTotal + longTermLiabilitiesTotal

  const unrestrictedTotal = sumSection(unrestrictedNetAssetRows)
  const restrictedTotal = sumSection(restrictedNetAssetRows)
  const totalNetAssets = unrestrictedTotal + restrictedTotal

  const totalLiabilitiesAndNetAssets = totalLiabilities + totalNetAssets

  // ---- Fund name lookup ----
  let fundName: string | null = null
  if (fundId) {
    const fundRows = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, fundId))
      .limit(1)
    if (fundRows.length > 0) {
      fundName = fundRows[0].name
    }
  }

  return {
    asOfDate: endDate,
    currentAssets: {
      title: 'Current Assets',
      rows: currentAssetRows,
      total: currentAssetsTotal,
    },
    noncurrentAssets: {
      title: 'Noncurrent Assets',
      rows: noncurrentAssetRows,
      total: noncurrentAssetsTotal,
    },
    totalAssets,
    currentLiabilities: {
      title: 'Current Liabilities',
      rows: currentLiabilityRows,
      total: currentLiabilitiesTotal,
    },
    longTermLiabilities: {
      title: 'Long-Term Liabilities',
      rows: longTermLiabilityRows,
      total: longTermLiabilitiesTotal,
    },
    totalLiabilities,
    netAssetsUnrestricted: {
      title: 'Without Donor Restrictions',
      rows: unrestrictedNetAssetRows,
      total: unrestrictedTotal,
    },
    netAssetsRestricted: {
      title: 'With Donor Restrictions',
      rows: restrictedNetAssetRows,
      total: restrictedTotal,
    },
    totalNetAssets,
    totalLiabilitiesAndNetAssets,
    fundName,
  }
}
