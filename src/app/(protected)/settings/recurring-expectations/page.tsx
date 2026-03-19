import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import {
  getRecurringExpectations,
  getAccountOptions,
  getFundOptions,
  getBankAccountOptions,
} from './actions'
import { RecurringExpectationsClient } from './recurring-expectations-client'

export default async function RecurringExpectationsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const [expectations, accountOptions, fundOptions, bankAccountOptions] =
    await Promise.all([
      getRecurringExpectations(),
      getAccountOptions(),
      getFundOptions(),
      getBankAccountOptions(),
    ])

  return (
    <RecurringExpectationsClient
      initialExpectations={expectations}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
      bankAccountOptions={bankAccountOptions}
    />
  )
}
