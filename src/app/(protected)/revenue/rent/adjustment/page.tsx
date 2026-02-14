import { getActiveTenants, getActiveFunds } from '../../actions'
import { RentAdjustmentClient } from './rent-adjustment-client'

export default async function RentAdjustmentPage() {
  const [tenants, funds] = await Promise.all([
    getActiveTenants(),
    getActiveFunds(),
  ])

  return <RentAdjustmentClient tenants={tenants} funds={funds} />
}
