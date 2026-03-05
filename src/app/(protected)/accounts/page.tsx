import { getAccounts, getAccountBalances } from './actions'
import { AccountsClient } from './accounts-client'

export default async function AccountsPage() {
  const [accountRows, balanceMap] = await Promise.all([
    getAccounts(),
    getAccountBalances(),
  ])

  const accounts = accountRows.map((a) => ({
    ...a,
    balance: balanceMap[a.id] ?? 0,
  }))

  return <AccountsClient initialAccounts={accounts} />
}
