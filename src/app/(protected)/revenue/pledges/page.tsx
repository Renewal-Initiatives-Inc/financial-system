import { getActiveDonors, getActiveFunds, getPledges } from '../actions'
import { PledgesClient } from './pledges-client'

export default async function PledgesPage() {
  const [donors, funds, pledges] = await Promise.all([
    getActiveDonors(),
    getActiveFunds(),
    getPledges(),
  ])

  return <PledgesClient donors={donors} funds={funds} pledges={pledges} />
}
