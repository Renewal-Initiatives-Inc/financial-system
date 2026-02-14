/**
 * AHP (Affordable Housing Program) loan operations.
 *
 * The AHP loan is a singleton config row tracking the credit facility.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { ahpLoanConfig, accounts, funds } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

export type AhpLoanStatus = typeof ahpLoanConfig.$inferSelect

export async function getAhpLoanConfig(): Promise<AhpLoanStatus | null> {
  const [config] = await db.select().from(ahpLoanConfig).limit(1)
  return config ?? null
}

export function getAvailableCredit(config: AhpLoanStatus): number {
  return parseFloat(config.creditLimit) - parseFloat(config.currentDrawnAmount)
}

/**
 * Record AHP loan forgiveness.
 *
 * GL: DR AHP Loan Payable (2100), CR Donation Income (4200)
 * Updates: reduces creditLimit permanently by forgiven amount.
 */
export async function recordLoanForgiveness(
  amount: number,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  // Lookup required accounts
  const [loanPayableAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2100'))
  const [donationIncomeAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '4200'))

  if (!loanPayableAccount || !donationIncomeAccount) {
    throw new Error(
      'Required accounts not found: AHP Loan Payable (2100) and/or Donation Income (4200)'
    )
  }

  // Lookup General Fund
  const [generalFund] = await db
    .select()
    .from(funds)
    .where(eq(funds.name, 'General Fund'))

  if (!generalFund) {
    throw new Error('General Fund not found')
  }

  // Get current config
  const config = await getAhpLoanConfig()
  if (!config) {
    throw new Error('AHP loan configuration not found')
  }

  if (amount > parseFloat(config.currentDrawnAmount)) {
    throw new Error(
      `Forgiveness amount ($${amount.toFixed(2)}) exceeds current drawn amount ($${config.currentDrawnAmount})`
    )
  }

  // Create GL entry
  const txnResult = await createTransaction({
    date,
    memo: `AHP loan forgiveness - $${amount.toFixed(2)}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: loanPayableAccount.id,
        fundId: generalFund.id,
        debit: amount,
        credit: null,
      },
      {
        accountId: donationIncomeAccount.id,
        fundId: generalFund.id,
        debit: null,
        credit: amount,
      },
    ],
  })

  // Update AHP loan config: reduce credit limit permanently
  const newCreditLimit =
    parseFloat(config.creditLimit) - amount
  const newDrawnAmount =
    parseFloat(config.currentDrawnAmount) - amount

  await db
    .update(ahpLoanConfig)
    .set({
      creditLimit: String(newCreditLimit),
      currentDrawnAmount: String(newDrawnAmount),
      updatedAt: new Date(),
    })
    .where(eq(ahpLoanConfig.id, config.id))

  return { transactionId: txnResult.transaction.id }
}
