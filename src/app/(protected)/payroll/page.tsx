import { getPayrollRuns } from './actions'
import { PayrollRunsClient } from './payroll-runs-client'

export default async function PayrollPage() {
  const runs = await getPayrollRuns()

  return <PayrollRunsClient initialRuns={runs} />
}
