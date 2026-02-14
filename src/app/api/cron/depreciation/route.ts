import { NextResponse } from 'next/server'
import { generateDepreciationEntries } from '@/lib/assets/depreciation'

export async function POST(request: Request) {
  // Verify Vercel cron authorization
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await generateDepreciationEntries(today, 'system:cron')

    return NextResponse.json({
      success: true,
      entriesCreated: result.entriesCreated,
      totalAmount: result.totalAmount,
      details: result.details,
    })
  } catch (error) {
    console.error('Depreciation cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
