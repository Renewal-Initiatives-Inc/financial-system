import { fetchStagingRecords, fetchStagingCounts } from './actions'
import { StagingTable } from './staging-table'

export default async function StagingPage() {
  const [records, counts] = await Promise.all([
    fetchStagingRecords(),
    fetchStagingCounts(),
  ])

  return <StagingTable initialRecords={records} counts={counts} />
}
