/**
 * Funding source GL operations.
 *
 * Handles unconditional funding (immediate revenue recognition),
 * conditional funding (refundable advance until conditions met),
 * cash receipts, and loan proceeds/repayments.
 */

import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, funds, transactions, transactionLines } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

/**
 * Resolve the revenue account code for a fund based on its classification.
 * GRANT_REVENUE → 4100, EARNED_INCOME → 4300, fallback → 4100.
 */
async function getRevenueAccountCode(fundId: number): Promise<string> {
  const [fund] = await db
    .select({ revenueClassification: funds.revenueClassification })
    .from(funds)
    .where(eq(funds.id, fundId))
  return fund?.revenueClassification === 'EARNED_INCOME' ? '4300' : '4100'
}

/**
 * Record an unconditional funding source.
 * GL: DR Grants Receivable (1110), CR revenue account (4100 or 4300) — coded to restricted fund.
 */
export async function recordUnconditionalFunding(
  fundId: number,
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const revenueCode = await getRevenueAccountCode(fundId)
  const [grantsReceivable] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1110'))
  const [revenueAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, revenueCode))

  if (!grantsReceivable || !revenueAccount) {
    throw new Error(
      `Required accounts not found: Grants Receivable (1110) and/or Revenue (${revenueCode})`
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Unconditional funding revenue recognition - Fund #${fundId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `fund:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: grantsReceivable.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: revenueAccount.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Record cash receipt on an unconditional funding source.
 * GL: DR Cash (1000), CR Grants Receivable (1110)
 */
export async function recordFundCashReceipt(
  fundId: number,
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  const [grantsReceivable] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1110'))

  if (!cashAccount || !grantsReceivable) {
    throw new Error(
      'Required accounts not found: Cash (1000) and/or Grants Receivable (1110)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Funding source cash receipt - Fund #${fundId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `fund-receipt:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: grantsReceivable.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Record cash received on a conditional funding source.
 * GL: DR Cash (1000), CR Refundable Advance (2050)
 * No revenue recognition until conditions are met.
 */
export async function recordConditionalFundingCash(
  fundId: number,
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  const [refundableAdvance] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2050'))

  if (!cashAccount || !refundableAdvance) {
    throw new Error(
      'Required accounts not found: Cash (1000) and/or Refundable Advance (2050)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Conditional funding cash received - Fund #${fundId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `fund-conditional-cash:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: refundableAdvance.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Recognize revenue for a conditional funding source when conditions are met.
 * GL: DR Refundable Advance (2050), CR revenue account (4100 or 4300)
 */
export async function recognizeConditionalRevenue(
  fundId: number,
  amount: number,
  date: string,
  note: string,
  userId: string
): Promise<{ transactionId: number }> {
  const revenueCode = await getRevenueAccountCode(fundId)
  const [refundableAdvance] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2050'))
  const [revenueAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, revenueCode))

  if (!refundableAdvance || !revenueAccount) {
    throw new Error(
      `Required accounts not found: Refundable Advance (2050) and/or Revenue (${revenueCode})`
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Conditional funding revenue recognition - Fund #${fundId}: ${note}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `fund-condition-met:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: refundableAdvance.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: revenueAccount.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

// ---------------------------------------------------------------------------
// Loan GL operations
// ---------------------------------------------------------------------------

/**
 * Record loan proceeds received.
 * GL: DR Cash (1000), CR Loans Payable (2500) — balance sheet only, not revenue.
 */
export async function recordLoanProceeds(
  fundId: number,
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  const [loanPayable] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2500'))

  if (!cashAccount || !loanPayable) {
    throw new Error(
      'Required accounts not found: Cash (1000) and/or Loan Payable (2500)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Loan proceeds received - Fund #${fundId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `loan-proceeds:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: loanPayable.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Record loan repayment (principal only).
 * GL: DR Loans Payable (2500), CR Cash (1000)
 */
export async function recordLoanRepayment(
  fundId: number,
  amount: number,
  date: string,
  note: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  const [loanPayable] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2500'))

  if (!cashAccount || !loanPayable) {
    throw new Error(
      'Required accounts not found: Cash (1000) and/or Loan Payable (2500)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Loan repayment - Fund #${fundId}: ${note}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `loan-repayment:${fundId}`,
    createdBy: userId,
    lines: [
      {
        accountId: loanPayable.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: cashAccount.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Record loan interest payment.
 *
 * If an accrual exists (balance on 2520 for this fund), the payment reverses
 * the accrual: DR 2520 Accrued Interest Payable / CR 1000 Cash.
 * Any excess above the accrued amount goes to DR 5100 Interest Expense.
 *
 * If no accrual exists, the full payment goes to DR 5100 Interest Expense / CR 1000 Cash.
 */
export async function recordLoanInterestPayment(
  fundId: number,
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  const [interestExpense] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '5100'))
  const [accruedInterest] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2520'))

  if (!cashAccount || !interestExpense) {
    throw new Error(
      'Required accounts not found: Cash (1000) and/or Interest Expense (5100)'
    )
  }

  // Check outstanding accrual balance on 2520 for this fund
  let accruedBalance = 0
  if (accruedInterest) {
    const [result] = await db
      .select({
        balance: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0) - COALESCE(SUM(${transactionLines.debit}), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          eq(transactionLines.accountId, accruedInterest.id),
          eq(transactionLines.fundId, fundId),
          eq(transactions.isVoided, false)
        )
      )
    accruedBalance = parseFloat(result?.balance ?? '0')
  }

  // Build lines: apply payment against accrual first, then expense for any remainder
  const lines: Array<{
    accountId: number
    fundId: number
    debit: number | null
    credit: number | null
  }> = []

  if (accruedBalance > 0 && accruedInterest) {
    const accrualPortion = Math.min(accruedBalance, amount)
    const expensePortion = Math.round((amount - accrualPortion) * 100) / 100

    // Reverse accrual
    lines.push({
      accountId: accruedInterest.id,
      fundId,
      debit: accrualPortion,
      credit: null,
    })

    // Any excess goes to expense
    if (expensePortion > 0) {
      lines.push({
        accountId: interestExpense.id,
        fundId,
        debit: expensePortion,
        credit: null,
      })
    }
  } else {
    // No accrual — full amount to expense
    lines.push({
      accountId: interestExpense.id,
      fundId,
      debit: amount,
      credit: null,
    })
  }

  // Credit side: Cash
  lines.push({
    accountId: cashAccount.id,
    fundId,
    debit: null,
    credit: amount,
  })

  const txnResult = await createTransaction({
    date,
    memo: `Loan interest payment - Fund #${fundId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `loan-interest:${fundId}`,
    createdBy: userId,
    lines,
  })

  return { transactionId: txnResult.transaction.id }
}
