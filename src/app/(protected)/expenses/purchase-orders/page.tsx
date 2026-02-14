import {
  getPurchaseOrders,
  getActiveVendors,
  getActiveFunds,
} from '../actions'
import { POListClient } from './po-list-client'

export default async function PurchaseOrdersPage() {
  const [purchaseOrders, vendors, funds] = await Promise.all([
    getPurchaseOrders(),
    getActiveVendors(),
    getActiveFunds(),
  ])

  return (
    <POListClient
      purchaseOrders={purchaseOrders}
      vendors={vendors}
      funds={funds}
    />
  )
}
