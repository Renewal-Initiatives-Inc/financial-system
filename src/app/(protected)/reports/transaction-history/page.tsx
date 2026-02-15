import { getTransactionHistoryData } from '@/lib/reports/transaction-history'
import { getFundsForFilter } from '../actions'
import { TransactionHistoryClient } from './transaction-history-client'
import { getCurrentMonthRange } from '@/lib/reports/types'

export default async function TransactionHistoryPage() {
  const { startDate, endDate } = getCurrentMonthRange()
  const [data, funds] = await Promise.all([
    getTransactionHistoryData({ startDate, endDate }),
    getFundsForFilter(),
  ])
  return (
    <TransactionHistoryClient
      initialData={data}
      funds={funds}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
