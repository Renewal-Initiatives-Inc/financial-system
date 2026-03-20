import { db } from '@/lib/db'
import { transactions, transactionLines, accounts } from '@/lib/db/schema'
import { eq, and, desc, ilike, sql } from 'drizzle-orm'
import { RecentEntriesTable } from '../../revenue/components/recent-entries-table'

async function getSecurityDepositEntries(limit = 50) {
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
        ilike(accounts.name, '%deposit%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export default async function SecurityDepositsPage() {
  const entries = await getSecurityDepositEntries()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Security Deposits
        </h1>
        <p className="text-muted-foreground mt-1">
          Tenant security deposit obligations.
        </p>
      </div>
      <RecentEntriesTable
        entries={entries}
        emptyMessage="No security deposit entries recorded yet."
      />
    </div>
  )
}
