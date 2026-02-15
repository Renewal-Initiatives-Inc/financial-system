'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, Settings, CheckCircle2, Split, PlusCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { BankAccountSelector } from './components/bank-account-selector'
import { ReconciliationSummaryPanel } from './components/reconciliation-summary'
import { MatchSuggestionPanel } from './components/match-suggestion-panel'
import { ConfirmMatchDialog } from './components/confirm-match-dialog'
import { SplitTransactionDialog } from './components/split-transaction-dialog'
import { InlineGlEntryDialog } from './components/inline-gl-entry-dialog'
import { SignOffDialog } from './components/sign-off-dialog'
import { OutstandingItemsPanel } from './components/outstanding-items-panel'
import { RampCrossCheck } from './components/ramp-cross-check'
import { PendingTransactions } from './components/pending-transactions'
import {
  getBankTransactions,
  getMatchableGlEntries,
  getMatchSuggestions,
  getReconciliationSession,
  startReconciliationSession,
  triggerManualSync,
} from './actions'
import { toast } from 'sonner'
import type {
  BankAccountOption,
  BankTransactionRow,
  SessionData,
} from './actions'
import type { GlEntryRow } from '@/lib/bank-rec/gl-only-categories'
import type { MatchCandidate } from '@/lib/bank-rec/matcher'
import type { ReconciliationSummary, ReconciliationBalance } from '@/lib/bank-rec/reconciliation'

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

  // Match suggestion state
  const [selectedBankTxn, setSelectedBankTxn] =
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

  // Load data for selected account
  const loadAccountData = useCallback(
    async (accountId: string) => {
      const id = parseInt(accountId, 10)
      const [txns, entries, session] = await Promise.all([
        getBankTransactions(id),
        getMatchableGlEntries(id),
        getReconciliationSession(id),
      ])
      setBankTxns(txns)
      setGlEntries(entries)
      setSessionData(session)
    },
    []
  )

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value)
    setSelectedBankTxn(null)
    setMatchCandidates([])
    startTransition(() => loadAccountData(value))
  }

  // Load data on first render if we have accounts
  const [hasLoaded, setHasLoaded] = useState(false)
  if (!hasLoaded && selectedAccountId) {
    setHasLoaded(true)
    loadAccountData(selectedAccountId)
  }

  const handleBankTxnSelect = async (txn: BankTransactionRow) => {
    if (txn.isPending || txn.isMatched) return
    setSelectedBankTxn(txn)
    setLoadingSuggestions(true)
    try {
      const suggestions = await getMatchSuggestions(txn.id)
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

  const unmatchedBank = bankTxns.filter((t) => !t.isMatched && !t.isPending)
  const matchedBank = bankTxns.filter((t) => t.isMatched)
  const pendingBank = bankTxns.filter((t) => t.isPending)
  const unmatchedGl = glEntries.filter((e) => !e.isMatched && !e.isGlOnly)
  const matchedGl = glEntries.filter((e) => e.isMatched)
  const glOnly = glEntries.filter((e) => e.isGlOnly)

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
          <Button
            variant="outline"
            size="sm"
            asChild
          >
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

      {/* Reconciliation summary */}
      <ReconciliationSummaryPanel
        summary={sessionData.summary}
        balance={sessionData.balance}
      />

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left panel — Bank Transactions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Bank Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="unmatched">
              <TabsList className="mb-3">
                <TabsTrigger value="unmatched" data-testid="bank-tab-unmatched">
                  Unmatched
                  {unmatchedBank.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {unmatchedBank.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="matched" data-testid="bank-tab-matched">
                  Matched
                </TabsTrigger>
                <TabsTrigger value="pending" data-testid="bank-tab-pending">
                  Pending
                  {pendingBank.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {pendingBank.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="unmatched">
                {unmatchedBank.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    All bank transactions are matched.
                  </p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Description</TableHead>
                          <TableHead>Amount</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {unmatchedBank.map((txn) => (
                          <TableRow
                            key={txn.id}
                            className={`cursor-pointer hover:bg-muted/50 ${
                              selectedBankTxn?.id === txn.id
                                ? 'bg-muted'
                                : ''
                            }`}
                            onClick={() => handleBankTxnSelect(txn)}
                            data-testid={`bank-txn-row-${txn.id}`}
                          >
                            <TableCell className="text-sm">
                              {txn.date}
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[150px]">
                              {txn.merchantName ?? 'Unknown'}
                            </TableCell>
                            <TableCell
                              className={`text-sm font-mono ${
                                parseFloat(txn.amount) > 0
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-green-600 dark:text-green-400'
                              }`}
                            >
                              {parseFloat(txn.amount) > 0 ? '-' : '+'}
                              {formatCurrency(txn.amount)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="matched">
                {matchedBank.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No matched transactions yet.
                  </p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
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
                        {matchedBank.map((txn) => (
                          <TableRow key={txn.id}>
                            <TableCell className="text-sm">
                              {txn.date}
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[120px]">
                              {txn.merchantName ?? 'Unknown'}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {formatCurrency(txn.amount)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {txn.matchType}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="pending">
                <PendingTransactions transactions={bankTxns} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* Right panel — GL Entries */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">GL Entries</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="outstanding">
              <TabsList className="mb-3">
                <TabsTrigger value="outstanding" data-testid="gl-tab-outstanding">
                  Outstanding
                  {unmatchedGl.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {unmatchedGl.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="matched" data-testid="gl-tab-matched">
                  Matched
                </TabsTrigger>
                <TabsTrigger value="gl-only" data-testid="gl-tab-gl-only">
                  GL-Only
                  {glOnly.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {glOnly.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="outstanding">
                <OutstandingItemsPanel items={glEntries} />
              </TabsContent>

              <TabsContent value="matched">
                {matchedGl.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No matched GL entries yet.
                  </p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Memo</TableHead>
                          <TableHead>Debit</TableHead>
                          <TableHead>Credit</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {matchedGl.map((entry) => (
                          <TableRow key={entry.lineId}>
                            <TableCell className="text-sm">
                              {entry.date}
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[120px]">
                              {entry.memo}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {entry.debit
                                ? `$${parseFloat(entry.debit).toFixed(2)}`
                                : ''}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              {entry.credit
                                ? `$${parseFloat(entry.credit).toFixed(2)}`
                                : ''}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="gl-only">
                {glOnly.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">
                    No GL-only entries found.
                  </p>
                ) : (
                  <div className="max-h-[400px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Date</TableHead>
                          <TableHead>Memo</TableHead>
                          <TableHead>Amount</TableHead>
                          <TableHead>Source</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {glOnly.map((entry) => (
                          <TableRow
                            key={entry.lineId}
                            className="opacity-60"
                          >
                            <TableCell className="text-sm">
                              {entry.date}
                            </TableCell>
                            <TableCell className="text-sm truncate max-w-[120px]">
                              {entry.memo}
                            </TableCell>
                            <TableCell className="text-sm font-mono">
                              ${Math.abs(entry.amount).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className="text-xs bg-gray-100 dark:bg-gray-800"
                              >
                                {entry.sourceType}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Match suggestions panel */}
      {selectedBankTxn && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Match Suggestions for: {selectedBankTxn.merchantName ?? 'Unknown'} (
                {formatCurrency(selectedBankTxn.amount)})
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

      {/* Ramp Cross-Check */}
      <RampCrossCheck />

      {/* Dialogs */}
      <ConfirmMatchDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false)
          setConfirmCandidate(null)
          startTransition(() => loadAccountData(selectedAccountId))
        }}
        bankTransaction={selectedBankTxn}
        candidate={confirmCandidate}
        sessionId={sessionData.session?.id ?? null}
      />

      <SplitTransactionDialog
        open={splitDialogOpen}
        onClose={() => {
          setSplitDialogOpen(false)
          startTransition(() => loadAccountData(selectedAccountId))
        }}
        bankTransaction={selectedBankTxn}
        candidates={matchCandidates}
        sessionId={sessionData.session?.id ?? null}
      />

      <InlineGlEntryDialog
        open={inlineGlDialogOpen}
        onClose={() => {
          setInlineGlDialogOpen(false)
          startTransition(() => loadAccountData(selectedAccountId))
        }}
        bankTransaction={selectedBankTxn}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
        sessionId={sessionData.session?.id ?? null}
      />

      <SignOffDialog
        open={signOffDialogOpen}
        onClose={() => {
          setSignOffDialogOpen(false)
          startTransition(() => loadAccountData(selectedAccountId))
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
