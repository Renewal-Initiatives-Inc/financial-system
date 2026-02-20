import { notFound } from 'next/navigation'
import {
  getFundingSourceById,
  getFundingSourceTransactions,
  getArInvoices,
} from '../../actions'
import { FundingSourceDetailClient } from './funding-source-detail-client'

export default async function FundingSourceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const fundId = parseInt(id, 10)
  if (isNaN(fundId)) notFound()

  const [source, txns, arInvoices] = await Promise.all([
    getFundingSourceById(fundId),
    getFundingSourceTransactions(fundId),
    getArInvoices(fundId),
  ])

  if (!source) notFound()

  return (
    <FundingSourceDetailClient
      source={source}
      transactions={txns}
      arInvoices={arInvoices}
    />
  )
}
