import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  funds,
  vendors,
  accounts,
  transactionLines,
  transactions,
  purchaseOrders,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FundDrawdownRow {
  fundId: number
  fundName: string
  restrictionType: string
  totalAwarded: number
  totalSpent: number
  totalReleased: number
  remaining: number
  drawdownPercent: number
  // Contract terms (from enriched fund)
  funderName: string | null
  fundingAmount: string | null
  fundingType: string | null
  conditions: string | null
  fundingStatus: string | null
  milestones: { description: string; completed: boolean }[]
}

export interface FundDrawdownData {
  rows: FundDrawdownRow[]
  totalAwarded: number
  totalSpent: number
  totalRemaining: number
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getFundDrawdownData(): Promise<FundDrawdownData> {
  // 1. Get all RESTRICTED funds with optional funder join
  const restrictedFunds = await db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
      funderId: funds.funderId,
      amount: funds.amount,
      type: funds.type,
      conditions: funds.conditions,
      status: funds.status,
      funderName: vendors.name,
    })
    .from(funds)
    .leftJoin(vendors, eq(funds.funderId, vendors.id))
    .where(eq(funds.restrictionType, 'RESTRICTED'))
    .orderBy(funds.name)

  const rows: FundDrawdownRow[] = []

  for (const fund of restrictedFunds) {
    // 2a. totalAwarded: sum of REVENUE account activity in this fund
    const awardedResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(
          CASE WHEN ${accounts.normalBalance} = 'CREDIT'
            THEN COALESCE(${transactionLines.credit}, 0) - COALESCE(${transactionLines.debit}, 0)
            ELSE 0
          END
        ), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactionLines.fundId, fund.id),
          eq(transactions.isVoided, false),
          eq(accounts.type, 'REVENUE')
        )
      )

    const totalAwarded = parseFloat(awardedResult[0]?.total ?? '0')

    // 2b. totalSpent: sum of EXPENSE account activity in this fund
    const spentResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(
          CASE WHEN ${accounts.normalBalance} = 'DEBIT'
            THEN COALESCE(${transactionLines.debit}, 0) - COALESCE(${transactionLines.credit}, 0)
            ELSE 0
          END
        ), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactionLines.fundId, fund.id),
          eq(transactions.isVoided, false),
          eq(accounts.type, 'EXPENSE')
        )
      )

    const totalSpent = parseFloat(spentResult[0]?.total ?? '0')

    // 2c. totalReleased: net asset releases
    const releasedResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(
          COALESCE(${transactionLines.credit}, 0) - COALESCE(${transactionLines.debit}, 0)
        ), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          eq(transactionLines.fundId, fund.id),
          eq(transactions.isVoided, false),
          eq(transactions.sourceType, 'SYSTEM'),
          sql`LOWER(${transactions.memo}) LIKE '%release%'`
        )
      )

    const totalReleased = parseFloat(releasedResult[0]?.total ?? '0')

    const remaining = totalAwarded - totalSpent
    const drawdownPercent =
      totalAwarded > 0
        ? Math.round((totalSpent / totalAwarded) * 10000) / 100
        : 0

    // 3. Milestones from purchase orders
    const relatedPOs = await db
      .select({
        extractedMilestones: purchaseOrders.extractedMilestones,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.fundId, fund.id))

    const milestones: { description: string; completed: boolean }[] = []
    for (const po of relatedPOs) {
      if (po.extractedMilestones && Array.isArray(po.extractedMilestones)) {
        for (const m of po.extractedMilestones as {
          description?: string
          completed?: boolean
        }[]) {
          if (m.description) {
            milestones.push({
              description: m.description,
              completed: m.completed ?? false,
            })
          }
        }
      }
    }

    rows.push({
      fundId: fund.id,
      fundName: fund.name,
      restrictionType: fund.restrictionType,
      totalAwarded,
      totalSpent,
      totalReleased,
      remaining,
      drawdownPercent,
      funderName: fund.funderName ?? null,
      fundingAmount: fund.amount,
      fundingType: fund.type,
      conditions: fund.conditions,
      fundingStatus: fund.status,
      milestones,
    })
  }

  const totalAwarded = rows.reduce((s, r) => s + r.totalAwarded, 0)
  const totalSpent = rows.reduce((s, r) => s + r.totalSpent, 0)
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0)

  return { rows, totalAwarded, totalSpent, totalRemaining }
}
