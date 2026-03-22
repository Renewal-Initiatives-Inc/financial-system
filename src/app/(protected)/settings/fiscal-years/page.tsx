import { getFiscalYearLocks } from './actions'
import { FiscalYearsClient } from './fiscal-years-client'

export default async function FiscalYearsPage() {
  const locks = await getFiscalYearLocks()

  return <FiscalYearsClient locks={locks} />
}
