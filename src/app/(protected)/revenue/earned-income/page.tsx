import { getActiveFunds, getRevenueAccounts } from '../actions'
import { EarnedIncomeClient } from './earned-income-client'

export default async function EarnedIncomePage() {
  const [funds, revenueAccounts] = await Promise.all([
    getActiveFunds(),
    getRevenueAccounts(),
  ])

  return <EarnedIncomeClient funds={funds} revenueAccounts={revenueAccounts} />
}
