import { getBalanceSheetData } from '@/lib/reports/balance-sheet'
import { getFundsForFilter } from '../actions'
import { BalanceSheetClient } from './balance-sheet-client'

export default async function BalanceSheetPage() {
  const [data, funds] = await Promise.all([
    getBalanceSheetData({ endDate: new Date().toISOString().split('T')[0] }),
    getFundsForFilter(),
  ])
  return <BalanceSheetClient initialData={data} funds={funds} />
}
