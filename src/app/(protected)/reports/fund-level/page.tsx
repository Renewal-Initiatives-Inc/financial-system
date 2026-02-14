import { getFundsForFilter } from '../actions'
import { FundLevelClient } from './fund-level-client'

export default async function FundLevelPage() {
  const funds = await getFundsForFilter()
  return <FundLevelClient funds={funds} />
}
