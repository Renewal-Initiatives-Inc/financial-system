import { getActiveFunds, getRecentInKindContributions } from '../actions'
import { InKindClient } from './in-kind-client'

export default async function InKindPage() {
  const [funds, recentEntries] = await Promise.all([
    getActiveFunds(),
    getRecentInKindContributions(),
  ])

  return <InKindClient funds={funds} recentEntries={recentEntries} />
}
