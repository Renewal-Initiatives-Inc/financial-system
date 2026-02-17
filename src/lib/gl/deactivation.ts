import { eq, sql } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { db } from '@/lib/db'
import { accounts, funds, transactions, transactionLines } from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import {
  EntityNotFoundError,
  SystemLockedError,
  NonZeroBalanceError,
} from './errors'

/**
 * Soft-delete an account (INV-013).
 *
 * Guards:
 * - Account must exist
 * - Account must not be system-locked
 * - Accounts with transaction history CAN be deactivated (DM-P0-003)
 */
export async function deactivateAccount(
  accountId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [account] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, accountId))

    if (!account) {
      throw new EntityNotFoundError('Account', accountId)
    }
    if (account.isSystemLocked) {
      throw new SystemLockedError('Account', accountId)
    }

    await tx
      .update(accounts)
      .set({ isActive: false })
      .where(eq(accounts.id, accountId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'deactivated',
      entityType: 'account',
      entityId: accountId,
      beforeState: { isActive: true },
      afterState: { isActive: false },
    })
  })
}

/**
 * Soft-delete a fund (INV-013, DM-P0-007).
 *
 * Guards:
 * - Fund must exist
 * - Fund must not be system-locked
 * - Fund must have zero balance (sum of all non-voided transaction lines)
 */
export async function deactivateFund(
  fundId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [fund] = await tx
      .select()
      .from(funds)
      .where(eq(funds.id, fundId))

    if (!fund) {
      throw new EntityNotFoundError('Fund', fundId)
    }
    if (fund.isSystemLocked) {
      throw new SystemLockedError('Fund', fundId)
    }

    // Calculate fund balance from non-voided transaction lines
    const [balanceResult] = await tx
      .select({
        netDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0) - COALESCE(SUM(${transactionLines.credit}), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        sql`${transactionLines.fundId} = ${fundId} AND ${transactions.isVoided} = false`
      )

    const netBalance = parseFloat(balanceResult?.netDebit ?? '0')

    if (Math.abs(netBalance) >= 0.005) {
      throw new NonZeroBalanceError(fundId, Math.abs(netBalance).toFixed(2))
    }

    await tx
      .update(funds)
      .set({ isActive: false })
      .where(eq(funds.id, fundId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'deactivated',
      entityType: 'fund',
      entityId: fundId,
      beforeState: { isActive: true },
      afterState: { isActive: false },
    })
  })
}
