import { getVendor1099Data } from '@/lib/compliance/vendor-1099'
import { PrepClient } from './prep-client'

export default async function Form1099PrepPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>
}) {
  const params = await searchParams
  const year = params.year ? parseInt(params.year) : new Date().getFullYear()
  const data = await getVendor1099Data(year)

  return (
    <div className="max-w-5xl mx-auto py-6">
      <PrepClient data={data} />
    </div>
  )
}
