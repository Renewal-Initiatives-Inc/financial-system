import { getTenants } from './actions'
import { TenantsClient } from './tenants-client'

export default async function TenantsPage() {
  const tenants = await getTenants()
  return <TenantsClient initialTenants={tenants} />
}
