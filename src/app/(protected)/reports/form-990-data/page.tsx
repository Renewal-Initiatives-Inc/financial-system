import { getForm990Data } from '@/lib/reports/form-990-data'
import { Form990DataClient } from './form-990-data-client'

export default async function Form990DataPage() {
  const year = new Date().getFullYear()
  const data = await getForm990Data({ fiscalYear: year })
  return <Form990DataClient initialData={data} defaultYear={year} />
}
