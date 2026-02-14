import { NextResponse } from 'next/server'
import { processReceivedStagingRecords } from '@/lib/staging/processor'

/**
 * Staging records processor cron job (INT-P0-004).
 *
 * Runs every 15 minutes via Vercel cron.
 * - Processes received expense reports into GL entries
 * - Acknowledges timesheets (left for payroll processing)
 * - Idempotent: already-posted records are skipped
 */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = req.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  try {
    const result = await processReceivedStagingRecords()

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Staging processor cron failed:', message)

    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
