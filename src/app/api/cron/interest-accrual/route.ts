import { NextResponse } from 'next/server'
import { generateInterestAccrualEntry } from '@/lib/assets/interest-accrual'

export async function GET(request: Request) {
  // Verify Vercel cron authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await generateInterestAccrualEntry(today, 'system:cron')

    if (!result) {
      return NextResponse.json({
        success: true,
        message: 'No interest to accrue (zero drawn amount or already processed)',
      })
    }

    return NextResponse.json({
      success: true,
      mode: result.mode,
      amount: result.amount,
      transactionId: result.transactionId,
    })
  } catch (error) {
    console.error('Interest accrual cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
