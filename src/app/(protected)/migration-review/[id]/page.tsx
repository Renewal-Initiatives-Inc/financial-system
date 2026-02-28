import { notFound } from 'next/navigation'
import { getReviewItem, getAdjacentItems } from '../actions'
import { ReviewItemClient } from './review-item-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ReviewItemPage({ params }: Props) {
  const { id } = await params
  const numId = parseInt(id, 10)
  if (isNaN(numId)) notFound()

  const detail = await getReviewItem(numId)
  if (!detail) notFound()

  const adjacent = await getAdjacentItems(numId, detail.item.batchId)

  return (
    <ReviewItemClient
      detail={{
        ...detail,
        consumedMatchIds: Array.from(detail.consumedMatchIds),
      }}
      adjacent={adjacent}
    />
  )
}
