import { NextResponse } from 'next/server'
import { runRentAccrualBatch } from '@/lib/revenue/rent-accrual'

export async function GET(request: Request) {
  // Verify Vercel cron authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Determine month: default to current month, or accept query params for backfill
    const { searchParams } = new URL(request.url)
    const now = new Date()
    const year = parseInt(searchParams.get('year') ?? String(now.getFullYear()))
    const month = parseInt(
      searchParams.get('month') ?? String(now.getMonth() + 1)
    )

    const result = await runRentAccrualBatch(year, month)

    return NextResponse.json({
      success: true,
      year,
      month,
      tenantsProcessed: result.tenantsProcessed,
      entriesCreated: result.entriesCreated,
      transactionIds: result.transactionIds,
      errors: result.errors,
    })
  } catch (error) {
    console.error('Rent accrual cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
