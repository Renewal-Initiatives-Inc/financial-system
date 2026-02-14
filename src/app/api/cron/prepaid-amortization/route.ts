import { NextResponse } from 'next/server'
import { generateAmortizationEntries } from '@/lib/assets/prepaid-amortization'

export async function POST(request: Request) {
  // Verify Vercel cron authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await generateAmortizationEntries(today, 'system:cron')

    return NextResponse.json({
      success: true,
      entriesCreated: result.entriesCreated,
      totalAmount: result.totalAmount,
    })
  } catch (error) {
    console.error('Prepaid amortization cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
