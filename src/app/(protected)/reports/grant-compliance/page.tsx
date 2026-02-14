import { getGrantComplianceData } from '@/lib/reports/grant-compliance'
import { GrantComplianceClient } from './grant-compliance-client'

export default async function GrantCompliancePage() {
  const data = await getGrantComplianceData()
  return <GrantComplianceClient data={data} />
}
