import { getRentCollectionData } from '@/lib/reports/rent-collection'
import { RentCollectionClient } from './rent-collection-client'

export default async function RentCollectionPage() {
  const data = await getRentCollectionData()
  return <RentCollectionClient initialData={data} />
}
