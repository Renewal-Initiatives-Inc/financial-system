import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants, accounts, transactionLines, transactions } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RentCollectionRow {
  tenantId: number
  tenantName: string
  unitNumber: string
  monthlyRent: number
  fundingSourceType: string
  billed: number
  collected: number
  outstanding: number
  collectionRate: number // percentage 0-100
}

export interface RentCollectionData {
  month: string // YYYY-MM
  rows: RentCollectionRow[]
  totalUnits: number
  occupiedUnits: number
  occupancyRate: number // percentage 0-100
  totalBilled: number
  totalCollected: number
  totalOutstanding: number
  collectionRate: number // percentage 0-100
  vacancyLoss: number
  vacantUnits: VacantUnit[]
  generatedAt: string
}

export interface VacantUnit {
  tenantId: number
  tenantName: string
  unitNumber: string
  monthlyRent: number
}

export interface RentCollectionFilters {
  month?: string // YYYY-MM, defaults to current month
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthRange(month: string): { startDate: string; endDate: string } {
  const [year, mon] = month.split('-').map(Number)
  const startDate = `${year}-${String(mon).padStart(2, '0')}-01`
  const lastDay = new Date(year, mon, 0).getDate()
  const endDate = `${year}-${String(mon).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

function getCurrentMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getRentCollectionData(
  filters?: RentCollectionFilters
): Promise<RentCollectionData> {
  const now = new Date().toISOString()
  const month = filters?.month ?? getCurrentMonth()
  const { startDate, endDate } = getMonthRange(month)

  // 1. Get all tenants (both active and inactive for occupancy tracking)
  const allTenants = await db
    .select()
    .from(tenants)
    .orderBy(tenants.unitNumber)

  const activeTenants = allTenants.filter((t) => t.isActive)
  const tenantsWithRent = activeTenants.filter(
    (t) => parseFloat(t.monthlyRent) > 0
  )

  // 2. Query total rent collected from GL for the month
  // Look for credits to Accounts Receivable accounts within the date range
  // (rent payments credit AR when cash is received)
  const arAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.type, 'ASSET'),
        eq(accounts.isActive, true),
        sql`${accounts.subType} = 'Accounts Receivable'`
      )
    )

  const arAccountIds = arAccounts.map((a) => a.id)

  let totalGlCollected = 0

  if (arAccountIds.length > 0) {
    const collectedResult = await db
      .select({
        totalCredit: sql<string>`COALESCE(SUM(CAST(${transactionLines.credit} AS numeric)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(
            arAccountIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          eq(transactions.isVoided, false),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate)
        )
      )

    totalGlCollected = parseFloat(collectedResult[0]?.totalCredit ?? '0')
  }

  // 3. Build per-tenant rows
  // Since we may not have per-tenant GL tracking, we distribute the total
  // collected proportionally based on each tenant's rent share.
  const totalBilled = tenantsWithRent.reduce(
    (sum, t) => sum + parseFloat(t.monthlyRent),
    0
  )

  const rows: RentCollectionRow[] = tenantsWithRent.map((tenant) => {
    const rent = parseFloat(tenant.monthlyRent)
    const billed = rent

    // Proportional allocation of collected rent
    let collected = 0
    if (totalBilled > 0 && totalGlCollected > 0) {
      const share = rent / totalBilled
      collected = Math.min(totalGlCollected * share, billed)
    }

    const outstanding = Math.max(billed - collected, 0)
    const collectionRate = billed > 0 ? (collected / billed) * 100 : 0

    return {
      tenantId: tenant.id,
      tenantName: tenant.name,
      unitNumber: tenant.unitNumber,
      monthlyRent: rent,
      fundingSourceType: tenant.fundingSourceType,
      billed,
      collected: Math.round(collected * 100) / 100,
      outstanding: Math.round(outstanding * 100) / 100,
      collectionRate: Math.round(collectionRate * 10) / 10,
    }
  })

  // 4. Compute vacancy info
  const inactiveTenants = allTenants.filter(
    (t) => !t.isActive && parseFloat(t.monthlyRent) > 0
  )
  const vacantUnits: VacantUnit[] = inactiveTenants.map((t) => ({
    tenantId: t.id,
    tenantName: t.name,
    unitNumber: t.unitNumber,
    monthlyRent: parseFloat(t.monthlyRent),
  }))

  const vacancyLoss = vacantUnits.reduce((sum, v) => sum + v.monthlyRent, 0)

  // 5. Compute totals
  const totalCollected = rows.reduce((s, r) => s + r.collected, 0)
  const totalOutstanding = rows.reduce((s, r) => s + r.outstanding, 0)
  const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0

  const totalUnits = allTenants.length
  const occupiedUnits = tenantsWithRent.length
  const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0

  return {
    month,
    rows,
    totalUnits,
    occupiedUnits,
    occupancyRate: Math.round(occupancyRate * 10) / 10,
    totalBilled: Math.round(totalBilled * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    totalOutstanding: Math.round(totalOutstanding * 100) / 100,
    collectionRate: Math.round(collectionRate * 10) / 10,
    vacancyLoss: Math.round(vacancyLoss * 100) / 100,
    vacantUnits,
    generatedAt: now,
  }
}
