import { getDonors } from './actions'
import { DonorsClient } from './donors-client'

export default async function DonorsPage() {
  const donors = await getDonors()
  return <DonorsClient initialDonors={donors} />
}
