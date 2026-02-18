import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rampTransactions } from '@/lib/db/schema'
import { fetchTransactions } from '@/lib/integrations/ramp'
import { sendSyncFailureEmail } from '@/lib/integrations/ramp-sync-notification'
import { autoCategorize, batchPostCategorized } from '@/lib/ramp/categorization'

/**
 * Ramp daily sync cron job (INT-P0-015).
 *
 * Runs daily at 6 AM UTC via Vercel cron.
 * - Fetches cleared AND pending transactions from Ramp
 * - New transactions inserted; pending→cleared transitions update isPending flag
 * - Runs auto-categorization rules on newly cleared transactions
 * - Batch-posts auto-categorized transactions to GL
 * - Sends Postmark alert on failure
 */
export async function GET(req: Request) {
  // Verify cron secret (Vercel cron security)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Support ?full=true for initial full-history pull (all transactions from account opening)
    const url = new URL(req.url)
    const fullHistory = url.searchParams.get('full') === 'true'

    const now = new Date()
    const toDate = now.toISOString().substring(0, 10)
    let fromDate: string

    if (fullHistory) {
      // Pull from well before Ramp account opening
      fromDate = '2024-01-01'
      console.log('Ramp sync: full history mode (from 2024-01-01)')
    } else {
      // Normal daily sync: last 7 days (idempotent window)
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      fromDate = sevenDaysAgo.toISOString().substring(0, 10)
    }

    const transactions = await fetchTransactions({
      from_date: fromDate,
      to_date: toDate,
    })

    let synced = 0
    let cleared = 0
    let autoCategorized = 0
    const newClearedIds: number[] = []

    for (const txn of transactions) {
      // Try insert; on conflict (existing ramp_id), update isPending + amount
      // This handles pending→cleared transitions
      const result = await db
        .insert(rampTransactions)
        .values({
          rampId: txn.rampId,
          date: txn.date,
          amount: String(txn.amount),
          merchantName: txn.merchantName,
          description: txn.description,
          cardholder: txn.cardholder,
          isPending: txn.isPending,
          status: 'uncategorized',
        })
        .onConflictDoNothing({ target: rampTransactions.rampId })
        .returning({ id: rampTransactions.id })

      if (result.length > 0) {
        synced++
        // Only auto-categorize cleared transactions (not pending)
        if (!txn.isPending) {
          newClearedIds.push(result[0].id)
        }
      } else if (!txn.isPending) {
        // Existing row — check if it was pending and is now cleared
        const [existing] = await db
          .select({ id: rampTransactions.id, isPending: rampTransactions.isPending })
          .from(rampTransactions)
          .where(eq(rampTransactions.rampId, txn.rampId))

        if (existing?.isPending) {
          // Transition: pending → cleared
          await db
            .update(rampTransactions)
            .set({
              isPending: false,
              amount: String(txn.amount), // Amount may change when clearing
              date: txn.date,
            })
            .where(eq(rampTransactions.id, existing.id))
          cleared++
          newClearedIds.push(existing.id)
        }
      }
    }

    // Run auto-categorization on newly cleared transactions
    for (const id of newClearedIds) {
      const categorized = await autoCategorize(id)
      if (categorized) autoCategorized++
    }

    // Batch-post auto-categorized transactions
    const postResult = await batchPostCategorized('system-ramp-sync')

    return NextResponse.json({
      success: true,
      synced,
      cleared,
      autoCategorized,
      posted: postResult.posted,
      postFailed: postResult.failed,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Ramp sync failed:', message)

    // Send failure notification (INT-P0-017)
    await sendSyncFailureEmail(message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
