import { getRecentInvestmentIncome } from '../actions'
import { InvestmentIncomeClient } from './investment-income-client'

export default async function InvestmentIncomePage() {
  const recentEntries = await getRecentInvestmentIncome()
  return <InvestmentIncomeClient recentEntries={recentEntries} />
}
