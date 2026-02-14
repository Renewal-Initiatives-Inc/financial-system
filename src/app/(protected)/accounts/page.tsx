import { getAccounts } from './actions'
import { AccountsClient } from './accounts-client'

export default async function AccountsPage() {
  const accounts = await getAccounts()

  return <AccountsClient initialAccounts={accounts} />
}
