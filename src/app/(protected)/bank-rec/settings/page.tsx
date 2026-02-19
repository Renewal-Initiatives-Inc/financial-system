import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getBankAccounts, getGlAccountOptions } from './actions'
import { BankAccountsClient } from './bank-accounts-client'

export default async function BankRecSettingsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [bankAccountsList, glAccountOptions] = await Promise.all([
    getBankAccounts(),
    getGlAccountOptions(),
  ])

  return (
    <BankAccountsClient
      initialAccounts={bankAccountsList}
      glAccountOptions={glAccountOptions}
      userId={session.user.id}
    />
  )
}
