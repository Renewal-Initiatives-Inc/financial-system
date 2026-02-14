import { notFound } from 'next/navigation'
import { getFixedAssetById, getAccountOptions } from '../actions'
import { AssetDetailClient } from './asset-detail-client'

interface AssetDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AssetDetailPage({
  params,
}: AssetDetailPageProps) {
  const { id } = await params
  const assetId = parseInt(id, 10)
  if (isNaN(assetId)) notFound()

  const [asset, accountOptions] = await Promise.all([
    getFixedAssetById(assetId),
    getAccountOptions(),
  ])

  if (!asset) notFound()

  return <AssetDetailClient asset={asset} accountOptions={accountOptions} />
}
