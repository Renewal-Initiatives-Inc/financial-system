'use client'

import { useState, useTransition, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Settings,
  CheckCircle2,
  ArrowLeftRight,
  TrendingDown,
  TrendingUp,
  AlertCircle,
  XCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BankAccountSelector } from './components/bank-account-selector'
import { SignOffDialog } from './components/sign-off-dialog'
import {
  getReconciliationSession,
  startReconciliationSession,
  cancelReconciliationSession,
  getPastSessions,
} from './actions'
import { toast } from 'sonner'
import type { BankAccountOption, SessionData, PastSession } from './actions'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

interface BankReconcileClientProps {
  bankAccounts: BankAccountOption[]
}

export function BankReconcileClient({ bankAccounts }: BankReconcileClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccounts.length > 0 ? String(bankAccounts[0].id) : ''
  )
  const [sessionData, setSessionData] = useState<SessionData>({
    session: null,
    summary: null,
    balance: null,
  })
  const [pastSessions, setPastSessions] = useState<PastSession[]>([])
  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false)

  // Start reconciliation form state
  const [statementDate, setStatementDate] = useState('')
  const [statementBalance, setStatementBalance] = useState('')

  const loadAccountData = useCallback(async (accountId: string) => {
    const id = parseInt(accountId, 10)
    try {
      const [session, past] = await Promise.all([
        getReconciliationSession(id),
        getPastSessions(id),
      ])
      setSessionData(session)
      setPastSessions(past.filter((s) => s.status === 'completed').reverse())
    } catch (err) {
      console.error('[bank-rec] loadAccountData failed:', err)
    }
  }, [])

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value)
    startTransition(() => loadAccountData(value))
  }

  useEffect(() => {
    if (selectedAccountId) {
      startTransition(() => loadAccountData(selectedAccountId))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleStartSession = () => {
    if (!selectedAccountId || !statementDate || !statementBalance) return
    startTransition(async () => {
      try {
        await startReconciliationSession(
          parseInt(selectedAccountId, 10),
          statementDate,
          statementBalance,
          'system'
        )
        toast.success('Reconciliation session started')
        setStatementDate('')
        setStatementBalance('')
        await loadAccountData(selectedAccountId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to start session')
      }
    })
  }

  const handleRefresh = () => {
    startTransition(() => loadAccountData(selectedAccountId))
  }

  const handleCancelSession = () => {
    if (!session?.id) return
    if (!confirm('Cancel this reconciliation session? Matched transactions will be preserved.')) return
    startTransition(async () => {
      try {
        await cancelReconciliationSession(session.id)
        toast.success('Reconciliation session cancelled')
        await loadAccountData(selectedAccountId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel session')
      }
    })
  }

  const { balance, session } = sessionData
  const hasActiveSession = !!session && session.status === 'in_progress'

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No bank accounts connected. Connect a bank account to get started.
            </p>
            <Button asChild>
              <Link href="/bank-rec/settings">
                <Settings className="mr-2 h-4 w-4" />
                Bank Account Settings
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
        <Button variant="outline" size="sm" asChild>
          <Link href="/bank-rec/settings">
            <Settings className="mr-1 h-3 w-3" />
            Settings
          </Link>
        </Button>
      </div>

      {/* Account selector */}
      <BankAccountSelector
        accounts={bankAccounts}
        value={selectedAccountId}
        onValueChange={handleAccountChange}
      />

      {/* Active session view */}
      {hasActiveSession && balance && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Reconciling through{' '}
                <span className="font-medium text-foreground">{session.statementDate}</span>
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelSession}
                disabled={isPending}
                data-testid="bank-rec-cancel-btn"
              >
                <XCircle className="mr-1 h-3 w-3" />
                Cancel Reconciliation
              </Button>
              <Button
                size="sm"
                onClick={() => setSignOffDialogOpen(true)}
                disabled={!balance.isReconciled}
                data-testid="bank-rec-sign-off-btn"
              >
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Sign Off Reconciliation
              </Button>
            </div>
          </div>

          {/* Balance breakdown */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Statement Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">
                  {formatCurrency(balance.bankBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From bank statement</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  GL Book Balance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-mono font-semibold">
                  {formatCurrency(balance.glBalance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">From general ledger</p>
              </CardContent>
            </Card>

            <Card
              className={
                balance.isReconciled
                  ? 'border-green-300 dark:border-green-700'
                  : 'border-red-300 dark:border-red-700'
              }
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Difference
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p
                  className={`text-2xl font-mono font-semibold ${
                    balance.isReconciled
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  {formatCurrency(balance.variance)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {balance.isReconciled ? '✓ Balanced — ready to sign off' : 'Must reach $0.00'}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Reconciling items */}
          {(balance.outstandingChecks > 0 ||
            balance.outstandingDeposits > 0 ||
            balance.bankItemsNotInGl !== 0) && (
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">Reconciling Items</p>
              <div className="space-y-1 text-sm">
                {balance.outstandingChecks > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <TrendingDown className="h-3 w-3" />
                      Outstanding checks (GL outflows not yet cleared)
                    </span>
                    <span className="font-mono">({formatCurrency(balance.outstandingChecks)})</span>
                  </div>
                )}
                {balance.outstandingDeposits > 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" />
                      Outstanding deposits (GL inflows not yet cleared)
                    </span>
                    <span className="font-mono">{formatCurrency(balance.outstandingDeposits)}</span>
                  </div>
                )}
                {balance.bankItemsNotInGl !== 0 && (
                  <div className="flex items-center justify-between text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <AlertCircle className="h-3 w-3" />
                      Bank items not yet in GL
                    </span>
                    <span className="font-mono">{formatCurrency(balance.bankItemsNotInGl)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Prompt to match if not reconciled */}
          {!balance.isReconciled && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950 p-4 flex items-center justify-between gap-4">
              <p className="text-sm text-amber-800 dark:text-amber-200">
                The difference is not yet $0.00. Go to <strong>Match Bank Transactions</strong> to
                resolve exceptions and pending items before signing off.
              </p>
              <Button variant="outline" size="sm" asChild className="shrink-0">
                <Link href="/match-transactions/bank">
                  <ArrowLeftRight className="mr-1 h-3 w-3" />
                  Match Transactions
                </Link>
              </Button>
            </div>
          )}
        </div>
      )}

      {/* No active session — start one */}
      {!hasActiveSession && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Start New Reconciliation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter the ending date and balance from your bank statement to begin reconciling.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="stmt-date">Statement End Date</Label>
                <Input
                  id="stmt-date"
                  type="date"
                  value={statementDate}
                  onChange={(e) => setStatementDate(e.target.value)}
                  data-testid="session-statement-date"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="stmt-balance">Statement Ending Balance</Label>
                <Input
                  id="stmt-balance"
                  type="number"
                  step="0.01"
                  value={statementBalance}
                  onChange={(e) => setStatementBalance(e.target.value)}
                  placeholder="0.00"
                  data-testid="session-statement-balance"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleStartSession}
                disabled={isPending || !statementDate || !statementBalance}
                data-testid="session-start-submit"
              >
                Start Reconciliation
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/match-transactions/bank">
                  <ArrowLeftRight className="mr-1 h-3 w-3" />
                  Match Transactions First
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Past reconciliations */}
      {pastSessions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-base font-semibold">Past Reconciliations</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Statement Date</TableHead>
                  <TableHead>Statement Balance</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Signed Off By</TableHead>
                  <TableHead>Date Completed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pastSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="text-sm">{s.statementDate}</TableCell>
                    <TableCell className="text-sm font-mono">
                      {formatCurrency(parseFloat(s.statementBalance))}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={s.status === 'completed' ? 'default' : 'secondary'}
                        className={
                          s.status === 'completed'
                            ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            : ''
                        }
                      >
                        {s.status === 'completed' ? 'Completed' : 'In Progress'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.signedOffBy ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {s.signedOffAt ? new Date(s.signedOffAt).toLocaleDateString() : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      <SignOffDialog
        open={signOffDialogOpen}
        onClose={() => {
          setSignOffDialogOpen(false)
          handleRefresh()
        }}
        sessionId={session?.id ?? null}
        balance={balance}
        statementDate={session?.statementDate ?? ''}
      />
    </div>
  )
}
