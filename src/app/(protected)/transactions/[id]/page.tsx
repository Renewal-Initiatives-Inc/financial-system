import { notFound } from 'next/navigation'
import { getTransactionById } from '../actions'
import { TransactionDetailClient } from './transaction-detail-client'

export default async function TransactionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const txnId = parseInt(id, 10)

  if (isNaN(txnId)) return notFound()

  const transaction = await getTransactionById(txnId)

  if (!transaction) return notFound()

  return <TransactionDetailClient transaction={transaction} />
}
