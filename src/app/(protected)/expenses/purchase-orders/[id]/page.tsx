import { notFound } from 'next/navigation'
import { getPurchaseOrderById } from '../../actions'
import { PODetailClient } from './po-detail-client'

interface PODetailPageProps {
  params: Promise<{ id: string }>
}

export default async function PODetailPage({ params }: PODetailPageProps) {
  const { id } = await params
  const poId = parseInt(id, 10)

  if (isNaN(poId)) notFound()

  const po = await getPurchaseOrderById(poId)

  if (!po) notFound()

  return <PODetailClient po={po} />
}
