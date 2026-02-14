import { getCipBalances, getConvertedStructures } from '../actions'
import { CipBalanceClient } from './cip-balance-client'

export default async function CipBalancePage() {
  const [balances, conversions] = await Promise.all([
    getCipBalances(),
    getConvertedStructures(),
  ])

  return (
    <CipBalanceClient
      balances={balances}
      conversions={conversions}
    />
  )
}
