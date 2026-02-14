import {
  getRampTransactions,
  getRampStats,
  getAccountOptions,
  getFundOptions,
} from './actions'
import { RampQueueClient } from './ramp-queue-client'

export default async function RampQueuePage() {
  const [transactions, stats, accountOptions, fundOptions] = await Promise.all([
    getRampTransactions(),
    getRampStats(),
    getAccountOptions(),
    getFundOptions(),
  ])

  // Extend account options with fields needed by AccountSelector
  type AccountType = 'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE'
  const accounts = accountOptions.map((a) => ({
    ...a,
    type: a.type as AccountType,
    parentAccountId: null as number | null,
    subType: null as string | null,
    normalBalance: 'DEBIT' as 'DEBIT' | 'CREDIT',
    form990Line: null as string | null,
    isSystemLocked: false,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  }))

  const funds = fundOptions.map((f) => ({
    ...f,
    isActive: true,
  }))

  return (
    <RampQueueClient
      initialTransactions={transactions}
      stats={stats}
      accounts={accounts}
      funds={funds}
    />
  )
}
