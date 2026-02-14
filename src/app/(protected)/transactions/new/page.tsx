import {
  getAccountsForSelector,
  getFundsForSelector,
  getCipCostCodesForSelector,
} from '../actions'
import { JournalEntryForm } from './journal-entry-form'

export default async function NewTransactionPage() {
  const [accounts, funds, cipCostCodes] = await Promise.all([
    getAccountsForSelector(),
    getFundsForSelector(),
    getCipCostCodesForSelector(),
  ])

  // Find the General Fund for defaulting
  const generalFund = funds.find(
    (f) => f.name === 'General Fund' || f.name === 'General Operations'
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        New Manual Journal Entry
      </h1>
      <JournalEntryForm
        accounts={accounts}
        funds={funds}
        cipCostCodes={cipCostCodes}
        defaultFundId={generalFund?.id ?? null}
      />
    </div>
  )
}
