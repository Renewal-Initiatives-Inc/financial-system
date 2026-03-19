import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, bankTransactions } from '@/lib/db/schema'
import { syncTransactions } from '@/lib/integrations/plaid'
import { sendPlaidSyncFailureEmail } from '@/lib/integrations/plaid-sync-notification'
import { decrypt } from '@/lib/encryption'
import { classifyBankTransactions } from '@/lib/bank-rec/matcher'
import { runDailyClose } from '@/lib/bank-rec/daily-close'
import { sendDailyCloseEmail } from '@/lib/notifications/daily-close'

/**
 * Plaid daily sync cron job (REC-P0-002, INT-P0-013).
 *
 * Runs daily at 7 AM UTC via Vercel cron.
 * - For each active bank account: decrypt token, call /transactions/sync
 * - Handles added/modified/removed transactions
 * - Updates cursor after successful sync
 * - Sends Postmark alert on failure per account
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const accounts = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))

  let accountsSynced = 0
  let transactionsAdded = 0
  let transactionsModified = 0
  const errors: string[] = []

  for (const account of accounts) {
    try {
      const accessToken = decrypt(account.plaidAccessToken)
      let cursor = account.plaidCursor
      let hasMore = true

      while (hasMore) {
        const result = await syncTransactions(
          accessToken,
          cursor,
          account.plaidAccountId ?? undefined
        )

        // Handle added transactions
        for (const txn of result.added) {
          await db
            .insert(bankTransactions)
            .values({
              bankAccountId: account.id,
              plaidTransactionId: txn.plaidTransactionId,
              amount: String(txn.amount),
              date: txn.date,
              merchantName: txn.merchantName,
              category: txn.category,
              isPending: txn.isPending,
              paymentChannel: txn.paymentChannel,
              rawData: txn.rawData,
            })
            .onConflictDoNothing({
              target: bankTransactions.plaidTransactionId,
            })

          transactionsAdded++
        }

        // Handle modified transactions (pending → posted transitions)
        for (const txn of result.modified) {
          await db
            .update(bankTransactions)
            .set({
              amount: String(txn.amount),
              date: txn.date,
              merchantName: txn.merchantName,
              category: txn.category,
              isPending: txn.isPending,
              paymentChannel: txn.paymentChannel,
              rawData: txn.rawData,
              updatedAt: new Date(),
            })
            .where(
              eq(
                bankTransactions.plaidTransactionId,
                txn.plaidTransactionId
              )
            )

          transactionsModified++
        }

        // Handle removed transactions
        for (const plaidId of result.removed) {
          await db
            .delete(bankTransactions)
            .where(eq(bankTransactions.plaidTransactionId, plaidId))
        }

        cursor = result.nextCursor
        hasMore = result.hasMore
      }

      // Update cursor and sync timestamp after successful sync
      await db
        .update(bankAccounts)
        .set({ plaidCursor: cursor, lastSyncedAt: new Date() })
        .where(eq(bankAccounts.id, account.id))

      // Classify newly synced transactions (writes tiers to bank_transactions rows)
      await classifyBankTransactions(account.id)

      accountsSynced++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Plaid sync failed for account ${account.name}:`, message)
      errors.push(`${account.name}: ${message}`)

      await sendPlaidSyncFailureEmail(message, account.name)
    }
  }

  // Phase 23a: Run daily close (auto-match + notification) after sync
  let dailyCloseResult = null
  try {
    dailyCloseResult = await runDailyClose()

    // Send daily close notification (skip if no new transactions were synced)
    if (transactionsAdded > 0 || transactionsModified > 0) {
      try {
        await sendDailyCloseEmail(dailyCloseResult)
      } catch (notifyErr) {
        console.error('Daily close notification failed:', notifyErr)
      }
    }
  } catch (dailyCloseErr) {
    console.error('Daily close auto-match failed:', dailyCloseErr)
    // Don't fail the entire cron — sync data is already committed
  }

  return NextResponse.json({
    success: errors.length === 0,
    accountsSynced,
    transactionsAdded,
    transactionsModified,
    errors,
    dailyClose: dailyCloseResult
      ? {
          autoMatched: dailyCloseResult.totals.autoMatched,
          pendingReview: dailyCloseResult.totals.pendingReview,
          exceptions: dailyCloseResult.totals.exceptions,
        }
      : null,
  })
}
