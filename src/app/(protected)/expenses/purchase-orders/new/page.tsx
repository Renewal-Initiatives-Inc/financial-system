import {
  getActiveVendors,
  getActiveFunds,
  getActiveCipCostCodes,
} from '../../actions'
import { getAccountsForSelector } from '@/app/(protected)/transactions/actions'
import { CreatePOForm } from './create-po-form'

export default async function CreatePurchaseOrderPage() {
  const [vendors, accounts, funds, cipCostCodes] = await Promise.all([
    getActiveVendors(),
    getAccountsForSelector(),
    getActiveFunds(),
    getActiveCipCostCodes(),
  ])

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
      />
    </div>
  )
}
