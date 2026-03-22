import { eq, and, sql, gte, lte, desc, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donors, transactions, transactionLines, accounts, funds } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DonorGift {
  transactionId: number
  date: string
  amount: number
  fundName: string
  restrictionType: string
  memo: string
}

export interface DonorSummaryRow {
  donorId: number
  donorName: string
  donorType: string
  totalGiven: number
  restrictedAmount: number
  unrestrictedAmount: number
  firstGift: string | null
  lastGift: string | null
  giftCount: number
  gifts: DonorGift[]
}

export interface DonorGivingHistoryFilters {
  startDate?: string
  endDate?: string
  fundId?: number
}

export interface DonorGivingHistoryData {
  rows: DonorSummaryRow[]
  totalDonors: number
  totalGiving: number
  totalRestricted: number
  totalUnrestricted: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getDonorGivingHistoryData(
  filters?: DonorGivingHistoryFilters
): Promise<DonorGivingHistoryData> {
  const now = new Date().toISOString()

  // Get all active donors
  const allDonors = await db
    .select()
    .from(donors)
    .where(eq(donors.isActive, true))
    .orderBy(donors.name)

  // Find revenue accounts that are donation/contribution accounts
  const revenueAccounts = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
    .where(
      and(
        eq(accounts.type, 'REVENUE'),
        eq(accounts.isActive, true),
        sql`(${accounts.subType} = 'Contributions' OR ${accounts.name} ILIKE '%donation%' OR ${accounts.name} ILIKE '%contribution%' OR ${accounts.name} ILIKE '%giving%')`
      )
    )

  const revenueAccountIds = revenueAccounts.map((a) => a.id)

  if (revenueAccountIds.length === 0 || allDonors.length === 0) {
    return {
      rows: allDonors.map((d) => ({
        donorId: d.id,
        donorName: d.name,
        donorType: d.type,
        totalGiven: 0,
        restrictedAmount: 0,
        unrestrictedAmount: 0,
        firstGift: d.firstGiftDate,
        lastGift: null,
        giftCount: 0,
        gifts: [],
      })),
      totalDonors: allDonors.length,
      totalGiving: 0,
      totalRestricted: 0,
      totalUnrestricted: 0,
      generatedAt: now,
    }
  }

  // Query donation transaction lines
  const conditions = [
    sql`${transactionLines.accountId} IN (${sql.join(
      revenueAccountIds.map((id) => sql`${id}`),
      sql`, `
    )})`,
    eq(transactions.isVoided, false),
    ne(transactions.sourceType, 'YEAR_END_CLOSE'),
  ]

  if (filters?.startDate) {
    conditions.push(gte(transactions.date, filters.startDate))
  }
  if (filters?.endDate) {
    conditions.push(lte(transactions.date, filters.endDate))
  }
  if (filters?.fundId) {
    conditions.push(eq(transactionLines.fundId, filters.fundId))
  }

  const donationLines = await db
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      credit: transactionLines.credit,
      fundName: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date))

  // We need to match donations to donors via memo or source reference
  // For now, aggregate all donations and show them in the report
  // A proper donor-transaction link would require a donorId on transactions
  const totalGifts: DonorGift[] = donationLines.map((l) => ({
    transactionId: l.transactionId,
    date: l.date,
    amount: parseFloat(l.credit ?? '0'),
    fundName: l.fundName,
    restrictionType: l.restrictionType,
    memo: l.memo,
  }))

  // Build donor rows - distribute donations to donors based on memo matching
  const rows: DonorSummaryRow[] = allDonors.map((d) => {
    // Try to match gifts to donor by name in memo
    const donorGifts = totalGifts.filter(
      (g) => g.memo.toLowerCase().includes(d.name.toLowerCase())
    )

    const totalGiven = donorGifts.reduce((s, g) => s + g.amount, 0)
    const restrictedAmount = donorGifts
      .filter((g) => g.restrictionType === 'RESTRICTED')
      .reduce((s, g) => s + g.amount, 0)
    const unrestrictedAmount = totalGiven - restrictedAmount

    const dates = donorGifts.map((g) => g.date).sort()

    return {
      donorId: d.id,
      donorName: d.name,
      donorType: d.type,
      totalGiven: Math.round(totalGiven * 100) / 100,
      restrictedAmount: Math.round(restrictedAmount * 100) / 100,
      unrestrictedAmount: Math.round(unrestrictedAmount * 100) / 100,
      firstGift: dates[0] ?? d.firstGiftDate,
      lastGift: dates[dates.length - 1] ?? null,
      giftCount: donorGifts.length,
      gifts: donorGifts,
    }
  })

  // Sort by total giving (desc), then name
  rows.sort((a, b) => b.totalGiven - a.totalGiven || a.donorName.localeCompare(b.donorName))

  const totalGiving = rows.reduce((s, r) => s + r.totalGiven, 0)
  const totalRestricted = rows.reduce((s, r) => s + r.restrictedAmount, 0)
  const totalUnrestricted = rows.reduce((s, r) => s + r.unrestrictedAmount, 0)

  return {
    rows,
    totalDonors: rows.length,
    totalGiving: Math.round(totalGiving * 100) / 100,
    totalRestricted: Math.round(totalRestricted * 100) / 100,
    totalUnrestricted: Math.round(totalUnrestricted * 100) / 100,
    generatedAt: now,
  }
}
