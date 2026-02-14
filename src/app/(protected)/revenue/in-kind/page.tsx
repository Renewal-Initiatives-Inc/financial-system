import { getActiveFunds } from '../actions'
import { InKindClient } from './in-kind-client'

export default async function InKindPage() {
  const funds = await getActiveFunds()
  return <InKindClient funds={funds} />
}
