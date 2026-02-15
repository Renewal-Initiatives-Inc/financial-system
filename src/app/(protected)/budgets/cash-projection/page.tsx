import { getLatestProjectionAction } from './actions'
import { CashProjectionClient } from './cash-projection-client'

// AHP credit facility configuration (from loan metadata)
// TODO: Move to settings table when settings page is built
const AHP_CREDIT_LIMIT = 3_500_000

export default async function CashProjectionPage() {
  const currentYear = new Date().getFullYear()
  const projection = await getLatestProjectionAction(currentYear)

  // AHP context — hardcoded limit, drawn amount would come from GL
  // For now, provide the config value; actual drawn/available comes from AHP loan balance
  const ahpContext = {
    creditLimit: AHP_CREDIT_LIMIT,
    drawn: 0, // Will be populated from GL AHP loan balance when available
    available: AHP_CREDIT_LIMIT,
  }

  return (
    <CashProjectionClient
      initialProjection={projection}
      fiscalYear={currentYear}
      ahpContext={ahpContext}
    />
  )
}
