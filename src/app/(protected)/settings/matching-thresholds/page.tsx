import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getThresholdSettings } from './actions'
import { MatchingThresholdsClient } from './matching-thresholds-client'

export default async function MatchingThresholdsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const settings = await getThresholdSettings()

  return <MatchingThresholdsClient initialSettings={settings} />
}
