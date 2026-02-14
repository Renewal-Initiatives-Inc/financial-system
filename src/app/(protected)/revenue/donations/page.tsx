import { getActiveDonors, getActiveFunds, getDonations } from '../actions'
import { DonationsClient } from './donations-client'

export default async function DonationsPage() {
  const [donors, funds, recentDonations] = await Promise.all([
    getActiveDonors(),
    getActiveFunds(),
    getDonations(),
  ])

  return (
    <DonationsClient
      donors={donors}
      funds={funds}
      recentDonations={recentDonations}
    />
  )
}
