import { getLatestProjectionAction, getLatestWeeklyProjectionAction } from './actions'
import { CashProjectionClient } from './cash-projection-client'

export default async function CashProjectionPage() {
  const currentYear = new Date().getFullYear()
  const [projection, weeklyProjection] = await Promise.all([
    getLatestProjectionAction(currentYear),
    getLatestWeeklyProjectionAction(currentYear),
  ])

  return (
    <CashProjectionClient
      initialProjection={projection}
      initialWeeklyProjection={weeklyProjection}
      fiscalYear={currentYear}
    />
  )
}
