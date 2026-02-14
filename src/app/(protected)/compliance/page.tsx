import { getComplianceDeadlines } from './actions'
import { ComplianceCalendarClient } from './compliance-calendar-client'

export default async function CompliancePage() {
  const deadlines = await getComplianceDeadlines()
  return <ComplianceCalendarClient initialDeadlines={deadlines} />
}
