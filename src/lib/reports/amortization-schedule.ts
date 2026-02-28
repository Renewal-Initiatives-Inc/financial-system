import { eq, and, desc, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  funds,
  vendors,
  accounts,
  transactionLines,
  transactions,
  fundingSourceRateHistory,
} from '@/lib/db/schema'
import { calculatePeriodInterest } from '@/lib/assets/interest-accrual'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LoanSummary {
  fundId: number
  fundName: string
  lenderName: string | null
  principalAmount: number
  currentRate: number | null
  startDate: string | null
  endDate: string | null
  outstandingBalance: number
}

export interface AmortizationRow {
  period: number
  date: string
  beginningBalance: number
  payment: number
  principal: number
  interest: number
  endingBalance: number
}

export interface AmortizationScheduleData {
  loan: LoanSummary
  schedule: AmortizationRow[]
  totalPayments: number
  totalPrincipal: number
  totalInterest: number
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

/**
 * Get all LOAN-category funding sources for the loan selector.
 */
export async function getLoanFundingSources(): Promise<LoanSummary[]> {
  const loanFunds = await db
    .select({
      id: funds.id,
      name: funds.name,
      amount: funds.amount,
      interestRate: funds.interestRate,
      startDate: funds.startDate,
      endDate: funds.endDate,
      lenderName: vendors.name,
    })
    .from(funds)
    .leftJoin(vendors, eq(funds.funderId, vendors.id))
    .where(eq(funds.fundingCategory, 'LOAN'))
    .orderBy(funds.name)

  const result: LoanSummary[] = []
  for (const loan of loanFunds) {
    // Calculate outstanding balance from GL:
    // Loan Payable (2500) is a credit-normal account.
    // Outstanding = sum of credits - sum of debits on 2500 for this fund.
    const balanceResult = await db
      .select({
        balance: sql<string>`COALESCE(SUM(
          COALESCE(${transactionLines.credit}, 0) - COALESCE(${transactionLines.debit}, 0)
        ), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactionLines.fundId, loan.id),
          eq(transactions.isVoided, false),
          eq(accounts.code, '2500')
        )
      )

    const outstanding = parseFloat(balanceResult[0]?.balance ?? '0')

    result.push({
      fundId: loan.id,
      fundName: loan.name,
      lenderName: loan.lenderName ?? null,
      principalAmount: loan.amount ? parseFloat(loan.amount) : 0,
      currentRate: loan.interestRate ? parseFloat(loan.interestRate) : null,
      startDate: loan.startDate,
      endDate: loan.endDate,
      outstandingBalance: outstanding,
    })
  }

  return result
}

/**
 * Generate an amortization schedule for a specific loan.
 * Uses fixed monthly payments calculated from principal, rate, and term.
 */
export async function generateAmortizationSchedule(
  fundId: number
): Promise<AmortizationScheduleData | null> {
  const loans = await getLoanFundingSources()
  const loan = loans.find((l) => l.fundId === fundId)
  if (!loan) return null

  // Get the rate history to use the initial rate for the schedule
  const [rateEntry] = await db
    .select({ rate: fundingSourceRateHistory.rate })
    .from(fundingSourceRateHistory)
    .where(eq(fundingSourceRateHistory.fundId, fundId))
    .orderBy(fundingSourceRateHistory.effectiveDate)
    .limit(1)

  const annualRate = rateEntry
    ? parseFloat(rateEntry.rate)
    : loan.currentRate ?? 0

  if (!loan.startDate || !loan.endDate || annualRate <= 0 || loan.principalAmount <= 0) {
    // Return empty schedule if we don't have enough data
    return {
      loan,
      schedule: [],
      totalPayments: 0,
      totalPrincipal: 0,
      totalInterest: 0,
    }
  }

  const monthlyRate = annualRate / 12
  const startDate = new Date(loan.startDate + 'T00:00:00')
  const endDate = new Date(loan.endDate + 'T00:00:00')

  // Calculate total months
  const totalMonths =
    (endDate.getFullYear() - startDate.getFullYear()) * 12 +
    (endDate.getMonth() - startDate.getMonth())

  if (totalMonths <= 0) {
    return {
      loan,
      schedule: [],
      totalPayments: 0,
      totalPrincipal: 0,
      totalInterest: 0,
    }
  }

  // Fixed monthly payment (standard amortization formula)
  // M = P * [r(1+r)^n] / [(1+r)^n - 1]
  const compoundFactor = Math.pow(1 + monthlyRate, totalMonths)
  const monthlyPayment =
    loan.principalAmount * (monthlyRate * compoundFactor) / (compoundFactor - 1)

  const schedule: AmortizationRow[] = []
  let balance = loan.principalAmount
  let totalPayments = 0
  let totalPrincipal = 0
  let totalInterest = 0

  for (let period = 1; period <= totalMonths; period++) {
    const periodDate = new Date(startDate)
    periodDate.setMonth(periodDate.getMonth() + period)
    const dateStr = periodDate.toISOString().split('T')[0]

    const interestForPeriod = Math.round(balance * monthlyRate * 100) / 100
    const principalForPeriod =
      period === totalMonths
        ? Math.round(balance * 100) / 100 // Last payment pays off remaining
        : Math.round((monthlyPayment - interestForPeriod) * 100) / 100
    const payment =
      period === totalMonths
        ? Math.round((principalForPeriod + interestForPeriod) * 100) / 100
        : Math.round(monthlyPayment * 100) / 100

    const endingBalance = Math.round((balance - principalForPeriod) * 100) / 100

    schedule.push({
      period,
      date: dateStr,
      beginningBalance: Math.round(balance * 100) / 100,
      payment,
      principal: principalForPeriod,
      interest: interestForPeriod,
      endingBalance: Math.max(0, endingBalance),
    })

    totalPayments += payment
    totalPrincipal += principalForPeriod
    totalInterest += interestForPeriod
    balance = Math.max(0, endingBalance)
  }

  return {
    loan,
    schedule,
    totalPayments: Math.round(totalPayments * 100) / 100,
    totalPrincipal: Math.round(totalPrincipal * 100) / 100,
    totalInterest: Math.round(totalInterest * 100) / 100,
  }
}
