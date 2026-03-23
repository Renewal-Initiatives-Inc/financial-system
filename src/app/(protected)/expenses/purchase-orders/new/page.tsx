import {
  getActiveVendors,
  getActiveFunds,
  getActiveCipCostCodes,
} from '../../actions'
import { getAllFundVendorPairs } from '@/app/(protected)/revenue/actions'
import { getAccountsForSelector } from '@/app/(protected)/transactions/actions'
import { CreatePOForm } from './create-po-form'

export default async function CreatePurchaseOrderPage() {
  const [vendors, accounts, funds, cipCostCodes, fundVendorPairRows] = await Promise.all([
    getActiveVendors(),
    getAccountsForSelector(),
    getActiveFunds(),
    getActiveCipCostCodes(),
    getAllFundVendorPairs(),
  ])

  // Serialize as "fundId:vendorId" strings for the client-side lookup set
  const fundVendorPairs = fundVendorPairRows.map(
    (p) => `${p.fundId}:${p.vendorId}`
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Create Purchase Order
        </h1>
        <p className="text-muted-foreground">
          Set up a new purchase order with vendor, GL coding, and optional
          contract extraction.
        </p>
      </div>

      <CreatePOForm
        vendors={vendors}
        accounts={accounts}
        funds={funds}
        cipCostCodes={cipCostCodes}
        fundVendorPairs={fundVendorPairs}
      />
    </div>
  )
}
