'use client'

import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'
import { CashSnapshot } from './sections/cash-snapshot'
import { AlertsAttention } from './sections/alerts-attention'
import { RentCollection } from './sections/rent-collection'
import { FundBalances } from './sections/fund-balances'
import { RecentActivity } from './sections/recent-activity'
import type { DashboardData } from '@/lib/dashboard/queries'

export function DashboardClient({ data }: { data: DashboardData }) {
  return (
    <div className="space-y-6">
      <CopilotContextSetter pageId="dashboard" />
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CashSnapshot data={data.cashSnapshot} />
        <AlertsAttention data={data.alerts} />
        <RentCollection data={data.rentSnapshot} />
        <FundBalances data={data.fundBalances} />
      </div>

      <RecentActivity data={data.recentActivity} />
    </div>
  )
}
