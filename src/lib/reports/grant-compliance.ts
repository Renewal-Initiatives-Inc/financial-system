import { eq, and, sql, isNotNull, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  vendors,
  funds,
  purchaseOrders,
  accounts,
  transactionLines,
  transactions,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FundingComplianceRow {
  fundId: number
  funderName: string
  fundName: string
  awardAmount: number
  type: string
  conditions: string | null
  startDate: string | null
  endDate: string | null
  status: string
  amountSpent: number
  amountRemaining: number
  spentPercent: number
  daysRemaining: number | null
  milestones: { description: string; completed: boolean }[]
  isAtRisk: boolean
}

export interface FundingComplianceData {
  rows: FundingComplianceRow[]
  totalAwards: number
  totalSpent: number
  activeFundingSources: number
  atRiskFundingSources: number
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getFundingComplianceData(): Promise<FundingComplianceData> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 1. Fetch all restricted funds with funder data (funding sources)
  const fundRows = await db
    .select({
      fundId: funds.id,
      funderName: vendors.name,
      fundName: funds.name,
      amount: funds.amount,
      type: funds.type,
      conditions: funds.conditions,
      startDate: funds.startDate,
      endDate: funds.endDate,
      status: funds.status,
      extractedMilestones: funds.extractedMilestones,
    })
    .from(funds)
    .innerJoin(vendors, eq(funds.funderId, vendors.id))
    .where(isNotNull(funds.funderId))
    .orderBy(funds.status, funds.endDate)

  // 2. For each fund, get total expense debits
  const fundIds = fundRows.map((f) => f.fundId)

  const spentByFund = new Map<number, number>()

  if (fundIds.length > 0) {
    const spentRows = await db
      .select({
        fundId: transactionLines.fundId,
        totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactions.isVoided, false),
          eq(accounts.type, 'EXPENSE'),
          eq(accounts.normalBalance, 'DEBIT'),
          ne(transactions.sourceType, 'YEAR_END_CLOSE'),
          sql`${transactionLines.fundId} IN (${sql.join(
            fundIds.map((id) => sql`${id}`),
            sql`, `
          )})`
        )
      )
      .groupBy(transactionLines.fundId)

    for (const row of spentRows) {
      const d = parseFloat(row.totalDebit) || 0
      const c = parseFloat(row.totalCredit) || 0
      spentByFund.set(row.fundId, d - c)
    }
  }

  // 3. Fetch milestones from purchase orders + fund-level extracted milestones
  const milestonesByFund = new Map<
    number,
    { description: string; completed: boolean }[]
  >()

  if (fundIds.length > 0) {
    const poRows = await db
      .select({
        fundId: purchaseOrders.fundId,
        extractedMilestones: purchaseOrders.extractedMilestones,
      })
      .from(purchaseOrders)
      .where(
        sql`${purchaseOrders.fundId} IN (${sql.join(
          fundIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )

    for (const po of poRows) {
      const existing = milestonesByFund.get(po.fundId) ?? []
      if (po.extractedMilestones && Array.isArray(po.extractedMilestones)) {
        for (const m of po.extractedMilestones as Array<{
          description?: string
          completed?: boolean
        }>) {
          if (m && typeof m.description === 'string') {
            existing.push({
              description: m.description,
              completed: m.completed === true,
            })
          }
        }
      }
      milestonesByFund.set(po.fundId, existing)
    }
  }

  // Also pull milestones from the fund itself (extractedMilestones)
  for (const f of fundRows) {
    if (f.extractedMilestones && Array.isArray(f.extractedMilestones)) {
      const existing = milestonesByFund.get(f.fundId) ?? []
      for (const m of f.extractedMilestones as Array<{
        description?: string
        completed?: boolean
      }>) {
        if (m && typeof m.description === 'string') {
          existing.push({
            description: m.description,
            completed: m.completed === true,
          })
        }
      }
      milestonesByFund.set(f.fundId, existing)
    }
  }

  // 4. Build compliance rows
  const rows: FundingComplianceRow[] = fundRows.map((f) => {
    const awardAmount = parseFloat(f.amount ?? '0') || 0
    const amountSpent = spentByFund.get(f.fundId) ?? 0
    const amountRemaining = awardAmount - amountSpent
    const spentPercent = awardAmount > 0 ? (amountSpent / awardAmount) * 100 : 0

    let daysRemaining: number | null = null
    if (f.endDate) {
      const endMs = new Date(f.endDate + 'T00:00:00').getTime()
      const todayMs = new Date(todayStr + 'T00:00:00').getTime()
      daysRemaining = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24))
    }

    let isAtRisk = false
    if (f.status === 'ACTIVE' && f.endDate) {
      if (daysRemaining !== null && daysRemaining < 0) {
        isAtRisk = true
      } else if (
        daysRemaining !== null &&
        daysRemaining <= 90 &&
        spentPercent < 50
      ) {
        isAtRisk = true
      }
    }

    const milestones = milestonesByFund.get(f.fundId) ?? []

    return {
      fundId: f.fundId,
      funderName: f.funderName,
      fundName: f.fundName,
      awardAmount,
      type: f.type ?? 'UNCONDITIONAL',
      conditions: f.conditions,
      startDate: f.startDate,
      endDate: f.endDate,
      status: f.status ?? 'ACTIVE',
      amountSpent,
      amountRemaining,
      spentPercent,
      daysRemaining,
      milestones,
      isAtRisk,
    }
  })

  const totalAwards = rows.reduce((s, r) => s + r.awardAmount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.amountSpent, 0)
  const activeFundingSources = rows.filter((r) => r.status === 'ACTIVE').length
  const atRiskFundingSources = rows.filter((r) => r.isAtRisk).length

  return {
    rows,
    totalAwards,
    totalSpent,
    activeFundingSources,
    atRiskFundingSources,
  }
}
