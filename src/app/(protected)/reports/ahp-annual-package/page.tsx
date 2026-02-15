import { getAHPAnnualPackageData } from '@/lib/reports/ahp-annual-package'
import { AHPAnnualPackageClient } from './ahp-annual-package-client'

export default async function AHPAnnualPackagePage() {
  const data = await getAHPAnnualPackageData()
  return <AHPAnnualPackageClient initialData={data} />
}
