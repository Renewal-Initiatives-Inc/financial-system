import {
  getPurchaseOrders,
  getActiveVendors,
  getActiveFunds,
} from '../actions'
import { POListClient } from './po-list-client'

interface PurchaseOrdersPageProps {
  searchParams: Promise<{ vendor?: string; status?: string; fund?: string }>
}

export default async function PurchaseOrdersPage({
  searchParams,
}: PurchaseOrdersPageProps) {
  const params = await searchParams
  const vendorId = params.vendor ? parseInt(params.vendor, 10) : undefined
  const status = params.status || undefined
  const fundId = params.fund ? parseInt(params.fund, 10) : undefined

  const [purchaseOrders, vendors, funds] = await Promise.all([
    getPurchaseOrders({
      vendorId: vendorId && !isNaN(vendorId) ? vendorId : undefined,
      status,
      fundId: fundId && !isNaN(fundId) ? fundId : undefined,
    }),
    getActiveVendors(),
    getActiveFunds(),
  ])

  return (
    <POListClient
      purchaseOrders={purchaseOrders}
      vendors={vendors}
      funds={funds}
      initialVendorFilter={vendorId ? String(vendorId) : undefined}
    />
  )
}
