import { NextResponse } from 'next/server'

/**
 * Interest accrual cron job.
 *
 * Previously accrued AHP loan interest monthly. The AHP singleton has been
 * removed — interest accrual will be reimplemented per-funding-source in
 * Phase 8 (Loan GL Logic + Interest Rate Tracking).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.json({
    success: true,
    message: 'Interest accrual disabled — pending Phase 8 reimplementation for funding-source-based loans',
  })
}
