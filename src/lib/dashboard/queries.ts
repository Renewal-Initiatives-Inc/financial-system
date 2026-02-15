import { eq, and, sql, lte, desc, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  complianceDeadlines,
  bankTransactions,
  bankMatches,
  rampTransactions,
  tenants,
  funds,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashSnapshotData {
  bankBalances: { name: string; balance: number }[]
  netAvailableCash: number
  ahpDrawn: number
  ahpAvailable: number
}

export interface AlertItem {
  label: string
  count: number
  href: string
  urgency: 'info' | 'warning' | 'danger'
}

export interface AlertsData {
  items: AlertItem[]
  upcomingDeadlines: {
    taskName: string
    dueDate: string
    daysRemaining: number
    urgency: 'green' | 'yellow' | 'red' | 'overdue'
  }[]
}

export interface RentSnapshotData {
  month: string
  totalBilled: number
  totalCollected: number
  totalOutstanding: number
  collectionRate: number
  unitSummary: { unitNumber: string; collected: number; billed: number }[]
}

export interface FundBalancesData {
  restrictedTotal: number
  unrestrictedTotal: number
  funds: { name: string; balance: number; restrictionType: string }[]
}

export interface RecentActivityRow {
  id: number
  date: string
  memo: string
  sourceType: string
  totalAmount: number
}

export interface DashboardData {
  cashSnapshot: CashSnapshotData
  alerts: AlertsData
  rentSnapshot: RentSnapshotData
  fundBalances: FundBalancesData
  recentActivity: RecentActivityRow[]
}

// ---------------------------------------------------------------------------
// Section queries
// ---------------------------------------------------------------------------

export async function getCashSnapshotData(): Promise<CashSnapshotData> {
  const { getCashPositionData } = await import('@/lib/reports/cash-position')
  const data = await getCashPositionData()

  return {
    bankBalances: data.cashSection.accounts.map((a) => ({
      name: a.accountName,
      balance: a.balance,
    })),
    netAvailableCash: data.netAvailableCash,
    ahpDrawn: data.ahpStatus?.drawn ?? 0,
    ahpAvailable: data.ahpStatus?.available ?? 0,
  }
}

export async function getAlertsData(): Promise<AlertsData> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]
  const thirtyDaysOut = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)
  const thirtyDaysStr = thirtyDaysOut.toISOString().split('T')[0]

  // Overdue rent: active tenants with outstanding > 0
  const activeTenants = await db
    .select({ id: tenants.id, monthlyRent: tenants.monthlyRent })
    .from(tenants)
    .where(eq(tenants.isActive, true))

  const overdueCount = activeTenants.filter(
    (t) => parseFloat(t.monthlyRent) > 0
  ).length > 0
    ? await getOverdueRentCount()
    : 0

  // Upcoming compliance deadlines (within 30 days)
  const deadlines = await db
    .select({
      taskName: complianceDeadlines.taskName,
      dueDate: complianceDeadlines.dueDate,
    })
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.status, 'upcoming'),
        lte(complianceDeadlines.dueDate, thirtyDaysStr),
      )
    )
    .orderBy(complianceDeadlines.dueDate)

  // Unmatched bank transactions
  const unmatchedResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(bankTransactions)
    .leftJoin(bankMatches, eq(bankTransactions.id, bankMatches.bankTransactionId))
    .where(
      and(
        isNull(bankMatches.id),
        eq(bankTransactions.isPending, false)
      )
    )
  const unmatchedCount = parseInt(unmatchedResult[0]?.count ?? '0')

  // Uncategorized ramp transactions needing attention
  const uncategorizedRamp = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(rampTransactions)
    .where(eq(rampTransactions.status, 'uncategorized'))
  const uncategorizedCount = parseInt(uncategorizedRamp[0]?.count ?? '0')

  const items: AlertItem[] = []

  if (overdueCount > 0) {
    items.push({
      label: 'Overdue rent payments',
      count: overdueCount,
      href: '/reports/rent-collection',
      urgency: 'danger',
    })
  }

  if (unmatchedCount > 0) {
    items.push({
      label: 'Unmatched bank transactions',
      count: unmatchedCount,
      href: '/bank-reconciliation',
      urgency: 'warning',
    })
  }

  if (uncategorizedCount > 0) {
    items.push({
      label: 'Uncategorized Ramp transactions',
      count: uncategorizedCount,
      href: '/expenses/ramp',
      urgency: 'warning',
    })
  }

  const upcomingDeadlines = deadlines.map((d) => {
    const due = new Date(d.dueDate + 'T00:00:00')
    const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    let urgency: 'green' | 'yellow' | 'red' | 'overdue' = 'green'
    if (diff < 0) urgency = 'overdue'
    else if (diff < 7) urgency = 'red'
    else if (diff < 14) urgency = 'yellow'

    return {
      taskName: d.taskName,
      dueDate: d.dueDate,
      daysRemaining: diff,
      urgency,
    }
  })

  if (upcomingDeadlines.length > 0) {
    items.push({
      label: 'Compliance deadlines (30 days)',
      count: upcomingDeadlines.length,
      href: '/compliance',
      urgency: upcomingDeadlines.some((d) => d.urgency === 'overdue' || d.urgency === 'red')
        ? 'danger'
        : 'warning',
    })
  }

  return { items, upcomingDeadlines }
}

