import { notFound } from 'next/navigation'
import {
  getVendorById,
  getAccountOptions,
  getFundOptions,
  getVendor1099Summary,
} from '../actions'
import {
  getVendorPurchaseOrders,
} from '../../expenses/actions'
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

  const currentYear = new Date().getFullYear()

  const [vendor, accountOptions, fundOptions, purchaseOrders, summary1099] =
    await Promise.all([
      getVendorById(vendorId),
      getAccountOptions(),
      getFundOptions(),
      getVendorPurchaseOrders(vendorId),
      getVendor1099Summary(vendorId, currentYear),
    ])

  if (!vendor) notFound()

  return (
    <VendorDetailClient
      vendor={vendor}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
      purchaseOrders={purchaseOrders}
      summary1099={summary1099}
    />
  )
}
