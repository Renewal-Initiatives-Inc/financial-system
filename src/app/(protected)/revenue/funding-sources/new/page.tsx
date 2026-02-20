import { getActiveVendors } from '../../actions'
import { CreateFundingSourceClient } from './create-funding-source-client'

export default async function NewFundingSourcePage() {
  const vendors = await getActiveVendors()

  return <CreateFundingSourceClient vendors={vendors} />
}
