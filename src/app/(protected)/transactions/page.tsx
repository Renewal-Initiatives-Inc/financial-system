import { getTransactions } from './actions'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const { rows, total } = await getTransactions()

  return <TransactionsClient initialRows={rows} initialTotal={total} />
}
