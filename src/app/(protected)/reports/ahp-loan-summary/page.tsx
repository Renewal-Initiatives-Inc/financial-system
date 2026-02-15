import { getAHPLoanSummaryData } from '@/lib/reports/ahp-loan-summary'
import { AHPLoanSummaryClient } from './ahp-loan-summary-client'

export default async function AHPLoanSummaryPage() {
  const data = await getAHPLoanSummaryData()
  return <AHPLoanSummaryClient initialData={data} />
}
