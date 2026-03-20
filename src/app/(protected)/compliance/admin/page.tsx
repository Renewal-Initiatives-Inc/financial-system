import {
  getAllArtifactYears,
  getArtifactsByYear,
  getCompletedWorkflowCountByYear,
  getDeadlinesWithWorkflowActivity,
} from './admin-actions'
import { ComplianceAdminClient } from './compliance-admin-client'

export default async function ComplianceAdminPage() {
  const currentYear = new Date().getFullYear()
  const [years, artifacts, completedCount, deadlinesWithActivity] = await Promise.all([
    getAllArtifactYears(),
    getArtifactsByYear(currentYear),
    getCompletedWorkflowCountByYear(currentYear),
    getDeadlinesWithWorkflowActivity(),
  ])

  return (
    <ComplianceAdminClient
      initialArtifacts={artifacts}
      years={years}
      initialYear={currentYear}
      initialCompletedCount={completedCount}
      deadlinesWithActivity={deadlinesWithActivity}
    />
  )
}
