import Link from 'next/link'
import { Banknote, ClipboardList, ArrowDownToLine, Shield } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { db } from '@/lib/db'
import { transactions, transactionLines, accounts } from '@/lib/db/schema'
import { eq, and, desc, sql } from 'drizzle-orm'
import { RecentEntriesTable } from '../revenue/components/recent-entries-table'

const liabilityCards = [
  {
    label: 'Notes Payable / Loans',
    description: 'Outstanding loan balances and payment schedules.',
    href: '/liabilities/loans',
    icon: Banknote,
  },
  {
    label: 'Accrued Liabilities',
    description: 'Accrued expenses not yet paid (payroll, interest, etc.).',
    href: '/liabilities/accrued',
    icon: ClipboardList,
  },
  {
    label: 'Deferred Revenue',
    description: 'Funds received but not yet earned.',
    href: '/liabilities/deferred-revenue',
    icon: ArrowDownToLine,
  },
  {
    label: 'Security Deposits',
    description: 'Tenant security deposit obligations.',
    href: '/liabilities/security-deposits',
    icon: Shield,
  },
]

async function getRecentLiabilityEntries(limit = 25) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      sourceType: transactions.sourceType,
      createdAt: transactions.createdAt,
      amount: sql<string>`coalesce(${transactionLines.credit}, ${transactionLines.debit})`.as('amount'),
      accountName: accounts.name,
      accountCode: accounts.code,
    })
    .from(transactions)
    .innerJoin(transactionLines, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'LIABILITY'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export default async function LiabilitiesPage() {
  const recentEntries = await getRecentLiabilityEntries()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Liabilities</h1>
        <p className="text-muted-foreground mt-1">
          View and manage outstanding obligations.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {liabilityCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              data-testid={`liability-card-${card.label.toLowerCase().replace(/[\s/]+/g, '-')}`}
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
        <h2 className="text-lg font-semibold">Recent Liability Entries</h2>
        <RecentEntriesTable
          entries={recentEntries}
          emptyMessage="No liability entries recorded yet."
        />
      </div>
    </div>
  )
}
