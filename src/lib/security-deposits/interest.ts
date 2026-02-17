import { eq, and, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  tenants,
  accounts,
  funds,
  securityDepositInterestPayments,
} from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

const MA_RATE_CAP = 0.05 // 5% per MA G.L. c. 186 § 15B

/**
 * Calculate deposit interest per MA law.
 * Interest = deposit × min(rate, 5%) × days / 365
 */
export function calculateDepositInterest(
  deposit: number,
  rate: number,
  periodStart: string,
  periodEnd: string
): number {
  if (deposit <= 0 || rate <= 0) return 0

  const effectiveRate = Math.min(rate, MA_RATE_CAP)
  const start = new Date(periodStart)
  const end = new Date(periodEnd)
  const days = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (days <= 0) return 0

  const interest = deposit * effectiveRate * (days / 365)
  return Math.round(interest * 100) / 100 // round to cents
}

async function getAccountByCode(code: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, code))
  if (!account) throw new Error(`Account ${code} not found`)
  return account
}

async function getGeneralFund() {
  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.name, 'General Fund'))
  if (!fund) throw new Error('General Fund not found')
  return fund
}

/**
 * Process interest entries for all tenants whose tenancy anniversary falls
 * in the given month. Called by the monthly cron job.
 */
export async function generateInterestEntries(
  asOfDate: string,
  userId: string
): Promise<{
  processed: number
  entriesCreated: number
  totalInterest: number
  skipped: string[]
  details: Array<{ tenantName: string; amount: number; transactionId: number }>
}> {
  const asOf = new Date(asOfDate)
  const currentMonth = asOf.getMonth() // 0-indexed
  const currentYear = asOf.getFullYear()

  // Find all active tenants with deposits and anniversaries in this month
  const allTenants = await db
    .select()
    .from(tenants)
    .where(
      and(
        eq(tenants.isActive, true),
        isNotNull(tenants.securityDepositAmount),
        isNotNull(tenants.tenancyAnniversary)
      )
    )

  const tenantsThisMonth = allTenants.filter((t) => {
    if (!t.tenancyAnniversary) return false
    const annivDate = new Date(t.tenancyAnniversary)
    return annivDate.getMonth() === currentMonth
  })

  const interestExpenseAccount = await getAccountByCode('5100')
  const cashAccount = await getAccountByCode('1000')
  const generalFund = await getGeneralFund()

  const skipped: string[] = []
  const details: Array<{ tenantName: string; amount: number; transactionId: number }> = []
  let totalInterest = 0

  for (const tenant of tenantsThisMonth) {
    const deposit = parseFloat(tenant.securityDepositAmount!)
    const rate = tenant.interestRate ? parseFloat(tenant.interestRate) : null

    if (!rate || rate <= 0) {
      skipped.push(`${tenant.name} (Unit ${tenant.unitNumber}): no interest rate set`)
      continue
    }

    if (deposit <= 0) {
      skipped.push(`${tenant.name} (Unit ${tenant.unitNumber}): zero deposit`)
      continue
    }

    // Calculate period: previous anniversary to current anniversary
    const anniversary = new Date(tenant.tenancyAnniversary!)
    const periodEnd = new Date(currentYear, anniversary.getMonth(), anniversary.getDate())
    const periodStart = new Date(periodEnd)
    periodStart.setFullYear(periodStart.getFullYear() - 1)

    const interest = calculateDepositInterest(
      deposit,
      rate,
      periodStart.toISOString().split('T')[0],
      periodEnd.toISOString().split('T')[0]
    )

    if (interest <= 0) continue

    // Create GL entry: DR Interest Expense (5100), CR Cash (1000)
    const txnResult = await createTransaction({
      date: periodEnd.toISOString().split('T')[0],
      memo: `Security deposit interest — ${tenant.name} (Unit ${tenant.unitNumber})`,
      sourceType: 'SYSTEM',
      isSystemGenerated: true,
      createdBy: userId,
      lines: [
        {
          accountId: interestExpenseAccount.id,
          fundId: generalFund.id,
          debit: interest,
          credit: null,
        },
        {
          accountId: cashAccount.id,
          fundId: generalFund.id,
          debit: null,
          credit: interest,
        },
      ],
    })

    // Record the interest payment
    await db.insert(securityDepositInterestPayments).values({
      tenantId: tenant.id,
      periodStart: periodStart.toISOString().split('T')[0],
      periodEnd: periodEnd.toISOString().split('T')[0],
      depositAmount: String(deposit),
      interestRate: String(Math.min(rate, MA_RATE_CAP)),
      interestAmount: String(interest),
      glTransactionId: txnResult.transaction.id,
      paidAt: new Date(),
    })

    // Audit
    await db.transaction(async (tx) => {
      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId,
        action: 'created',
        entityType: 'security_deposit_interest',
        entityId: tenant.id,
        afterState: {
          tenantId: tenant.id,
          interest,
          periodStart: periodStart.toISOString().split('T')[0],
          periodEnd: periodEnd.toISOString().split('T')[0],
          transactionId: txnResult.transaction.id,
        },
      })
    })

    totalInterest += interest
    details.push({
      tenantName: tenant.name,
      amount: interest,
      transactionId: txnResult.transaction.id,
    })
  }

  return {
    processed: tenantsThisMonth.length,
    entriesCreated: details.length,
    totalInterest,
    skipped,
    details,
  }
}
