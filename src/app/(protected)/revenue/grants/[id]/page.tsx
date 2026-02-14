import { notFound } from 'next/navigation'
import { getGrantById, getGrantTransactions } from '../../actions'
import { GrantDetailClient } from './grant-detail-client'

export default async function GrantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const grantId = parseInt(id)
  if (isNaN(grantId)) notFound()

  const [grant, transactions] = await Promise.all([
    getGrantById(grantId),
    getGrantTransactions(grantId),
  ])

  if (!grant) notFound()

  return <GrantDetailClient grant={grant} transactions={transactions} />
}
