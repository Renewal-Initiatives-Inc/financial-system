import { getLatestProjectionAction } from './actions'
import { CashProjectionClient } from './cash-projection-client'

export default async function CashProjectionPage() {
  const currentYear = new Date().getFullYear()
  const projection = await getLatestProjectionAction(currentYear)

  return (
    <CashProjectionClient
      initialProjection={projection}
      fiscalYear={currentYear}
    />
  )
}
