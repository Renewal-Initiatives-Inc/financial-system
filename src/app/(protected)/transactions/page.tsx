import { getTransactions } from './actions'
import { TransactionsClient } from './transactions-client'

export default async function TransactionsPage() {
  const { rows } = await getTransactions({ pageSize: 0 })

  return <TransactionsClient initialRows={rows} />
}
