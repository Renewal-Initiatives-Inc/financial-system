import { auth } from '@/lib/auth'
import { getComplianceDeadlines } from './actions'
import { ComplianceCalendarClient } from './compliance-calendar-client'

export default async function CompliancePage() {
  const session = await auth()
  const deadlines = await getComplianceDeadlines()
  const googleCalendarId = process.env.GOOGLE_CALENDAR_ID ?? null
  return (
    <ComplianceCalendarClient
      initialDeadlines={deadlines}
      userId={session?.user?.id ?? 'unknown'}
      googleCalendarId={googleCalendarId}
    />
  )
}
