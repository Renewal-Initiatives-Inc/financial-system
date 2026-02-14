import { notFound } from 'next/navigation'
import { getFundById } from '../actions'
import { FundDetailClient } from './fund-detail-client'

interface FundDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function FundDetailPage({ params }: FundDetailPageProps) {
  const { id } = await params
  const fundId = parseInt(id, 10)

  if (isNaN(fundId)) notFound()

  const fund = await getFundById(fundId)
  if (!fund) notFound()

  return <FundDetailClient fund={fund} />
}
