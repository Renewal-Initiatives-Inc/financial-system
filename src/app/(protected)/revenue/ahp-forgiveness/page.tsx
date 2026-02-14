import { getAhpLoanStatus } from '../actions'
import { AhpForgivenessClient } from './ahp-forgiveness-client'

export default async function AhpForgivenessPage() {
  const loanStatus = await getAhpLoanStatus()
  return <AhpForgivenessClient loanStatus={loanStatus} />
}
