import { getFixedAssets, getAccountOptions, getFundOptions } from './actions'
import { AssetListClient } from './asset-list-client'

export default async function AssetsPage() {
  const [assets, accountOptions, fundOptions] = await Promise.all([
    getFixedAssets(),
    getAccountOptions(),
    getFundOptions(),
  ])

  return (
    <AssetListClient
      initialAssets={assets}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
