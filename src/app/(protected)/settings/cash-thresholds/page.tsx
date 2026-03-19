import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCashThresholdSettings } from './actions'
import { CashThresholdsClient } from './cash-thresholds-client'

export default async function CashThresholdsPage() {
  const session = await auth()
  if (!session?.user?.id) redirect('/login')

  const settings = await getCashThresholdSettings()

  return <CashThresholdsClient initialSettings={settings} />
}
