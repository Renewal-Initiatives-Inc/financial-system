import Link from 'next/link'
import {
  FileText,
  Home,
  Heart,
  HandCoins,
  Briefcase,
  Gift,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getRecentRevenueEntries } from './actions'
import { RecentEntriesTable } from './components/recent-entries-table'

const revenueCards = [
  {
    label: 'Funding Sources',
    description: 'Manage grants & contracts, issue AR invoices, record payments',
    href: '/revenue/funding-sources',
    icon: FileText,
  },
  {
    label: 'Rent',
    description: 'Accruals, payments, and adjustments',
    href: '/revenue/rent',
    icon: Home,
  },
  {
    label: 'Donations',
    description: 'Cash donations with acknowledgment',
    href: '/revenue/donations',
    icon: Heart,
  },
  {
    label: 'Pledges',
    description: 'Record pledges and payments',
    href: '/revenue/pledges',
    icon: HandCoins,
  },
  {
    label: 'Earned Income',
    description: 'Farm lease, fees, other earned',
    href: '/revenue/earned-income',
    icon: Briefcase,
  },
  {
    label: 'In-Kind Contributions',
    description: 'Goods, services, facility use',
    href: '/revenue/in-kind',
    icon: Gift,
  },
]

export default async function RevenuePage() {
  const recentEntries = await getRecentRevenueEntries()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Revenue</h1>
        <p className="text-muted-foreground mt-1">
          Record and manage all revenue sources.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {revenueCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              data-testid={`revenue-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <card.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Recent Revenue Entries</h2>
        <RecentEntriesTable
          entries={recentEntries}
          emptyMessage="No revenue entries recorded yet."
        />
      </div>
    </div>
  )
}
