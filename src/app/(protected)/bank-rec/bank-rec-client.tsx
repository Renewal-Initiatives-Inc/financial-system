'use client'

import { useState, useEffect, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RefreshCw,
  Settings,
  CheckCircle2,
  Split,
  PlusCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { BankAccountSelector } from './components/bank-account-selector'
import { SummaryCards } from './components/summary-cards'
import { BatchReviewTable } from './components/batch-review-table'
import { ReconciliationBalanceBar } from './components/reconciliation-balance-bar'
import { OutstandingItemsPanel } from './components/outstanding-items-panel'
import { ConfirmMatchDialog } from './components/confirm-match-dialog'
import { SplitTransactionDialog } from './components/split-transaction-dialog'
import { InlineGlEntryDialog } from './components/inline-gl-entry-dialog'
import { SignOffDialog } from './components/sign-off-dialog'
import { RampCrossCheck } from './components/ramp-cross-check'
import { PendingTransactions } from './components/pending-transactions'
import { MatchSuggestionPanel } from './components/match-suggestion-panel'
import {
  getBankTransactions,
  getMatchableGlEntries,
  getMatchSuggestions,
  getReconciliationSession,
  startReconciliationSession,
  triggerManualSync,
  getDailyCloseSummary,
  getBatchReviewItems,
  getExceptionItems,
  getRecentAutoMatches,
} from './actions'
import { toast } from 'sonner'
import type {
  BankAccountOption,
  BankTransactionRow,
  SessionData,
  DailyCloseSummary,
} from './actions'
import type { GlEntryRow } from '@/lib/bank-rec/gl-only-categories'
import type { MatchCandidate, BatchReviewItem, ExceptionItem } from '@/lib/bank-rec/matcher'

interface BankRecClientProps {
  bankAccounts: BankAccountOption[]
  accountOptions: { id: number; name: string; code: string }[]
  fundOptions: { id: number; name: string }[]
}

export function BankRecClient({
  bankAccounts,
  accountOptions,
  fundOptions,
}: BankRecClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Selection state
  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccounts.length > 0 ? String(bankAccounts[0].id) : ''
  )
  const [bankTxns, setBankTxns] = useState<BankTransactionRow[]>([])
  const [glEntries, setGlEntries] = useState<GlEntryRow[]>([])
  const [sessionData, setSessionData] = useState<SessionData>({
    session: null,
    summary: null,
    balance: null,
  })

  // Dashboard state
  const [dashSummary, setDashSummary] = useState<DailyCloseSummary | null>(null)
  const [reviewItems, setReviewItems] = useState<BatchReviewItem[]>([])
  const [exceptionItems, setExceptionItems] = useState<ExceptionItem[]>([])
  const [autoMatchedTxns, setAutoMatchedTxns] = useState<BankTransactionRow[]>([])
  const [autoMatchedOpen, setAutoMatchedOpen] = useState(false)

  // Exception match state
  const [selectedExceptionTxn, setSelectedExceptionTxn] =
    useState<BankTransactionRow | null>(null)
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  // Dialog state
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmCandidate, setConfirmCandidate] = useState<MatchCandidate | null>(null)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [inlineGlDialogOpen, setInlineGlDialogOpen] = useState(false)
  const [signOffDialogOpen, setSignOffDialogOpen] = useState(false)
  const [startSessionOpen, setStartSessionOpen] = useState(false)
  const [statementDate, setStatementDate] = useState('')
  const [statementBalance, setStatementBalance] = useState('')

  // Load all data for selected account
  const loadAccountData = useCallback(
    async (accountId: string) => {
      const id = parseInt(accountId, 10)
      const [txns, entries, session, summary, review, exceptions, autoMatches] =
        await Promise.all([
          getBankTransactions(id),
          getMatchableGlEntries(id),
          getReconciliationSession(id),
          getDailyCloseSummary(id),
          getBatchReviewItems(id),
          getExceptionItems(id),
          getRecentAutoMatches(id),
        ])
      setBankTxns(txns)
      setGlEntries(entries)
      setSessionData(session)
      setDashSummary(summary)
      setReviewItems(review)
      setExceptionItems(exceptions)
      setAutoMatchedTxns(autoMatches)
    },
    []
  )

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value)
    setSelectedExceptionTxn(null)
    setMatchCandidates([])
    startTransition(() => loadAccountData(value))
  }

  useEffect(() => {
    if (selectedAccountId) {
      loadAccountData(selectedAccountId)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleExceptionSelect = async (txn: ExceptionItem) => {
    const bankTxn: BankTransactionRow = {
      id: txn.bankTransaction.id,
      bankAccountId: txn.bankTransaction.bankAccountId,
      plaidTransactionId: txn.bankTransaction.plaidTransactionId,
      amount: txn.bankTransaction.amount,
      date: txn.bankTransaction.date,
      merchantName: txn.bankTransaction.merchantName,
      category: txn.bankTransaction.category,
      isPending: txn.bankTransaction.isPending,
      isMatched: false,
      matchId: null,
      matchType: null,
    }
    setSelectedExceptionTxn(bankTxn)
    setLoadingSuggestions(true)
    try {
      const suggestions = await getMatchSuggestions(txn.bankTransaction.id)
      setMatchCandidates(suggestions)
    } catch {
      setMatchCandidates([])
    } finally {
      setLoadingSuggestions(false)
    }
  }

  const handleConfirmMatch = (candidate: MatchCandidate) => {
    setConfirmCandidate(candidate)
    setConfirmDialogOpen(true)
  }

  const handleSync = () => {
    if (!selectedAccountId) return
    startTransition(async () => {
      try {
        const result = await triggerManualSync(
          parseInt(selectedAccountId, 10),
          'system'
        )
        toast.success(
          `Synced: ${result.added} added, ${result.modified} modified`
        )
        await loadAccountData(selectedAccountId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sync failed')
      }
    })
  }

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
        setStartSessionOpen(false)
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

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount)
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(num))
  }

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bank Reconciliation
        </h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No bank accounts connected. Connect a bank account to start
              reconciling.
            </p>
            <Button asChild data-testid="bank-rec-settings-empty-btn">
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-semibold tracking-tight">
            Bank Reconciliation
          </h1>
          <HelpTooltip term="bank-reconciliation" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/bank-rec/settings" data-testid="bank-rec-settings-link">
              <Settings className="mr-1 h-3 w-3" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Account selector + session controls */}
      <div className="flex items-center gap-4 flex-wrap">
        <BankAccountSelector
          accounts={bankAccounts}
          value={selectedAccountId}
          onValueChange={handleAccountChange}
        />
        <Button
          variant="outline"
          size="sm"
          onClick={handleSync}
          disabled={isPending}
          data-testid="bank-rec-sync-btn"
        >
          <RefreshCw
            className={`mr-1 h-3 w-3 ${isPending ? 'animate-spin' : ''}`}
          />
          Sync Now
        </Button>
        {!sessionData.session && (
          <Button
            size="sm"
            onClick={() => setStartSessionOpen(true)}
            data-testid="start-session-btn"
          >
            Start Reconciliation
          </Button>
        )}
        {sessionData.session && sessionData.session.status === 'in_progress' && (
          <Button
            size="sm"
            onClick={() => setSignOffDialogOpen(true)}
            data-testid="sign-off-btn"
          >
            <CheckCircle2 className="mr-1 h-3 w-3" />
            Sign Off
          </Button>
        )}
      </div>

      {/* Summary cards */}
      <SummaryCards summary={dashSummary} />

      {/* Reconciliation balance bar (sticky) */}
      <ReconciliationBalanceBar
        balance={sessionData.balance}
        onSignOff={() => setSignOffDialogOpen(true)}
        hasSession={!!sessionData.session}
      />

      {/* Batch review table (Tier 2) */}
      <BatchReviewTable
        items={reviewItems}
        sessionId={sessionData.session?.id ?? null}
        onRefresh={handleRefresh}
      />

      {/* Exceptions (Tier 3) */}
      {exceptionItems.length > 0 && (
        <Card data-testid="bank-rec-exceptions">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              Exceptions ({exceptionItems.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="max-h-[400px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {exceptionItems.map((item) => (
                    <TableRow
                      key={item.bankTransaction.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleExceptionSelect(item)}
                      data-testid={`bank-rec-exception-row-${item.bankTransaction.id}`}
                    >
                      <TableCell className="text-sm">
                        {item.bankTransaction.date}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">
                        {item.bankTransaction.merchantName ?? 'Unknown'}
                      </TableCell>
                      <TableCell
                        className={`text-sm font-mono ${
                          parseFloat(item.bankTransaction.amount) > 0
                            ? 'text-red-600 dark:text-red-400'
                            : 'text-green-600 dark:text-green-400'
                        }`}
                      >
                        {parseFloat(item.bankTransaction.amount) > 0 ? '-' : '+'}
                        {formatCurrency(item.bankTransaction.amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {item.reason}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Exception match suggestions */}
      {selectedExceptionTxn && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Match Suggestions for: {selectedExceptionTxn.merchantName ?? 'Unknown'} (
                {formatCurrency(selectedExceptionTxn.amount)})
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSplitDialogOpen(true)}
                  data-testid="split-btn"
                >
                  <Split className="mr-1 h-3 w-3" />
                  Split
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInlineGlDialogOpen(true)}
                  data-testid="inline-gl-btn"
                >
                  <PlusCircle className="mr-1 h-3 w-3" />
                  Create GL Entry
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <MatchSuggestionPanel
              candidates={matchCandidates}
              onSubmit={handleConfirmMatch}
              isLoading={loadingSuggestions}
            />
          </CardContent>
        </Card>
      )}

      {/* Outstanding GL items */}
      {glEntries.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Outstanding GL Items</CardTitle>
          </CardHeader>
          <CardContent>
            <OutstandingItemsPanel items={glEntries} />
          </CardContent>
        </Card>
      )}

      {/* Recently Auto-Matched (collapsible) */}
      {autoMatchedTxns.length > 0 && (
        <Collapsible open={autoMatchedOpen} onOpenChange={setAutoMatchedOpen}>
          <Card data-testid="bank-rec-auto-matched-section">
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button variant="ghost" className="w-full justify-between p-0 h-auto hover:bg-transparent">
                  <CardTitle className="text-base">
                    Recently Auto-Matched ({autoMatchedTxns.length})
                  </CardTitle>
                  {autoMatchedOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Type</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {autoMatchedTxns.map((txn) => (
                        <TableRow key={txn.id}>
                          <TableCell className="text-sm">{txn.date}</TableCell>
                          <TableCell className="text-sm truncate max-w-[150px]">
                            {txn.merchantName ?? 'Unknown'}
                          </TableCell>
                          <TableCell className="text-sm font-mono">
                            {formatCurrency(txn.amount)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className="text-xs bg-green-50 dark:bg-green-900/20"
                            >
                              Auto
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Ramp Cross-Check */}
      <RampCrossCheck />

      {/* Dialogs */}
      <ConfirmMatchDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false)
          setConfirmCandidate(null)
          handleRefresh()
        }}
        bankTransaction={selectedExceptionTxn}
        candidate={confirmCandidate}
        sessionId={sessionData.session?.id ?? null}
      />

      <SplitTransactionDialog
        open={splitDialogOpen}
        onClose={() => {
          setSplitDialogOpen(false)
          handleRefresh()
        }}
        bankTransaction={selectedExceptionTxn}
        candidates={matchCandidates}
        sessionId={sessionData.session?.id ?? null}
      />

      <InlineGlEntryDialog
        open={inlineGlDialogOpen}
        onClose={() => {
          setInlineGlDialogOpen(false)
          handleRefresh()
        }}
        bankTransaction={selectedExceptionTxn}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
        sessionId={sessionData.session?.id ?? null}
      />

      <SignOffDialog
        open={signOffDialogOpen}
        onClose={() => {
          setSignOffDialogOpen(false)
          handleRefresh()
        }}
        sessionId={sessionData.session?.id ?? null}
        balance={sessionData.balance}
        statementDate={sessionData.session?.statementDate ?? ''}
      />

      {/* Start Session Dialog */}
      <Dialog
        open={startSessionOpen}
        onOpenChange={setStartSessionOpen}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Start Reconciliation Session</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="stmt-date">Statement Date</Label>
              <Input
                id="stmt-date"
                type="date"
                value={statementDate}
                onChange={(e) => setStatementDate(e.target.value)}
                data-testid="session-statement-date"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="stmt-balance">Statement Balance</Label>
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
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setStartSessionOpen(false)}
              data-testid="bank-rec-session-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleStartSession}
              disabled={isPending || !statementDate || !statementBalance}
              data-testid="session-start-submit"
            >
              Start Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
