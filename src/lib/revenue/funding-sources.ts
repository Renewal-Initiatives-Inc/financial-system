/**
 * Funding source revenue operations.
 *
 * Handles unconditional funding (immediate revenue recognition),
 * conditional funding (refundable advance until conditions met),
 * and cash receipts.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, funds } from '@/lib/db/schema'
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
