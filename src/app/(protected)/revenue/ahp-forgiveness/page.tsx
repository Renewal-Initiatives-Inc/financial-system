import { getAhpLoanStatus, getRecentAhpForgiveness } from '../actions'
import { AhpForgivenessClient } from './ahp-forgiveness-client'

export default async function AhpForgivenessPage() {
  const [loanStatus, recentEntries] = await Promise.all([
    getAhpLoanStatus(),
    getRecentAhpForgiveness(),
  ])

  return (
    <AhpForgivenessClient
      loanStatus={loanStatus}
      recentEntries={recentEntries}
    />
  )
}
