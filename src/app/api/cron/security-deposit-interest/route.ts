import { NextResponse } from 'next/server'
import { generateInterestEntries } from '@/lib/security-deposits/interest'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    const result = await generateInterestEntries(today, 'system:cron')

    return NextResponse.json({
      success: true,
      processed: result.processed,
      entriesCreated: result.entriesCreated,
      totalInterest: result.totalInterest,
      skipped: result.skipped,
      details: result.details,
    })
  } catch (error) {
    console.error('Security deposit interest cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
