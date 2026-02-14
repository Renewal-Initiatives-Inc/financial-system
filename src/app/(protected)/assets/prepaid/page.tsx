import { getPrepaidSchedules } from '../prepaid-actions'
import { getAccountOptions, getFundOptions } from '../actions'
import { PrepaidClient } from './prepaid-client'

export default async function PrepaidPage() {
  const [schedules, accountOptions, fundOptions] = await Promise.all([
    getPrepaidSchedules(),
    getAccountOptions(),
    getFundOptions(),
  ])

  return (
    <PrepaidClient
      initialSchedules={schedules}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
