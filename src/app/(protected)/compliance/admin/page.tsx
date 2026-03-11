import { getAllArtifactYears, getArtifactsByYear } from './admin-actions'
import { ComplianceAdminClient } from './compliance-admin-client'

export default async function ComplianceAdminPage() {
  const currentYear = new Date().getFullYear()
  const years = await getAllArtifactYears()
  const artifacts = await getArtifactsByYear(currentYear)

  return (
    <ComplianceAdminClient
      initialArtifacts={artifacts}
      years={years}
      initialYear={currentYear}
    />
  )
}
