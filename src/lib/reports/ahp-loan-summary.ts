import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  ahpLoanConfig,
  annualRateConfig,
  transactions,
  transactionLines,
  accounts,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AHPSummary {
  creditLimit: number
  currentDrawnAmount: number
  availableCredit: number
  currentInterestRate: number
  rateEffectiveDate: string
  annualPaymentDate: string
  lastPaymentDate: string | null
}

export interface InterestAccrualEntry {
  date: string
  amount: number
  runningTotal: number
  memo: string
}

export interface DrawPaymentEntry {
  date: string
  amount: number
  type: 'draw' | 'payment'
  memo: string
}

export interface RateHistoryEntry {
  fiscalYear: number
  rate: number
  effectiveDate: string | null
  notes: string | null
}

export interface AHPLoanSummaryData {
  summary: AHPSummary | null
  interestAccruals: InterestAccrualEntry[]
  drawPaymentHistory: DrawPaymentEntry[]
  rateHistory: RateHistoryEntry[]
  totalInterestAccrued: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getAHPLoanSummaryData(): Promise<AHPLoanSummaryData> {
  const now = new Date().toISOString()

  // 1. Get AHP loan config
  const configs = await db.select().from(ahpLoanConfig).limit(1)

  if (configs.length === 0) {
    return {
      summary: null,
      interestAccruals: [],
      drawPaymentHistory: [],
      rateHistory: [],
      totalInterestAccrued: 0,
      generatedAt: now,
    }
  }

  const config = configs[0]
  const creditLimit = parseFloat(config.creditLimit)
  const drawn = parseFloat(config.currentDrawnAmount)

  const summary: AHPSummary = {
    creditLimit,
    currentDrawnAmount: drawn,
    availableCredit: creditLimit - drawn,
    currentInterestRate: parseFloat(config.currentInterestRate),
    rateEffectiveDate: config.rateEffectiveDate,
    annualPaymentDate: config.annualPaymentDate,
    lastPaymentDate: config.lastPaymentDate,
  }

  // 2. Get interest accrual transactions (SYSTEM transactions against interest accounts)
  const interestAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.isActive, true),
        sql`(${accounts.name} ILIKE '%interest%payable%' OR ${accounts.name} ILIKE '%interest%expense%' OR ${accounts.name} ILIKE '%accrued interest%')`
      )
    )

  const interestAccountIds = interestAccounts.map((a) => a.id)
  let interestAccruals: InterestAccrualEntry[] = []
  let totalInterestAccrued = 0

  if (interestAccountIds.length > 0) {
    const interestTxns = await db
      .select({
        date: transactions.date,
        memo: transactions.memo,
        credit: transactionLines.credit,
        debit: transactionLines.debit,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(
            interestAccountIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          eq(transactions.isVoided, false),
          sql`${transactions.sourceType} = 'SYSTEM'`
        )
      )
      .orderBy(transactions.date)

    let running = 0
    interestAccruals = interestTxns.map((t) => {
      const amount = parseFloat(t.credit ?? '0') || parseFloat(t.debit ?? '0')
      running += amount
      return {
        date: t.date,
        amount: Math.round(amount * 100) / 100,
        runningTotal: Math.round(running * 100) / 100,
        memo: t.memo,
      }
    })
    totalInterestAccrued = Math.round(running * 100) / 100
  }

  // 3. Get AHP draw/payment history (transactions against AHP Loan Payable)
  const loanAccounts = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.isActive, true),
        sql`${accounts.name} ILIKE '%ahp%loan%'`
      )
    )

  const loanAccountIds = loanAccounts.map((a) => a.id)
  let drawPaymentHistory: DrawPaymentEntry[] = []

  if (loanAccountIds.length > 0) {
    const loanTxns = await db
      .select({
        date: transactions.date,
        memo: transactions.memo,
        credit: transactionLines.credit,
        debit: transactionLines.debit,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(
            loanAccountIds.map((id) => sql`${id}`),
            sql`, `
          )})`,
          eq(transactions.isVoided, false)
        )
      )
      .orderBy(desc(transactions.date))

    drawPaymentHistory = loanTxns.map((t) => {
      const credit = parseFloat(t.credit ?? '0')
      const debit = parseFloat(t.debit ?? '0')
      // Credit to loan payable = draw (increases liability)
      // Debit to loan payable = payment (decreases liability)
      return {
        date: t.date,
        amount: Math.round(Math.max(credit, debit) * 100) / 100,
        type: (credit > 0 ? 'draw' : 'payment') as 'draw' | 'payment',
        memo: t.memo,
      }
    })
  }

  // 4. Get rate history from annualRateConfig
  const rateEntries = await db
    .select()
    .from(annualRateConfig)
    .where(sql`${annualRateConfig.configKey} ILIKE '%ahp%interest%rate%'`)
    .orderBy(desc(annualRateConfig.fiscalYear))

  const rateHistory: RateHistoryEntry[] = rateEntries.map((r) => ({
    fiscalYear: r.fiscalYear,
    rate: parseFloat(r.value),
    effectiveDate: r.effectiveDate,
    notes: r.notes,
  }))

  return {
    summary,
    interestAccruals,
    drawPaymentHistory,
    rateHistory,
    totalInterestAccrued,
    generatedAt: now,
  }
}
