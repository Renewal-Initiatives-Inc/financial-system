import { getW2VerificationData } from '@/lib/reports/w2-verification'
import { W2VerificationClient } from './w2-verification-client'

export default async function W2VerificationPage() {
  const currentYear = new Date().getFullYear()
  const data = await getW2VerificationData({ year: currentYear })

  return <W2VerificationClient initialData={data} />
}
