import { eq, and, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  tenants,
  grants,
  pledges,
  donors,
  vendors,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgingBuckets {
  current: number // 0-30 days
  days31to60: number
  days61to90: number
  days90plus: number
  total: number
}

export interface TenantARRow {
  tenantId: number
  tenantName: string
  unitNumber: string
  fundingSourceType: string
  isVASH: boolean
  outstanding: number
  aging: AgingBuckets
}

export interface GrantARRow {
  grantId: number
  funderName: string
  grantAmount: number
  receivableBalance: number
  aging: AgingBuckets
}

export interface PledgeARRow {
  pledgeId: number
  donorName: string
  pledgeAmount: number
  receivableBalance: number
  aging: AgingBuckets
}

export interface ARAgingData {
  tenantAR: { rows: TenantARRow[]; total: AgingBuckets }
  grantAR: { rows: GrantARRow[]; total: AgingBuckets }
  pledgeAR: { rows: PledgeARRow[]; total: AgingBuckets }
  grandTotal: AgingBuckets
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptyBuckets(): AgingBuckets {
  return { current: 0, days31to60: 0, days61to90: 0, days90plus: 0, total: 0 }
}

function sumBuckets(...buckets: AgingBuckets[]): AgingBuckets {
  const result = emptyBuckets()
  for (const b of buckets) {
    result.current += b.current
    result.days31to60 += b.days31to60
    result.days61to90 += b.days61to90
    result.days90plus += b.days90plus
    result.total += b.total
  }
  return result
}

function ageBucket(daysOld: number, amount: number): AgingBuckets {
  const b = emptyBuckets()
  b.total = amount
  if (daysOld <= 30) {
    b.current = amount
  } else if (daysOld <= 60) {
    b.days31to60 = amount
  } else if (daysOld <= 90) {
    b.days61to90 = amount
  } else {
    b.days90plus = amount
  }
  return b
}

/**
 * For a given account, find all outstanding debit lines (debits not fully
 * offset by credits) and age them by transaction date.
 *
 * Strategy: pull individual debit lines with their transaction dates, compute
 * the account's net balance, then allocate that balance to the oldest debits
 * first (FIFO). This gives us realistic aging buckets.
 */
async function getAgingForAccount(accountId: number): Promise<AgingBuckets> {
  // Get the net balance first
  const [balanceRow] = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, accountId),
        eq(transactions.isVoided, false)
      )
    )

  const netBalance =
    (parseFloat(balanceRow.totalDebit) || 0) -
    (parseFloat(balanceRow.totalCredit) || 0)

  if (netBalance <= 0) return emptyBuckets()

  // Get individual debit lines ordered by date (oldest first) for FIFO aging
  const debitLines = await db
    .select({
      amount: transactionLines.debit,
      txDate: transactions.date,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, accountId),
        eq(transactions.isVoided, false),
        sql`${transactionLines.debit} IS NOT NULL`
      )
    )
    .orderBy(transactions.date)

  // FIFO: allocate remaining balance to oldest debits first
  const now = new Date()
  let remaining = netBalance
  const result = emptyBuckets()
  result.total = netBalance

  for (const line of debitLines) {
    if (remaining <= 0) break
    const lineAmount = parseFloat(line.amount ?? '0')
    if (lineAmount <= 0) continue

    const allocated = Math.min(lineAmount, remaining)
    remaining -= allocated

    const txDate = new Date(line.txDate)
    const daysOld = Math.floor(
      (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysOld <= 30) {
      result.current += allocated
    } else if (daysOld <= 60) {
      result.days31to60 += allocated
    } else if (daysOld <= 90) {
      result.days61to90 += allocated
    } else {
      result.days90plus += allocated
    }
  }

  // If any remaining balance wasn't allocated (shouldn't happen, but guard),
  // put it in 90+ bucket
  if (remaining > 0) {
    result.days90plus += remaining
  }

  return result
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getARAgingData(): Promise<ARAgingData> {
  // ---- Tenant AR ----
  // Approach: each active tenant's rent accrual hits account 1100 (Accounts
  // Receivable). The aggregate GL balance of 1100 tells us total tenant AR.
  // For per-tenant detail, we show active tenants and their monthly rent.
  // Aging comes from the GL transaction dates on account 1100.

  const [arAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '1100'))
    .limit(1)

  const [grantsRcvAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '1110'))
    .limit(1)

  const [pledgesRcvAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '1120'))
    .limit(1)

  // -- Tenant AR section --
  const tenantArAging = arAccount
    ? await getAgingForAccount(arAccount.id)
    : emptyBuckets()

  const activeTenants = await db
    .select({
      id: tenants.id,
      name: tenants.name,
      unitNumber: tenants.unitNumber,
      monthlyRent: tenants.monthlyRent,
      fundingSourceType: tenants.fundingSourceType,
      isActive: tenants.isActive,
    })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .orderBy(tenants.unitNumber)

  // Distribute the total tenant AR aging proportionally across active tenants
  // based on monthly rent. This is an approximation since we don't track
  // per-tenant GL balances directly.
  const totalMonthlyRent = activeTenants.reduce(
    (s, t) => s + (parseFloat(t.monthlyRent) || 0),
    0
  )

  const tenantRows: TenantARRow[] = activeTenants.map((t) => {
    const rent = parseFloat(t.monthlyRent) || 0
    const proportion = totalMonthlyRent > 0 ? rent / totalMonthlyRent : 0
    const outstanding = tenantArAging.total * proportion

    const aging: AgingBuckets = {
      current: tenantArAging.current * proportion,
      days31to60: tenantArAging.days31to60 * proportion,
      days61to90: tenantArAging.days61to90 * proportion,
      days90plus: tenantArAging.days90plus * proportion,
      total: outstanding,
    }

    return {
      tenantId: t.id,
      tenantName: t.name,
      unitNumber: t.unitNumber,
      fundingSourceType: t.fundingSourceType,
      isVASH: t.fundingSourceType === 'VASH',
      outstanding,
      aging,
    }
  })

  // Filter out tenants with zero outstanding balance
  const filteredTenantRows = tenantRows.filter((r) => r.aging.total > 0.005)

  // -- Grant AR section --
  const grantArAging = grantsRcvAccount
    ? await getAgingForAccount(grantsRcvAccount.id)
    : emptyBuckets()

  const activeGrants = await db
    .select({
      id: grants.id,
      amount: grants.amount,
      funderName: vendors.name,
      startDate: grants.startDate,
    })
    .from(grants)
    .innerJoin(vendors, eq(grants.funderId, vendors.id))
    .where(eq(grants.status, 'ACTIVE'))
    .orderBy(vendors.name)

  // Distribute grants receivable proportionally across active grants by amount
  const totalGrantAmount = activeGrants.reduce(
    (s, g) => s + (parseFloat(g.amount) || 0),
    0
  )

  const grantRows: GrantARRow[] = activeGrants.map((g) => {
    const grantAmt = parseFloat(g.amount) || 0
    const proportion = totalGrantAmount > 0 ? grantAmt / totalGrantAmount : 0
    const receivableBalance = grantArAging.total * proportion

    const aging: AgingBuckets = {
      current: grantArAging.current * proportion,
      days31to60: grantArAging.days31to60 * proportion,
      days61to90: grantArAging.days61to90 * proportion,
      days90plus: grantArAging.days90plus * proportion,
      total: receivableBalance,
    }

    return {
      grantId: g.id,
      funderName: g.funderName,
      grantAmount: grantAmt,
      receivableBalance,
      aging,
    }
  })

  const filteredGrantRows = grantRows.filter((r) => r.aging.total > 0.005)

  // -- Pledge AR section --
  // Only pledges with status PLEDGED are outstanding
  const outstandingPledges = await db
    .select({
      id: pledges.id,
      amount: pledges.amount,
      donorName: donors.name,
      expectedDate: pledges.expectedDate,
      createdAt: pledges.createdAt,
    })
    .from(pledges)
    .innerJoin(donors, eq(pledges.donorId, donors.id))
    .where(eq(pledges.status, 'PLEDGED'))
    .orderBy(donors.name)

  // For pledges, use per-pledge aging based on expectedDate (or createdAt).
  // Each outstanding pledge represents its own receivable.
  const now = new Date()
  const pledgeRows: PledgeARRow[] = outstandingPledges.map((p) => {
    const pledgeAmt = parseFloat(p.amount) || 0
    const ageFromDate = p.expectedDate
      ? new Date(p.expectedDate)
      : p.createdAt
    const daysOld = Math.max(
      0,
      Math.floor((now.getTime() - ageFromDate.getTime()) / (1000 * 60 * 60 * 24))
    )

    const aging = ageBucket(daysOld, pledgeAmt)

    return {
      pledgeId: p.id,
      donorName: p.donorName,
      pledgeAmount: pledgeAmt,
      receivableBalance: pledgeAmt,
      aging,
    }
  })

  // -- Totals --
  const tenantTotal =
    filteredTenantRows.length > 0
      ? filteredTenantRows.reduce(
          (acc, r) => sumBuckets(acc, r.aging),
          emptyBuckets()
        )
      : emptyBuckets()

  const grantTotal =
    filteredGrantRows.length > 0
      ? filteredGrantRows.reduce(
          (acc, r) => sumBuckets(acc, r.aging),
          emptyBuckets()
        )
      : emptyBuckets()

  const pledgeTotal =
    pledgeRows.length > 0
      ? pledgeRows.reduce(
          (acc, r) => sumBuckets(acc, r.aging),
          emptyBuckets()
        )
      : emptyBuckets()

  const grandTotal = sumBuckets(tenantTotal, grantTotal, pledgeTotal)

  return {
    tenantAR: { rows: filteredTenantRows, total: tenantTotal },
    grantAR: { rows: filteredGrantRows, total: grantTotal },
    pledgeAR: { rows: pledgeRows, total: pledgeTotal },
    grandTotal,
  }
}
