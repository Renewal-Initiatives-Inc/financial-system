import { NextResponse } from 'next/server'
import { checkAndSendReminders } from '@/lib/compliance/reminder-sender'

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAndSendReminders()

    return NextResponse.json({
      success: true,
      reminders30d: result.reminders30d,
      reminders7d: result.reminders7d,
    })
  } catch (error) {
    console.error('Compliance reminders cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
