import {
  getCipBalances,
  getConvertedStructures,
  getAccountOptions,
} from '../../actions'
import { ConversionWizardClient } from './conversion-wizard-client'

export default async function CipConvertPage() {
  const [balances, conversions, accountOptions] = await Promise.all([
    getCipBalances(),
    getConvertedStructures(),
    getAccountOptions(),
  ])

  return (
    <ConversionWizardClient
      cipBalances={balances}
      convertedStructures={conversions.map((c) => c.structureName)}
      accountOptions={accountOptions}
    />
  )
}
