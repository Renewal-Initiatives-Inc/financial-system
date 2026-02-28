import { getActiveBatchId, getReviewItems, getReviewSummary } from './actions'
import { MigrationReviewClient } from './migration-review-client'

export default async function MigrationReviewPage() {
  const batchId = await getActiveBatchId()
  let items: Awaited<ReturnType<typeof getReviewItems>> = []
  let summary: Awaited<ReturnType<typeof getReviewSummary>> | null = null

  if (batchId) {
    ;[items, summary] = await Promise.all([
      getReviewItems(batchId),
      getReviewSummary(batchId),
    ])
  }

  return (
    <MigrationReviewClient
      batchId={batchId}
      initialItems={items}
      initialSummary={summary}
    />
  )
}
