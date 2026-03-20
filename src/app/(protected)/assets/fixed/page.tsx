import { getFixedAssets, getAccountOptions, getFundOptions } from '../actions'
import { FixedAssetsClient } from './fixed-assets-client'

export default async function FixedAssetsPage() {
  const [assets, accountOptions] = await Promise.all([
    getFixedAssets(),
    getAccountOptions(),
  ])

  return (
    <FixedAssetsClient
      initialAssets={assets}
      accountOptions={accountOptions}
    />
  )
}
