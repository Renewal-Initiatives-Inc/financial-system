/**
 * Grant revenue operations.
 *
 * Handles unconditional grants (immediate revenue recognition),
 * conditional grants (refundable advance until conditions met),
 * and cash receipts.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { grants, accounts, funds } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

/**
 * Record an unconditional grant.
 * GL: DR Grants Receivable (1110), CR Grant Revenue (4100) — coded to restricted fund.
 */
export async function recordUnconditionalGrant(
  grantId: number,
  amount: number,
  fundId: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [grantsReceivable] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1110'))
  const [grantRevenue] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '4100'))

  if (!grantsReceivable || !grantRevenue) {
    throw new Error(
      'Required accounts not found: Grants Receivable (1110) and/or Grant Revenue (4100)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Unconditional grant revenue recognition - Grant #${grantId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `grant:${grantId}`,
    createdBy: userId,
    lines: [
      {
        accountId: grantsReceivable.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: grantRevenue.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}

/**
 * Record cash receipt on an unconditional grant.
 * GL: DR Cash (1000), CR Grants Receivable (1110)
 */
export async function recordGrantCashReceipt(
  grantId: number,
  amount: number,
  fundId: number,
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
    memo: `Grant cash receipt - Grant #${grantId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `grant-receipt:${grantId}`,
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
 * Record cash received on a conditional grant.
 * GL: DR Cash (1000), CR Refundable Advance (2050)
 * No revenue recognition until conditions are met.
 */
export async function recordConditionalGrantCash(
  grantId: number,
  amount: number,
  fundId: number,
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
    memo: `Conditional grant cash received - Grant #${grantId}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `grant-conditional-cash:${grantId}`,
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
 * Recognize revenue for a conditional grant when conditions are met.
 * GL: DR Refundable Advance (2050), CR Grant Revenue (4100)
 */
export async function recognizeConditionalGrant(
  grantId: number,
  amount: number,
  fundId: number,
  date: string,
  note: string,
  userId: string
): Promise<{ transactionId: number }> {
  const [refundableAdvance] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2050'))
  const [grantRevenue] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '4100'))

  if (!refundableAdvance || !grantRevenue) {
    throw new Error(
      'Required accounts not found: Refundable Advance (2050) and/or Grant Revenue (4100)'
    )
  }

  const txnResult = await createTransaction({
    date,
    memo: `Conditional grant revenue recognition - Grant #${grantId}: ${note}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `grant-condition-met:${grantId}`,
    createdBy: userId,
    lines: [
      {
        accountId: refundableAdvance.id,
        fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: grantRevenue.id,
        fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  return { transactionId: txnResult.transaction.id }
}
