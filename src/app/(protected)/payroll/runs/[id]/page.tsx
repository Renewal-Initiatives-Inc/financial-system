import { notFound } from 'next/navigation'
import { getPayrollRunById, getPayrollRunEntries } from '../../actions'
import { PayrollRunDetail } from './payroll-run-detail'

export default async function PayrollRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const runId = parseInt(id, 10)

  if (isNaN(runId)) notFound()

  const [run, entries] = await Promise.all([
    getPayrollRunById(runId),
    getPayrollRunEntries(runId),
  ])

  if (!run) notFound()

  return <PayrollRunDetail run={run} entries={entries} />
}
