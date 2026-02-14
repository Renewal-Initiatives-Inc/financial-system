import { notFound } from 'next/navigation'
import { getVendorById, getAccountOptions, getFundOptions } from '../actions'
import { VendorDetailClient } from './vendor-detail-client'

interface VendorDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function VendorDetailPage({
  params,
}: VendorDetailPageProps) {
  const { id } = await params
  const vendorId = parseInt(id, 10)

  if (isNaN(vendorId)) notFound()

  const [vendor, accountOptions, fundOptions] = await Promise.all([
    getVendorById(vendorId),
    getAccountOptions(),
    getFundOptions(),
  ])

  if (!vendor) notFound()

  return (
    <VendorDetailClient
      vendor={vendor}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
