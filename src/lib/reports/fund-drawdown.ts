import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  funds,
  grants,
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
  relatedGrants: {
    grantId: number
    funderName: string
    amount: number
    type: string
    conditions: string | null
    status: string
  }[]
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
  // 1. Get all RESTRICTED funds
  const restrictedFunds = await db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(eq(funds.restrictionType, 'RESTRICTED'))
    .orderBy(funds.name)

  const rows: FundDrawdownRow[] = []

  for (const fund of restrictedFunds) {
    // 2a. totalAwarded: sum of REVENUE account activity in this fund
    //     REVENUE accounts have CREDIT normal balance: amount = credits - debits
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
    //     EXPENSE accounts have DEBIT normal balance: amount = debits - credits
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

    // 2c. totalReleased: net asset releases (SYSTEM entries with 'release' in memo)
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

    // 2d. remaining and drawdownPercent
    const remaining = totalAwarded - totalSpent
    const drawdownPercent =
      totalAwarded > 0
        ? Math.round((totalSpent / totalAwarded) * 10000) / 100
        : 0

    // 3. Related grants
    const relatedGrantRows = await db
      .select({
        grantId: grants.id,
        funderName: vendors.name,
        amount: grants.amount,
        type: grants.type,
        conditions: grants.conditions,
        status: grants.status,
      })
      .from(grants)
      .innerJoin(vendors, eq(grants.funderId, vendors.id))
      .where(eq(grants.fundId, fund.id))
      .orderBy(grants.id)

    const relatedGrants = relatedGrantRows.map((g) => ({
      grantId: g.grantId,
      funderName: g.funderName,
      amount: parseFloat(g.amount),
      type: g.type,
      conditions: g.conditions,
      status: g.status,
    }))

    // 4. Milestones from related purchase orders' extractedMilestones
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
      relatedGrants,
      milestones,
    })
  }

  const totalAwarded = rows.reduce((s, r) => s + r.totalAwarded, 0)
  const totalSpent = rows.reduce((s, r) => s + r.totalSpent, 0)
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0)

  return { rows, totalAwarded, totalSpent, totalRemaining }
}
