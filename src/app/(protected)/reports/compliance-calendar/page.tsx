import { getComplianceCalendarData } from '@/lib/reports/compliance-calendar'
import { ComplianceCalendarClient } from './compliance-calendar-client'

export default async function ComplianceCalendarPage() {
  const data = await getComplianceCalendarData()
  return <ComplianceCalendarClient initialData={data} />
}
