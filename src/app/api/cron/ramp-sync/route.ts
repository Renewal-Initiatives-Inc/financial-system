import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { rampTransactions } from '@/lib/db/schema'
import { fetchTransactions } from '@/lib/integrations/ramp'
import { sendSyncFailureEmail } from '@/lib/integrations/ramp-sync-notification'
import { autoCategorize, batchPostCategorized } from '@/lib/ramp/categorization'

/**
 * Ramp daily sync cron job (INT-P0-015).
 *
 * Runs daily at 6 AM UTC via Vercel cron.
 * - Fetches cleared transactions from the last 7 days
 * - Deduplicates via ramp_id UNIQUE constraint (ON CONFLICT DO NOTHING)
 * - Runs auto-categorization rules on new transactions
 * - Batch-posts auto-categorized transactions to GL
 * - Sends Postmark alert on failure
 */
export async function POST(req: Request) {
  // Verify cron secret (Vercel cron security)
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    // Fetch transactions from the last 7 days (idempotent window)
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const fromDate = sevenDaysAgo.toISOString().substring(0, 10)
    const toDate = now.toISOString().substring(0, 10)

    const transactions = await fetchTransactions({
      from_date: fromDate,
      to_date: toDate,
    })

    let synced = 0
    let autoCategorized = 0
    const newIds: number[] = []

    // Insert with dedup via ON CONFLICT DO NOTHING
    for (const txn of transactions) {
      const result = await db
        .insert(rampTransactions)
        .values({
          rampId: txn.rampId,
          date: txn.date,
          amount: String(txn.amount),
          merchantName: txn.merchantName,
          description: txn.description,
          cardholder: txn.cardholder,
          status: 'uncategorized',
        })
        .onConflictDoNothing({ target: rampTransactions.rampId })
        .returning({ id: rampTransactions.id })

      if (result.length > 0) {
        synced++
        newIds.push(result[0].id)
      }
    }

    // Run auto-categorization on new transactions
    for (const id of newIds) {
      const categorized = await autoCategorize(id)
      if (categorized) autoCategorized++
    }

    // Batch-post auto-categorized transactions
    const postResult = await batchPostCategorized('system-ramp-sync')

    return NextResponse.json({
      success: true,
      synced,
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
