import { notFound } from 'next/navigation'
import { getPurchaseOrderById } from '../../../../actions'
import { CreateInvoiceForm } from './create-invoice-form'

export default async function CreateInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const po = await getPurchaseOrderById(parseInt(id))

  if (!po) {
    notFound()
  }

  return <CreateInvoiceForm po={po} />
}