async function getOverdueRentCount(): Promise<number> {
  // Count units where the current month's collection is below billed
  const { getRentCollectionData } = await import('@/lib/reports/rent-collection')
  const data = await getRentCollectionData()
  return data.rows.filter((r) => r.outstanding > 0).length
}

export async function getRentSnapshotData(): Promise<RentSnapshotData> {
  const { getRentCollectionData } = await import('@/lib/reports/rent-collection')
  const data = await getRentCollectionData()

  return {
    month: data.month,
    totalBilled: data.totalBilled,
    totalCollected: data.totalCollected,
    totalOutstanding: data.totalOutstanding,
    collectionRate: data.collectionRate,
    unitSummary: data.rows.slice(0, 8).map((r) => ({
      unitNumber: r.unitNumber,
      collected: r.collected,
      billed: r.billed,
    })),
  }
}

export async function getFundBalancesData(): Promise<FundBalancesData> {
  // Get all funds with their net asset balances
  const allFunds = await db
    .select({ id: funds.id, name: funds.name, restrictionType: funds.restrictionType })
    .from(funds)
    .orderBy(funds.name)

  const fundBalances: { name: string; balance: number; restrictionType: string }[] = []

  for (const fund of allFunds) {
    // Net assets = (Revenue credits - Revenue debits) - (Expense debits - Expense credits)
    // Simplified: sum all activity for the fund
    const result = await db
      .select({
        netBalance: sql<string>`COALESCE(SUM(
          CASE
            WHEN ${accounts.normalBalance} = 'CREDIT'
              THEN COALESCE(CAST(${transactionLines.credit} AS numeric), 0) - COALESCE(CAST(${transactionLines.debit} AS numeric), 0)
            ELSE COALESCE(CAST(${transactionLines.debit} AS numeric), 0) - COALESCE(CAST(${transactionLines.credit} AS numeric), 0)
          END
        ), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactionLines.fundId, fund.id),
          eq(transactions.isVoided, false),
          sql`${accounts.type} IN ('REVENUE', 'EXPENSE')`
        )
      )

    const balance = parseFloat(result[0]?.netBalance ?? '0')
    fundBalances.push({
      name: fund.name,
      balance,
      restrictionType: fund.restrictionType,
    })
  }

  const restrictedTotal = fundBalances
    .filter((f) => f.restrictionType === 'RESTRICTED')
    .reduce((s, f) => s + f.balance, 0)
  const unrestrictedTotal = fundBalances
    .filter((f) => f.restrictionType === 'UNRESTRICTED')
    .reduce((s, f) => s + f.balance, 0)

  return { restrictedTotal, unrestrictedTotal, funds: fundBalances }
}

export async function getRecentActivityData(): Promise<RecentActivityRow[]> {
  const txns = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      sourceType: transactions.sourceType,
    })
    .from(transactions)
    .where(eq(transactions.isVoided, false))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(10)

  if (txns.length === 0) return []

  const txnIds = txns.map((t) => t.id)
  const lineRows = await db
    .select({
      transactionId: transactionLines.transactionId,
      debit: transactionLines.debit,
    })
    .from(transactionLines)
    .where(
      sql`${transactionLines.transactionId} IN (${sql.join(
        txnIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )

  const totals = new Map<number, number>()
  for (const line of lineRows) {
    const current = totals.get(line.transactionId) ?? 0
    totals.set(line.transactionId, current + parseFloat(line.debit ?? '0'))
  }

  return txns.map((t) => ({
    id: t.id,
    date: t.date,
    memo: t.memo,
    sourceType: t.sourceType,
    totalAmount: totals.get(t.id) ?? 0,
  }))
}

// ---------------------------------------------------------------------------
// Combined dashboard query
// ---------------------------------------------------------------------------

export async function getDashboardData(): Promise<DashboardData> {
  const [cashSnapshot, alerts, rentSnapshot, fundBalances, recentActivity] =
    await Promise.all([
      getCashSnapshotData(),
      getAlertsData(),
      getRentSnapshotData(),
      getFundBalancesData(),
      getRecentActivityData(),
    ])

  return { cashSnapshot, alerts, rentSnapshot, fundBalances, recentActivity }
}
