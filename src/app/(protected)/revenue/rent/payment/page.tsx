import { getActiveTenants, getActiveFunds } from '../../actions'
import { RentPaymentClient } from './rent-payment-client'

export default async function RentPaymentPage() {
  const [tenants, funds] = await Promise.all([
    getActiveTenants(),
    getActiveFunds(),
  ])

  return <RentPaymentClient tenants={tenants} funds={funds} />
}
