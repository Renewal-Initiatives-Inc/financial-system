import { redirect } from 'next/navigation'

export default function CashProjectionPage() {
  redirect('/reports/cash-projection?view=weekly')
}
