import { getOutstandingPayables } from '../actions'
import { PayablesClient } from './payables-client'

export default async function PayablesPage() {
  const payables = await getOutstandingPayables()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Outstanding Payables
        </h1>
        <p className="text-muted-foreground mt-1">
          All unpaid amounts owed — Accounts Payable, Reimbursements, and Credit
          Card.
        </p>
      </div>
      <PayablesClient payables={payables} />
    </div>
  )
}
