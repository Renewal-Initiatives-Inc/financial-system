import { getFundingComplianceData } from '@/lib/reports/grant-compliance'
import { FundingComplianceClient } from './grant-compliance-client'

export default async function FundingCompliancePage() {
  const data = await getFundingComplianceData()
  return <FundingComplianceClient data={data} />
}
