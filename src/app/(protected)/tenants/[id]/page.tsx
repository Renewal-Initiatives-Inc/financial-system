import { notFound } from 'next/navigation'
import {
  getTenantById,
  getSecurityDepositReceipts,
  getInterestPayments,
} from '../actions'
import { TenantDetailClient } from './tenant-detail-client'

interface TenantDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function TenantDetailPage({
  params,
}: TenantDetailPageProps) {
  const { id } = await params
  const tenantId = parseInt(id, 10)

  if (isNaN(tenantId)) notFound()

  const tenant = await getTenantById(tenantId)
  if (!tenant) notFound()

  const [receipts, interestPayments] = await Promise.all([
    getSecurityDepositReceipts(tenantId),
    getInterestPayments(tenantId),
  ])

  return (
    <TenantDetailClient
      tenant={tenant}
      receipts={receipts}
      interestPayments={interestPayments}
    />
  )
}
