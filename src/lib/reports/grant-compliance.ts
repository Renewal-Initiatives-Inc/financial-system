import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  grants,
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

export interface GrantComplianceRow {
  grantId: number
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

export interface GrantComplianceData {
  rows: GrantComplianceRow[]
  totalAwards: number
  totalSpent: number
  activeGrants: number
  atRiskGrants: number
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getGrantComplianceData(): Promise<GrantComplianceData> {
  const today = new Date()
  const todayStr = today.toISOString().split('T')[0]

  // 1. Fetch all grants with funder and fund names
  const grantRows = await db
    .select({
      grantId: grants.id,
      funderName: vendors.name,
      fundName: funds.name,
      amount: grants.amount,
      type: grants.type,
      conditions: grants.conditions,
      startDate: grants.startDate,
      endDate: grants.endDate,
      status: grants.status,
      fundId: grants.fundId,
    })
    .from(grants)
    .innerJoin(vendors, eq(grants.funderId, vendors.id))
    .innerJoin(funds, eq(grants.fundId, funds.id))
    .orderBy(grants.status, grants.endDate)

  // 2. For each grant's fundId, get total expense debits (non-voided, EXPENSE
  //    accounts with DEBIT normal balance: sum debits - credits)
  const fundIds = [...new Set(grantRows.map((g) => g.fundId))]

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

  // 3. Fetch milestones from purchase orders matching each fund
  const milestonesByFund = new Map<
    number,
    { description: string; completed: boolean }[]
  >()

  if (fundIds.length > 0) {
    const poRows = await db
      .select({
        fundId: purchaseOrders.fundId,
        extractedMilestones: purchaseOrders.extractedMilestones,
        poStatus: purchaseOrders.status,
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
      if (
        po.extractedMilestones &&
        Array.isArray(po.extractedMilestones)
      ) {
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

  // 4. Build compliance rows
  const rows: GrantComplianceRow[] = grantRows.map((g) => {
    const awardAmount = parseFloat(g.amount) || 0
    const amountSpent = spentByFund.get(g.fundId) ?? 0
    const amountRemaining = awardAmount - amountSpent
    const spentPercent = awardAmount > 0 ? (amountSpent / awardAmount) * 100 : 0

    // Days remaining
    let daysRemaining: number | null = null
    if (g.endDate) {
      const endMs = new Date(g.endDate + 'T00:00:00').getTime()
      const todayMs = new Date(todayStr + 'T00:00:00').getTime()
      daysRemaining = Math.ceil((endMs - todayMs) / (1000 * 60 * 60 * 24))
    }

    // At-risk: endDate within 90 days AND spentPercent < 50, OR endDate passed and still ACTIVE
    let isAtRisk = false
    if (g.status === 'ACTIVE' && g.endDate) {
      if (daysRemaining !== null && daysRemaining < 0) {
        // Overdue
        isAtRisk = true
      } else if (
        daysRemaining !== null &&
        daysRemaining <= 90 &&
        spentPercent < 50
      ) {
        isAtRisk = true
      }
    }

    const milestones = milestonesByFund.get(g.fundId) ?? []

    return {
      grantId: g.grantId,
      funderName: g.funderName,
      fundName: g.fundName,
      awardAmount,
      type: g.type,
      conditions: g.conditions,
      startDate: g.startDate,
      endDate: g.endDate,
      status: g.status,
      amountSpent,
      amountRemaining,
      spentPercent,
      daysRemaining,
      milestones,
      isAtRisk,
    }
  })

  // 5. Compute summary
  const totalAwards = rows.reduce((s, r) => s + r.awardAmount, 0)
  const totalSpent = rows.reduce((s, r) => s + r.amountSpent, 0)
  const activeGrants = rows.filter((r) => r.status === 'ACTIVE').length
  const atRiskGrants = rows.filter((r) => r.isAtRisk).length

  return {
    rows,
    totalAwards,
    totalSpent,
    activeGrants,
    atRiskGrants,
  }
}
