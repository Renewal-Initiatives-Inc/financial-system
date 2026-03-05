import { getTransactionHistoryData } from '@/lib/reports/transaction-history'
import { getFundsForFilter } from '../actions'
import { getAccountsForSelector } from '@/app/(protected)/transactions/actions'
import { TransactionHistoryClient } from './transaction-history-client'
import { getCurrentMonthRange } from '@/lib/reports/types'

interface TransactionHistoryPageProps {
  searchParams: Promise<{ accountId?: string }>
}

export default async function TransactionHistoryPage({ searchParams }: TransactionHistoryPageProps) {
  const { accountId: accountIdParam } = await searchParams
  const initialAccountId = accountIdParam ? parseInt(accountIdParam, 10) : null
  const { startDate, endDate } = getCurrentMonthRange()

  const [data, funds, accountsList] = await Promise.all([
    getTransactionHistoryData({
      startDate,
      endDate,
      ...(initialAccountId ? { accountId: initialAccountId } : {}),
    }),
    getFundsForFilter(),
    getAccountsForSelector(),
  ])

  return (
    <TransactionHistoryClient
      initialData={data}
      funds={funds}
      accounts={accountsList.map((a) => ({ id: a.id, code: a.code, name: a.name }))}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
      initialAccountId={initialAccountId}
    />
  )
}
