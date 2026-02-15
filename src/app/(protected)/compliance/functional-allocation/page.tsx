import { loadDefaults } from './actions'
import { WizardClient } from './wizard-client'

export default async function FunctionalAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const fiscalYear = params.year ? parseInt(params.year) : new Date().getFullYear()
  const defaults = await loadDefaults(fiscalYear)

  return (
    <div className="max-w-4xl mx-auto py-6">
      <WizardClient defaults={defaults} fiscalYear={fiscalYear} />
    </div>
  )
}
