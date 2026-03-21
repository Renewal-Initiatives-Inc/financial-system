import { auth } from '@/lib/auth'
import { getComplianceDeadlines } from './actions'
import { ComplianceCalendarClient } from './compliance-calendar-client'

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ deadline?: string }>
}) {
  const [session, deadlines, params] = await Promise.all([
    auth(),
    getComplianceDeadlines(),
    searchParams,
  ])
  const googleCalendarId = process.env.GOOGLE_CALENDAR_ID ?? null
  const autoOpenDeadlineId = params.deadline ? parseInt(params.deadline, 10) : undefined
  return (
    <ComplianceCalendarClient
      initialDeadlines={deadlines}
      userId={session?.user?.id ?? 'unknown'}
      googleCalendarId={googleCalendarId}
      autoOpenDeadlineId={autoOpenDeadlineId}
    />
  )
}
