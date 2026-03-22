import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { CloseBooksStepper } from './close-books-wizard'

export default function CloseBooksPage() {
  return (
    <div className="space-y-6">
      <Breadcrumbs />
      <CloseBooksStepper />
    </div>
  )
}
