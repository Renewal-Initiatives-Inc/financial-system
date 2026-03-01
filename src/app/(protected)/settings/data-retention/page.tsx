import { getRetentionSummary } from './actions'
import { RetentionDashboard } from './retention-dashboard'

export default async function DataRetentionPage() {
  const summary = await getRetentionSummary()

  return <RetentionDashboard summary={summary} />
}
