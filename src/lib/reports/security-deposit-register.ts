import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  tenants,
  accounts,
  transactionLines,
  transactions,
  securityDepositInterestPayments,
} from '@/lib/db/schema'
import { calculateDepositInterest } from '@/lib/security-deposits/interest'

export interface RegisterRow {
  tenantId: number
  tenantName: string
  unitNumber: string
  depositAmount: number
  depositDate: string | null
  escrowBankRef: string | null
  interestRate: number | null
  interestAccrued: number
  interestPaidYtd: number
  tenancyAnniversary: string | null
  nextInterestDue: string | null
  isActive: boolean
}

export interface RegisterData {
  rows: RegisterRow[]
  totalDepositsHeld: number
  glLiabilityBalance: number // GL 2060
  glEscrowBalance: number // GL 1020
  hasVariance: boolean
}

async function getGlBalance(accountCode: string): Promise<number> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, accountCode))

  if (!account) return 0

  const result = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CAST(${transactionLines.credit} AS numeric)), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, account.id),
        eq(transactions.isVoided, false)
      )
    )

  if (!result[0]) return 0

  const debit = parseFloat(result[0].totalDebit)
  const credit = parseFloat(result[0].totalCredit)

  // For assets (1020): balance = debits - credits
  // For liabilities (2060): balance = credits - debits
  if (account.normalBalance === 'DEBIT') {
    return debit - credit
  }
  return credit - debit
}

export async function getSecurityDepositRegister(): Promise<RegisterData> {
  const allTenants = await db
    .select()
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .orderBy(tenants.unitNumber)

  const tenantsWithDeposits = allTenants.filter(
    (t) => t.securityDepositAmount && parseFloat(t.securityDepositAmount) > 0
  )

  const currentYear = new Date().getFullYear()
  const today = new Date()

  const rows: RegisterRow[] = []

  for (const tenant of tenantsWithDeposits) {
    const deposit = parseFloat(tenant.securityDepositAmount!)
    const rate = tenant.interestRate ? parseFloat(tenant.interestRate) : null

    // Calculate interest accrued since last payment
    let interestAccrued = 0
    if (rate && rate > 0 && tenant.tenancyAnniversary) {
      // Find last payment date (or use anniversary minus 1 year)
      const anniversary = new Date(tenant.tenancyAnniversary)
      const lastPeriodStart = new Date(anniversary)
      lastPeriodStart.setFullYear(lastPeriodStart.getFullYear() - 1)

      interestAccrued = calculateDepositInterest(
        deposit,
        rate,
        lastPeriodStart.toISOString().split('T')[0],
        today.toISOString().split('T')[0]
      )
    }

    // Get YTD interest paid
    const payments = await db
      .select()
      .from(securityDepositInterestPayments)
      .where(eq(securityDepositInterestPayments.tenantId, tenant.id))

    const interestPaidYtd = payments
      .filter((p) => {
        const paidDate = p.paidAt ? new Date(p.paidAt) : null
        return paidDate && paidDate.getFullYear() === currentYear
      })
      .reduce((sum, p) => sum + parseFloat(p.interestAmount), 0)

    // Next interest due date
    let nextInterestDue: string | null = null
    if (tenant.tenancyAnniversary) {
      const anniv = new Date(tenant.tenancyAnniversary)
      if (anniv >= today) {
        nextInterestDue = tenant.tenancyAnniversary
      } else {
        anniv.setFullYear(anniv.getFullYear() + 1)
        nextInterestDue = anniv.toISOString().split('T')[0]
      }
    }

    rows.push({
      tenantId: tenant.id,
      tenantName: tenant.name,
      unitNumber: tenant.unitNumber,
      depositAmount: deposit,
      depositDate: tenant.depositDate,
      escrowBankRef: tenant.escrowBankRef,
      interestRate: rate,
      interestAccrued,
      interestPaidYtd,
      tenancyAnniversary: tenant.tenancyAnniversary,
      nextInterestDue,
      isActive: tenant.isActive,
    })
  }

  const totalDepositsHeld = rows.reduce((sum, r) => sum + r.depositAmount, 0)
  const glLiabilityBalance = await getGlBalance('2060')
  const glEscrowBalance = await getGlBalance('1020')
  const hasVariance = Math.abs(totalDepositsHeld - glLiabilityBalance) > 0.01

  return {
    rows,
    totalDepositsHeld,
    glLiabilityBalance,
    glEscrowBalance,
    hasVariance,
  }
}
