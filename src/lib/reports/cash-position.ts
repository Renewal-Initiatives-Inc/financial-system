import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, transactionLines, transactions } from '@/lib/db/schema'

export interface CashPositionAccount {
  accountId: number
  accountCode: string
  accountName: string
  balance: number
}

export interface CashPositionSection {
  title: string
  accounts: CashPositionAccount[]
  total: number
}

export interface CashPositionData {
  cashSection: CashPositionSection
  payablesSection: CashPositionSection
  receivablesSection: CashPositionSection
  netAvailableCash: number
  coverageRatio: number | null // cash / payables
}

const CASH_SUB_TYPES = ['Cash', 'Cash Equivalent']
const PAYABLE_SUB_TYPES = [
  'Accounts Payable',
  'Reimbursements Payable',
  'Credit Card Payable',
  'Accrued',
  'Payroll Payable',
]
const RECEIVABLE_SUB_TYPES = [
  'Accounts Receivable',
  'Grants Receivable',
  'Pledges Receivable',
]

/**
 * Fetch all matching accounts and compute their GL balances in a single query.
 * Returns accounts with non-zero balances, sorted by account code.
 */
async function getSectionAccounts(
  accountIds: number[],
  normalBalance: 'DEBIT' | 'CREDIT'
): Promise<CashPositionAccount[]> {
  if (accountIds.length === 0) return []

  const rows = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      totalDebit: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CAST(${transactionLines.credit} AS numeric)), 0)`,
    })
    .from(accounts)
    .leftJoin(
      transactionLines,
      eq(transactionLines.accountId, accounts.id)
    )
    .leftJoin(
      transactions,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(
      and(
        inArray(accounts.id, accountIds),
        // Only include non-voided transaction lines (or accounts with no lines)
        sql`(${transactions.id} IS NULL OR ${transactions.isVoided} = false)`
      )
    )
    .groupBy(accounts.id, accounts.code, accounts.name)
    .orderBy(accounts.code)

  return rows.map((r) => {
    const debit = parseFloat(r.totalDebit)
    const credit = parseFloat(r.totalCredit)
    const balance =
      normalBalance === 'DEBIT' ? debit - credit : credit - debit

    return {
      accountId: r.accountId,
      accountCode: r.accountCode,
      accountName: r.accountName,
      balance,
    }
  })
}

export async function getCashPositionData(): Promise<CashPositionData> {
  // --- Fetch all candidate accounts in one query ---
  const allAccounts = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      type: accounts.type,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
    })
    .from(accounts)
    .where(eq(accounts.isActive, true))

  // --- Classify accounts into sections ---
  const cashAccountIds: number[] = []
  const payableAccountIds: number[] = []
  const receivableAccountIds: number[] = []

  for (const acct of allAccounts) {
    // Cash accounts: ASSET with cash subType or code starting with '10'
    if (
      acct.type === 'ASSET' &&
      (CASH_SUB_TYPES.includes(acct.subType ?? '') || acct.code.startsWith('10'))
    ) {
      cashAccountIds.push(acct.id)
    }

    // Payable accounts: LIABILITY with matching subTypes
    if (
      acct.type === 'LIABILITY' &&
      PAYABLE_SUB_TYPES.includes(acct.subType ?? '')
    ) {
      payableAccountIds.push(acct.id)
    }

    // Receivable accounts: ASSET with matching subType or code starting with '11'/'12'
    if (
      acct.type === 'ASSET' &&
      (RECEIVABLE_SUB_TYPES.includes(acct.subType ?? '') ||
        acct.code.startsWith('11') ||
        acct.code.startsWith('12'))
    ) {
      receivableAccountIds.push(acct.id)
    }
  }

  // --- Compute balances per section ---
  const [cashAccounts, payableAccounts, receivableAccounts] = await Promise.all([
    getSectionAccounts(cashAccountIds, 'DEBIT'),
    getSectionAccounts(payableAccountIds, 'CREDIT'),
    getSectionAccounts(receivableAccountIds, 'DEBIT'),
  ])

  const cashTotal = cashAccounts.reduce((s, a) => s + a.balance, 0)
  const payablesTotal = payableAccounts.reduce((s, a) => s + a.balance, 0)
  const receivablesTotal = receivableAccounts.reduce((s, a) => s + a.balance, 0)

  const netAvailableCash = cashTotal - payablesTotal + receivablesTotal
  const coverageRatio = payablesTotal !== 0 ? cashTotal / payablesTotal : null

  return {
    cashSection: {
      title: 'Cash & Cash Equivalents',
      accounts: cashAccounts,
      total: cashTotal,
    },
    payablesSection: {
      title: 'Outstanding Payables',
      accounts: payableAccounts,
      total: payablesTotal,
    },
    receivablesSection: {
      title: 'Outstanding Receivables',
      accounts: receivableAccounts,
      total: receivablesTotal,
    },
    netAvailableCash,
    coverageRatio,
  }
}
