import { auth } from '@/lib/auth'
import { getComplianceDeadlines } from './actions'
import { ComplianceCalendarClient } from './compliance-calendar-client'

export default async function CompliancePage() {
  const session = await auth()
  const deadlines = await getComplianceDeadlines()
  return (
    <ComplianceCalendarClient
      initialDeadlines={deadlines}
      userId={session?.user?.id ?? 'unknown'}
    />
  )
}
