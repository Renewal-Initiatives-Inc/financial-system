import { notFound } from 'next/navigation'
import {
  getFundingSourceById,
  getFundingSourceTransactions,
  getArInvoices,
  getLoanRateHistory,
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

  // Fetch rate history only for LOAN funding sources
  const rateHistory =
    source.fundingCategory === 'LOAN' ? await getLoanRateHistory(fundId) : []

  return (
    <FundingSourceDetailClient
      source={source}
      transactions={txns}
      arInvoices={arInvoices}
      rateHistory={rateHistory}
    />
  )
}
