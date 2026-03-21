import { NextResponse } from 'next/server'
import { checkAndSendReminders } from '@/lib/compliance/reminder-sender'
import { syncComplianceCalendar } from '@/lib/google-calendar/sync-engine'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkAndSendReminders()

    // Sync compliance deadlines to Google Calendar if configured
    let calendarSync: { created: number; updated: number; deleted: number } | null = null
    if (process.env.GOOGLE_CALENDAR_ID && process.env.GOOGLE_CALENDAR_REFRESH_TOKEN) {
      calendarSync = await syncComplianceCalendar()
    }

    return NextResponse.json({
      success: true,
      reminders30d: result.reminders30d,
      reminders7d: result.reminders7d,
      ...(calendarSync && { calendarSync }),
    })
  } catch (error) {
    console.error('Compliance reminders cron error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
