import { getVendors, getAccountOptions, getFundOptions } from './actions'
import { VendorsClient } from './vendors-client'

export default async function VendorsPage() {
  const [vendors, accountOptions, fundOptions] = await Promise.all([
    getVendors(),
    getAccountOptions(),
    getFundOptions(),
  ])

  return (
    <VendorsClient
      initialVendors={vendors}
      accountOptions={accountOptions}
      fundOptions={fundOptions}
    />
  )
}
