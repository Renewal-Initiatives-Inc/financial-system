import { db } from '@/lib/db'
import { transactionLines, transactions } from '@/lib/db/schema'
import { and, eq, sql } from 'drizzle-orm'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

async function getDeveloperFeeData() {
  // Get account IDs
  const cipDevFee = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, '1540'),
  })
  const deferredDevFee = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, '2510'),
  })

  if (!cipDevFee || !deferredDevFee) {
    return {
      totalDevFee: 827000,
      cipDevFeeBalance: 0,
      deferredBalance: 0,
      recentTransactions: [],
    }
  }

  // Get CIP Developer Fee balance
  const [cipResult] = await db
    .select({
      balance: sql<string>`
        COALESCE(SUM(COALESCE(${transactionLines.debit}::numeric, 0)) - SUM(COALESCE(${transactionLines.credit}::numeric, 0)), 0)
      `,
    })
    .from(transactionLines)
    .innerJoin(
      transactions,
      and(
        eq(transactionLines.transactionId, transactions.id),
        eq(transactions.isVoided, false)
      )
    )
    .where(eq(transactionLines.accountId, cipDevFee.id))

  // Get Deferred Developer Fee Payable balance
  const [deferredResult] = await db
    .select({
      balance: sql<string>`
        COALESCE(SUM(COALESCE(${transactionLines.credit}::numeric, 0)) - SUM(COALESCE(${transactionLines.debit}::numeric, 0)), 0)
      `,
    })
    .from(transactionLines)
    .innerJoin(
      transactions,
      and(
        eq(transactionLines.transactionId, transactions.id),
        eq(transactions.isVoided, false)
      )
    )
    .where(eq(transactionLines.accountId, deferredDevFee.id))

  // Get recent transactions involving either account
  const recentTxns = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
      accountId: transactionLines.accountId,
    })
    .from(transactionLines)
    .innerJoin(
      transactions,
      and(
        eq(transactionLines.transactionId, transactions.id),
        eq(transactions.isVoided, false)
      )
    )
    .where(
      sql`${transactionLines.accountId} IN (${cipDevFee.id}, ${deferredDevFee.id})`
    )
    .orderBy(sql`${transactions.date} DESC`)
    .limit(20)

  return {
    totalDevFee: 827000,
    cipDevFeeBalance: Number(cipResult.balance),
    deferredBalance: Number(deferredResult.balance),
    recentTransactions: recentTxns.map((t) => ({
      id: t.id,
      date: t.date,
      memo: t.memo,
      account: t.accountId === cipDevFee.id ? 'CIP - Developer Fee' : 'Deferred Dev Fee Payable',
      debit: t.debit ? Number(t.debit) : null,
      credit: t.credit ? Number(t.credit) : null,
    })),
  }
}

export default async function DeveloperFeePage() {
  const data = await getDeveloperFeeData()

  const cashPaid = data.cipDevFeeBalance
  const deferredAmount = data.deferredBalance

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          Developer Fee Tracking
          <HelpTooltip term="developer-fee" />
        </h1>
        <p className="text-muted-foreground mt-1">
          Read-only summary of developer fee activity
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Developer Fee
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalDevFee)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              CIP - Developer Fee (1540)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(cashPaid)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Deferred Dev Fee Payable (2510)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(deferredAmount)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent GL Entries */}
      <Card>
        <CardHeader>
          <CardTitle>Recent GL Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {data.recentTransactions.length === 0 ? (
            <p className="text-muted-foreground">
              No developer fee transactions recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentTransactions.map((txn, i) => (
                  <TableRow key={i}>
                    <TableCell>{formatDate(txn.date)}</TableCell>
                    <TableCell>{txn.memo}</TableCell>
                    <TableCell>{txn.account}</TableCell>
                    <TableCell className="text-right">
                      {txn.debit ? formatCurrency(txn.debit) : ''}
                    </TableCell>
                    <TableCell className="text-right">
                      {txn.credit ? formatCurrency(txn.credit) : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
