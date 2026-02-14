import { getActiveVendors, getActiveFunds } from '../../actions'
import { CreateGrantClient } from './create-grant-client'

export default async function NewGrantPage() {
  const [vendors, funds] = await Promise.all([
    getActiveVendors(),
    getActiveFunds(),
  ])

  return <CreateGrantClient vendors={vendors} funds={funds} />
}
