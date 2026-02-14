import { getFunds } from './actions'
import { FundsClient } from './funds-client'

export default async function FundsPage() {
  const funds = await getFunds()

  return <FundsClient initialFunds={funds} />
}
