import { getActiveFunds, getRevenueAccounts, getRecentEarnedIncome } from '../actions'
import { EarnedIncomeClient } from './earned-income-client'

export default async function EarnedIncomePage() {
  const [funds, revenueAccounts, recentEntries] = await Promise.all([
    getActiveFunds(),
    getRevenueAccounts(),
    getRecentEarnedIncome(),
  ])

  return (
    <EarnedIncomeClient
      funds={funds}
      revenueAccounts={revenueAccounts}
      recentEntries={recentEntries}
    />
  )
}
