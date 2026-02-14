import { notFound } from 'next/navigation'
import {
  getTransactionById,
  getAccountsForSelector,
  getFundsForSelector,
  getCipCostCodesForSelector,
} from '../../actions'
import { EditTransactionForm } from './edit-transaction-form'

export default async function EditTransactionPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const txnId = parseInt(id, 10)

  if (isNaN(txnId)) return notFound()

  const [transaction, accounts, funds, cipCostCodes] = await Promise.all([
    getTransactionById(txnId),
    getAccountsForSelector(),
    getFundsForSelector(),
    getCipCostCodesForSelector(),
  ])

  if (!transaction) return notFound()

  // Guard: can't edit voided, system-generated, or reversed transactions
  if (
    transaction.isVoided ||
    transaction.isSystemGenerated ||
    transaction.reversedById !== null
  ) {
    return notFound()
  }

  const generalFund = funds.find(
    (f) => f.name === 'General Fund' || f.name === 'General Operations'
  )

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">
        Edit Transaction #{txnId}
      </h1>
      <EditTransactionForm
        transaction={transaction}
        accounts={accounts}
        funds={funds}
        cipCostCodes={cipCostCodes}
        defaultFundId={generalFund?.id ?? null}
      />
    </div>
  )
}
