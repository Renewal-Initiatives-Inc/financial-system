import { getBankAccounts, getGlAccountOptions } from './actions'
import { BankAccountsClient } from './bank-accounts-client'

export default async function BankRecSettingsPage() {
  const [bankAccountsList, glAccountOptions] = await Promise.all([
    getBankAccounts(),
    getGlAccountOptions(),
  ])

  return (
    <BankAccountsClient
      initialAccounts={bankAccountsList}
      glAccountOptions={glAccountOptions}
    />
  )
}
