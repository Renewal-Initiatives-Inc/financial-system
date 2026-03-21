'use client'

import { useState, useEffect, useTransition, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  RefreshCw,
  Settings,
  CheckCircle2,
  Split,
  PlusCircle,
  AlertTriangle,
  Hand,
  Clock,
  Unlink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { SummaryCard } from '@/components/smart-dashboard/summary-card'
import { StatusBadge } from '@/components/smart-dashboard/status-badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  GroupedAccountSelect,
  type AccountOption,
} from '@/app/(protected)/bank-rec/components/grouped-account-select'
import { BankAccountSelector } from '@/app/(protected)/bank-rec/components/bank-account-selector'
import { ConfirmMatchDialog } from '@/app/(protected)/bank-rec/components/confirm-match-dialog'
import { SplitTransactionDialog } from '@/app/(protected)/bank-rec/components/split-transaction-dialog'
import { InlineGlEntryDialog } from '@/app/(protected)/bank-rec/components/inline-gl-entry-dialog'
import {
  triggerManualSync,
  getDailyCloseSummary,
  getBatchReviewItems,
  getExceptionItems,
  getRecentAutoMatches,
  bulkApproveMatches,
  createInlineGlEntry,
  createMatchingRuleAction,
  rejectMatch,
} from '@/app/(protected)/bank-rec/actions'
import { createPrepaidSchedule } from '@/app/(protected)/assets/prepaid-actions'
import { toast } from 'sonner'
import type {
  BankAccountOption,
  BankTransactionRow,
  DailyCloseSummary,
} from '@/app/(protected)/bank-rec/actions'
import type { MatchCandidate, BatchReviewItem, ExceptionItem } from '@/lib/bank-rec/matcher'

interface BankMatchClientProps {
  bankAccounts: BankAccountOption[]
  accountOptions: AccountOption[]
  fundOptions: { id: number; name: string }[]
}

type TabValue = 'exceptions' | 'pending_review' | 'matched' | 'all'

interface UnifiedRow {
  id: number
  date: string
  merchantName: string | null
  amount: string
  category: string | null
  status: 'exception' | 'pending_review' | 'matched'
  suggestedGlAccount?: string
  confidenceScore?: number
  reason?: string
  bankAccountId: number
  plaidTransactionId: string
  candidate?: MatchCandidate
  ruleId?: number
  matchId?: number | null
  glTransactionId?: number | null
}

const formatCurrency = (amount: string) => {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(num))
}

export function BankMatchClient({
  bankAccounts,
  accountOptions,
  fundOptions,
}: BankMatchClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [selectedAccountId, setSelectedAccountId] = useState<string>(
    bankAccounts.length > 0 ? String(bankAccounts[0].id) : ''
  )

  const [tab, setTab] = useState<TabValue>('exceptions')
  const [search, setSearch] = useState('')

  const [dashSummary, setDashSummary] = useState<DailyCloseSummary | null>(null)
  const [reviewItems, setReviewItems] = useState<BatchReviewItem[]>([])
  const [exceptionItems, setExceptionItems] = useState<ExceptionItem[]>([])
  const [autoMatchedTxns, setAutoMatchedTxns] = useState<BankTransactionRow[]>([])

  const [selectedRow, setSelectedRow] = useState<UnifiedRow | null>(null)
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[]>([])
  const [loadingSuggestions, setLoadingSuggestions] = useState(false)

  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmCandidate, setConfirmCandidate] = useState<MatchCandidate | null>(null)
  const [splitDialogOpen, setSplitDialogOpen] = useState(false)
  const [inlineGlDialogOpen, setInlineGlDialogOpen] = useState(false)

  const [matchDialogOpen, setMatchDialogOpen] = useState(false)
  const [matchDialogRow, setMatchDialogRow] = useState<UnifiedRow | null>(null)
  const [matchGlAccountId, setMatchGlAccountId] = useState<number | null>(null)
  const [matchFundId, setMatchFundId] = useState<number | null>(null)
  const [matchCreateRule, setMatchCreateRule] = useState(false)
  const [matchShowAdvanced, setMatchShowAdvanced] = useState(false)

  const [prepaidPromptOpen, setPrepaidPromptOpen] = useState(false)
  const [prepaidPromptData, setPrepaidPromptData] = useState<{
    merchantName: string
    amount: number
    accountId: number
  } | null>(null)
  const [prepaidDescription, setPrepaidDescription] = useState('')
  const [prepaidStartDate, setPrepaidStartDate] = useState('')
  const [prepaidEndDate, setPrepaidEndDate] = useState('')
  const [prepaidExpenseAccountId, setPrepaidExpenseAccountId] = useState('')
  const [prepaidFundId, setPrepaidFundId] = useState('')

  const defaultFundId = useMemo(
    () => fundOptions.find((f) => f.name === 'General Fund')?.id ?? fundOptions[0]?.id ?? null,
    [fundOptions]
  )

  const userOverrodeAccount = useMemo(() => {
    if (!matchDialogRow?.candidate) return true
    const suggestedAcct = accountOptions.find((a) => a.name === matchDialogRow.candidate!.accountName)
    return matchGlAccountId != null && suggestedAcct?.id !== matchGlAccountId
  }, [matchDialogRow?.candidate, matchGlAccountId, accountOptions])

  const loadAccountData = useCallback(async (accountId: string) => {
    const id = parseInt(accountId, 10)
    try {
      const [review, exceptions, autoMatches] = await Promise.all([
        getBatchReviewItems(id),
        getExceptionItems(id),
        getRecentAutoMatches(id),
      ])

      const summary = await getDailyCloseSummary(id, {
        pendingReview: review.length,
        exceptions: exceptions.length,
      })

      setDashSummary(summary)
      setReviewItems(review)
      setExceptionItems(exceptions)
      setAutoMatchedTxns(autoMatches)
    } catch (err) {
      console.error('[bank-match] loadAccountData failed:', err)
    }
  }, [])

  const handleAccountChange = (value: string) => {
    setSelectedAccountId(value)
    setSelectedRow(null)
    setMatchCandidates([])
    startTransition(() => loadAccountData(value))
  }

  useEffect(() => {
    if (selectedAccountId) {
      startTransition(() => loadAccountData(selectedAccountId))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const unifiedRows: UnifiedRow[] = useMemo(() => {
    const rows: UnifiedRow[] = []

    for (const item of exceptionItems) {
      rows.push({
        id: item.bankTransaction.id,
        date: item.bankTransaction.date,
        merchantName: item.bankTransaction.merchantName,
        amount: item.bankTransaction.amount,
        category: item.bankTransaction.category,
        status: 'exception',
        reason: item.reason,
        bankAccountId: item.bankTransaction.bankAccountId,
        plaidTransactionId: item.bankTransaction.plaidTransactionId,
      })
    }

    for (const item of reviewItems) {
      rows.push({
        id: item.bankTransaction.id,
        date: item.bankTransaction.date,
        merchantName: item.bankTransaction.merchantName,
        amount: item.bankTransaction.amount,
        category: item.bankTransaction.category,
        status: 'pending_review',
        suggestedGlAccount: item.candidate.accountName,
        confidenceScore: item.candidate.confidenceScore,
        reason: item.reason,
        bankAccountId: item.bankTransaction.bankAccountId,
        plaidTransactionId: item.bankTransaction.plaidTransactionId,
        candidate: item.candidate,
        ruleId: item.ruleId,
      })
    }

    for (const txn of autoMatchedTxns) {
      rows.push({
        id: txn.id,
        date: txn.date,
        merchantName: txn.merchantName,
        amount: txn.amount,
        category: txn.category,
        status: 'matched',
        bankAccountId: txn.bankAccountId,
        plaidTransactionId: txn.plaidTransactionId,
        matchId: txn.matchId,
        glTransactionId: txn.glTransactionId,
      })
    }

    return rows
  }, [exceptionItems, reviewItems, autoMatchedTxns])

  const filtered = useMemo(() => {
    let data = unifiedRows
    if (tab === 'exceptions') data = data.filter((r) => r.status === 'exception')
    else if (tab === 'pending_review') data = data.filter((r) => r.status === 'pending_review')
    else if (tab === 'matched') data = data.filter((r) => r.status === 'matched')

    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (r) =>
          (r.merchantName ?? '').toLowerCase().includes(q) ||
          (r.category ?? '').toLowerCase().includes(q) ||
          (r.suggestedGlAccount ?? '').toLowerCase().includes(q)
      )
    }
    return data.sort((a, b) => b.date.localeCompare(a.date))
  }, [unifiedRows, tab, search])

  const optimisticMatch = (row: UnifiedRow) => {
    setExceptionItems((prev) => prev.filter((i) => i.bankTransaction.id !== row.id))
    setReviewItems((prev) => prev.filter((i) => i.bankTransaction.id !== row.id))
    setAutoMatchedTxns((prev) => [
      ...prev,
      {
        id: row.id,
        bankAccountId: row.bankAccountId,
        plaidTransactionId: row.plaidTransactionId,
        amount: row.amount,
        date: row.date,
        merchantName: row.merchantName,
        category: row.category,
        isPending: false,
        isMatched: true,
        matchId: null,
        matchType: null,
        glTransactionId: null,
      },
    ])
  }

  const openMatchDialog = (row: UnifiedRow) => {
    setMatchDialogRow(row)
    if (row.candidate) {
      const matchedAcct = accountOptions.find((a) => a.name === row.candidate!.accountName)
      setMatchGlAccountId(matchedAcct?.id ?? null)
    } else {
      setMatchGlAccountId(null)
    }
    setMatchFundId(defaultFundId)
    setMatchCreateRule(false)
    setMatchShowAdvanced(false)
    setMatchDialogOpen(true)
  }

  const handleRowClick = (row: UnifiedRow) => {
    if (row.status === 'matched') {
      if (row.glTransactionId) {
        router.push(`/transactions/${row.glTransactionId}`)
      }
      return
    }
    openMatchDialog(row)
  }

  const handleConfirmMatch = (candidate: MatchCandidate) => {
    setConfirmCandidate(candidate)
    setConfirmDialogOpen(true)
  }

  const handleApprove = (row: UnifiedRow) => {
    if (!row.candidate) return
    optimisticMatch(row)
    startTransition(async () => {
      try {
        const result = await bulkApproveMatches(
          [
            {
              bankTransactionId: row.id,
              glTransactionLineId: row.candidate!.glTransactionLineId,
              ruleId: row.ruleId,
            },
          ],
          null,
          'system'
        )
        if (result.approved > 0) {
          toast.success('Match approved')
        } else {
          toast.error('Failed to approve match')
          handleRefresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Approve failed')
        handleRefresh()
      }
    })
  }

  const handleApproveAll = () => {
    if (reviewItems.length === 0) return
    const itemsToApprove = [...reviewItems]
    setReviewItems([])
    startTransition(async () => {
      try {
        const result = await bulkApproveMatches(
          itemsToApprove.map((item) => ({
            bankTransactionId: item.bankTransaction.id,
            glTransactionLineId: item.candidate.glTransactionLineId,
            ruleId: item.ruleId,
          })),
          null,
          'system'
        )
        toast.success(
          `${result.approved} matches approved${result.failed > 0 ? `, ${result.failed} failed` : ''}`
        )
        if (result.failed > 0) handleRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Bulk approve failed')
        handleRefresh()
      }
    })
  }

  const handleUnmatch = (row: UnifiedRow) => {
    if (!row.matchId) return
    setAutoMatchedTxns((prev) => prev.filter((t) => t.id !== row.id))
    startTransition(async () => {
      try {
        await rejectMatch(row.matchId!, 'system', row.bankAccountId)
        toast.success('Match removed')
        handleRefresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Unmatch failed')
        handleRefresh()
      }
    })
  }

  const handleSync = () => {
    if (!selectedAccountId) return
    startTransition(async () => {
      try {
        const result = await triggerManualSync(parseInt(selectedAccountId, 10), 'system')
        toast.success(`Synced: ${result.added} added, ${result.modified} modified`)
        await loadAccountData(selectedAccountId)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sync failed')
      }
    })
  }

  const handleRefresh = () => {
    setSelectedRow(null)
    setMatchCandidates([])
    startTransition(() => loadAccountData(selectedAccountId))
  }

  const selectedBankTxn: BankTransactionRow | null = selectedRow
    ? {
        id: selectedRow.id,
        bankAccountId: selectedRow.bankAccountId,
        plaidTransactionId: selectedRow.plaidTransactionId,
        amount: selectedRow.amount,
        date: selectedRow.date,
        merchantName: selectedRow.merchantName,
        category: selectedRow.category,
        isPending: false,
        isMatched: false,
        matchId: null,
        matchType: null,
        glTransactionId: null,
      }
    : null

  const matchDialogBankTxn: BankTransactionRow | null = matchDialogRow
    ? {
        id: matchDialogRow.id,
        bankAccountId: matchDialogRow.bankAccountId,
        plaidTransactionId: matchDialogRow.plaidTransactionId,
        amount: matchDialogRow.amount,
        date: matchDialogRow.date,
        merchantName: matchDialogRow.merchantName,
        category: matchDialogRow.category,
        isPending: false,
        isMatched: false,
        matchId: null,
        matchType: null,
        glTransactionId: null,
      }
    : null

  if (bankAccounts.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Match Bank Transactions</h1>
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground mb-4">
              No bank accounts connected. Connect a bank account to start matching.
            </p>
            <Button asChild data-testid="bank-match-settings-empty-btn">
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
          <h1 className="text-2xl font-semibold tracking-tight">Match Bank Transactions</h1>
          <HelpTooltip term="bank-reconciliation" />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/bank-rec/settings" data-testid="bank-match-settings-link">
              <Settings className="mr-1 h-3 w-3" />
              Settings
            </Link>
          </Button>
        </div>
      </div>

      {/* Account selector + sync */}
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
          data-testid="bank-match-sync-btn"
        >
          <RefreshCw className={`mr-1 h-3 w-3 ${isPending ? 'animate-spin' : ''}`} />
          Sync Now
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="bank-match-summary-cards">
        <SummaryCard
          icon={AlertTriangle}
          label="Exceptions"
          count={exceptionItems.length}
          variant="warning"
          testId="bank-match-exceptions-card"
        />
        <SummaryCard
          icon={Hand}
          label="Pending Review"
          count={reviewItems.length}
          variant="info"
          testId="bank-match-pending-card"
        />
        <SummaryCard
          icon={CheckCircle2}
          label="Auto-Matched"
          count={dashSummary?.autoMatched ?? 0}
          variant="success"
          testId="bank-match-auto-matched-card"
        />
        <SummaryCard
          icon={Clock}
          label="Matched Today"
          count={autoMatchedTxns.length}
          variant="info"
          testId="bank-match-matched-today-card"
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={tab}
        onValueChange={(v) => {
          setTab(v as TabValue)
          setSelectedRow(null)
          setMatchCandidates([])
        }}
      >
        <TabsList>
          <TabsTrigger value="exceptions" data-testid="bank-match-tab-exceptions">
            Exceptions
            {exceptionItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {exceptionItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="pending_review" data-testid="bank-match-tab-pending">
            Pending Review
            {reviewItems.length > 0 && (
              <Badge variant="secondary" className="ml-2">
                {reviewItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="matched" data-testid="bank-match-tab-matched">
            Matched
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="bank-match-tab-all">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search merchant, category..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="bank-match-search-input"
        />
        {tab === 'pending_review' && reviewItems.length > 0 && (
          <Button
            onClick={handleApproveAll}
            disabled={isPending}
            data-testid="bank-match-approve-all-btn"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Approve All ({reviewItems.length})
          </Button>
        )}
      </div>

      {/* Transaction table */}
      <div data-testid="bank-match-table">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Suggested GL Account</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length > 0 ? (
                filtered.map((row) => (
                  <TableRow
                    key={row.id}
                    className={
                      row.status === 'matched'
                        ? row.glTransactionId
                          ? 'cursor-pointer hover:bg-muted/50'
                          : ''
                        : 'cursor-pointer hover:bg-muted/50'
                    }
                    onClick={() => handleRowClick(row)}
                    data-testid={`bank-match-row-${row.id}`}
                  >
                    <TableCell className="text-sm">{row.date}</TableCell>
                    <TableCell className="text-sm truncate max-w-[150px]">
                      {row.merchantName ?? 'Unknown'}
                    </TableCell>
                    <TableCell
                      className={`text-sm font-mono ${
                        parseFloat(row.amount) > 0
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {parseFloat(row.amount) > 0 ? '-' : '+'}
                      {formatCurrency(row.amount)}
                    </TableCell>
                    <TableCell>
                      {row.status === 'exception' && (
                        <StatusBadge type="confidence" value="low" label="Exception" />
                      )}
                      {row.status === 'pending_review' && (
                        <StatusBadge type="confidence" value="medium" label="Review" />
                      )}
                      {row.status === 'matched' && (
                        <StatusBadge type="confidence" value="high" label="Matched" />
                      )}
                    </TableCell>
                    <TableCell className="text-sm truncate max-w-[180px]">
                      {row.suggestedGlAccount ?? (
                        <span className="text-muted-foreground text-xs">
                          {row.status === 'exception' ? 'No GL match found' : '—'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.confidenceScore != null && (
                        <StatusBadge
                          type="confidence"
                          value={
                            row.confidenceScore >= 90
                              ? 'high'
                              : row.confidenceScore >= 70
                                ? 'medium'
                                : 'low'
                          }
                          label={`${Math.round(row.confidenceScore)}%`}
                        />
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {row.status === 'pending_review' && row.candidate && (
                        <div
                          className="flex gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleApprove(row)}
                            disabled={isPending}
                            data-testid={`bank-match-approve-btn-${row.id}`}
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {row.status === 'exception' && (
                        <div
                          className="flex gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => openMatchDialog(row)}
                            disabled={isPending}
                            data-testid={`bank-match-create-gl-btn-${row.id}`}
                          >
                            <PlusCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {row.status === 'matched' && row.matchId && (
                        <div
                          className="flex gap-1 justify-end"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleUnmatch(row)}
                            disabled={isPending}
                            title="Unmatch"
                            data-testid={`bank-match-unmatch-btn-${row.id}`}
                          >
                            <Unlink className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-24 text-center"
                    data-testid="bank-match-table-empty"
                  >
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Match Dialog */}
      <Dialog
        open={matchDialogOpen}
        onOpenChange={(v) => {
          if (!v) {
            setMatchDialogOpen(false)
            setMatchDialogRow(null)
            setMatchShowAdvanced(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Match Bank Transaction</DialogTitle>
          </DialogHeader>

          {matchDialogRow && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Merchant</span>
                  <p className="font-medium">{matchDialogRow.merchantName ?? 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Amount</span>
                  <p
                    className={`font-medium font-mono ${
                      parseFloat(matchDialogRow.amount) > 0
                        ? 'text-red-600 dark:text-red-400'
                        : 'text-green-600 dark:text-green-400'
                    }`}
                  >
                    {parseFloat(matchDialogRow.amount) > 0 ? '-' : '+'}
                    {formatCurrency(matchDialogRow.amount)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Date</span>
                  <p className="font-medium">{matchDialogRow.date}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Category</span>
                  <p className="font-medium">{matchDialogRow.category ?? '—'}</p>
                </div>
              </div>

              {matchDialogRow.candidate && (
                <div className="flex items-start gap-2 p-3 rounded-lg border bg-blue-50/50 dark:bg-blue-900/10">
                  <CheckCircle2 className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                  <div className="text-sm">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">Suggested Match</span>
                      {matchDialogRow.confidenceScore != null && (
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            matchDialogRow.confidenceScore >= 90
                              ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                              : matchDialogRow.confidenceScore >= 70
                                ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                          }`}
                        >
                          {Math.round(matchDialogRow.confidenceScore)}% confidence
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground mt-1">
                      GL: {matchDialogRow.candidate.accountName}
                      {matchDialogRow.candidate.memo && ` — ${matchDialogRow.candidate.memo}`}
                    </p>
                    {matchDialogRow.reason && (
                      <p className="text-xs text-muted-foreground mt-1">{matchDialogRow.reason}</p>
                    )}
                  </div>
                </div>
              )}

              {Math.abs(parseFloat(matchDialogRow.amount)) >= 2500 && (
                <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-800 dark:text-amber-200">
                    <p className="font-medium">Expense exceeds $2,500</p>
                    <p className="mt-1 text-xs">
                      If this prepayment covers a period longer than 12 months, consider posting to{' '}
                      <span className="font-medium">Prepaid Expenses (1200)</span> and setting up an
                      amortization schedule instead of expensing immediately.
                    </p>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label>
                  {parseFloat(matchDialogRow.amount) > 0
                    ? 'Where did this money go?'
                    : 'Where did this money come from?'}
                </Label>
                <GroupedAccountSelect
                  accounts={accountOptions}
                  value={matchGlAccountId ? String(matchGlAccountId) : ''}
                  onValueChange={(v) => setMatchGlAccountId(parseInt(v, 10))}
                  placeholder="Select account..."
                  testId="bank-match-gl-account"
                />
              </div>

              {matchShowAdvanced ? (
                <div className="grid gap-2">
                  <Label>Funding Source</Label>
                  <Select
                    value={matchFundId ? String(matchFundId) : ''}
                    onValueChange={(v) => setMatchFundId(parseInt(v, 10))}
                  >
                    <SelectTrigger data-testid="bank-match-fund">
                      <SelectValue placeholder="Select fund..." />
                    </SelectTrigger>
                    <SelectContent>
                      {fundOptions.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground text-left"
                  onClick={() => setMatchShowAdvanced(true)}
                  data-testid="bank-match-show-advanced"
                >
                  Fund: {fundOptions.find((f) => f.id === matchFundId)?.name ?? 'General Fund'} —
                  change
                </button>
              )}

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="bank-match-create-rule"
                  checked={matchCreateRule}
                  onChange={(e) => setMatchCreateRule(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300"
                  data-testid="bank-match-create-rule"
                />
                <Label htmlFor="bank-match-create-rule">
                  Always match &quot;{matchDialogRow.merchantName}&quot; to this account
                </Label>
              </div>

              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-foreground text-left flex items-center gap-1"
                onClick={() => {
                  setSelectedRow(matchDialogRow)
                  setMatchDialogOpen(false)
                  setMatchDialogRow(null)
                  setMatchShowAdvanced(false)
                  setSplitDialogOpen(true)
                }}
                data-testid="bank-match-split-link"
              >
                <Split className="h-3 w-3" />
                Split this transaction across multiple accounts
              </button>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setMatchDialogOpen(false)
                setMatchDialogRow(null)
                setMatchShowAdvanced(false)
              }}
              data-testid="bank-match-cancel-btn"
            >
              Cancel
            </Button>
            {matchDialogRow?.candidate && !userOverrodeAccount ? (
              <Button
                onClick={() => {
                  if (!matchDialogRow.candidate) return
                  optimisticMatch(matchDialogRow)
                  setMatchDialogOpen(false)
                  setMatchDialogRow(null)
                  setMatchShowAdvanced(false)
                  startTransition(async () => {
                    try {
                      await bulkApproveMatches(
                        [
                          {
                            bankTransactionId: matchDialogRow.id,
                            glTransactionLineId: matchDialogRow.candidate!.glTransactionLineId,
                            ruleId: matchDialogRow.ruleId,
                          },
                        ],
                        null,
                        'system'
                      )
                      toast.success('Match approved')
                      handleRefresh()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Approve failed')
                      handleRefresh()
                    }
                  })
                }}
                disabled={isPending}
                data-testid="bank-match-approve-btn"
              >
                Approve Match
              </Button>
            ) : (
              <Button
                onClick={() => {
                  if (!matchDialogRow || !matchGlAccountId) return
                  const fundId = matchFundId || defaultFundId
                  if (!fundId) {
                    toast.error('No fund available')
                    return
                  }
                  optimisticMatch(matchDialogRow)
                  setMatchDialogOpen(false)
                  setMatchDialogRow(null)
                  setMatchShowAdvanced(false)
                  startTransition(async () => {
                    try {
                      await createInlineGlEntry(
                        {
                          date: matchDialogRow.date,
                          memo: matchDialogRow.merchantName ?? 'Bank transaction',
                          accountId: matchGlAccountId,
                          fundId,
                          amount: matchDialogRow.amount,
                          bankTransactionId: matchDialogRow.id,
                        },
                        null
                      )
                      if (matchCreateRule && matchDialogRow.merchantName) {
                        await createMatchingRuleAction(
                          { merchantPattern: matchDialogRow.merchantName },
                          { glAccountId: matchGlAccountId, fundId }
                        )
                      }
                      toast.success('GL entry created and matched')
                      handleRefresh()

                      const matchedAccount = accountOptions.find((a) => a.id === matchGlAccountId)
                      const txnAmount = Math.abs(parseFloat(matchDialogRow.amount))
                      if (
                        matchedAccount &&
                        matchedAccount.code?.startsWith('12') &&
                        txnAmount >= 2500
                      ) {
                        setPrepaidPromptData({
                          merchantName: matchDialogRow.merchantName ?? 'Prepaid expense',
                          amount: txnAmount,
                          accountId: matchGlAccountId,
                        })
                        setPrepaidDescription(matchDialogRow.merchantName ?? '')
                        setPrepaidFundId(String(fundId))
                        setPrepaidPromptOpen(true)
                      }
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to create GL entry')
                      handleRefresh()
                    }
                  })
                }}
                disabled={isPending || !matchGlAccountId}
                data-testid="bank-match-create-gl-btn"
              >
                Match to Account
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmMatchDialog
        open={confirmDialogOpen}
        onClose={() => {
          setConfirmDialogOpen(false)
          setConfirmCandidate(null)
          handleRefresh()
        }}
        bankTransaction={selectedBankTxn}
        candidate={confirmCandidate}
        sessionId={null}
      />

      <SplitTransactionDialog
        open={splitDialogOpen}
        onClose={(matched) => {
          setSplitDialogOpen(false)
          if (matched && selectedRow) optimisticMatch(selectedRow)
        }}
        bankTransaction={selectedBankTxn}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
        defaultFundId={defaultFundId}
        sessionId={null}
      />

      <InlineGlEntryDialog
        open={inlineGlDialogOpen}
        onClose={() => {
          setInlineGlDialogOpen(false)
          handleRefresh()
        }}
        bankTransaction={matchDialogBankTxn ?? selectedBankTxn}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
        sessionId={null}
      />

      {/* Prepaid Amortization Prompt */}
      <Dialog
        open={prepaidPromptOpen}
        onOpenChange={(v) => {
          if (!v) {
            setPrepaidPromptOpen(false)
            setPrepaidPromptData(null)
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Set Up Amortization Schedule?</DialogTitle>
          </DialogHeader>

          {prepaidPromptData && (
            <div className="space-y-4">
              <p className="text-sm">
                This{' '}
                <span className="font-medium font-mono">
                  {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                  }).format(prepaidPromptData.amount)}
                </span>{' '}
                expense was posted to Prepaid Expenses. Would you like to set up an amortization
                schedule?
              </p>

              <div>
                <Label>Description</Label>
                <Input
                  value={prepaidDescription}
                  onChange={(e) => setPrepaidDescription(e.target.value)}
                  placeholder="e.g., Annual property insurance"
                  data-testid="prepaid-prompt-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date</Label>
                  <Input
                    type="date"
                    value={prepaidStartDate}
                    onChange={(e) => setPrepaidStartDate(e.target.value)}
                    data-testid="prepaid-prompt-start-date"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={prepaidEndDate}
                    onChange={(e) => setPrepaidEndDate(e.target.value)}
                    data-testid="prepaid-prompt-end-date"
                  />
                </div>
              </div>

              <div>
                <Label>GL Expense Account</Label>
                <GroupedAccountSelect
                  accounts={accountOptions.filter((a) => a.type === 'EXPENSE')}
                  value={prepaidExpenseAccountId}
                  onValueChange={setPrepaidExpenseAccountId}
                  placeholder="Select expense account..."
                  testId="prepaid-prompt-expense-account"
                />
              </div>

              <div>
                <Label>Funding Source</Label>
                <Select value={prepaidFundId} onValueChange={setPrepaidFundId}>
                  <SelectTrigger data-testid="prepaid-prompt-fund">
                    <SelectValue placeholder="Select fund..." />
                  </SelectTrigger>
                  <SelectContent>
                    {fundOptions.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPrepaidPromptOpen(false)
                setPrepaidPromptData(null)
              }}
              data-testid="prepaid-prompt-dismiss-btn"
            >
              Not Now
            </Button>
            <Button
              onClick={() => {
                if (
                  !prepaidPromptData ||
                  !prepaidStartDate ||
                  !prepaidEndDate ||
                  !prepaidExpenseAccountId ||
                  !prepaidFundId
                ) {
                  toast.error('Please fill in all fields')
                  return
                }
                startTransition(async () => {
                  try {
                    await createPrepaidSchedule({
                      description: prepaidDescription.trim() || prepaidPromptData.merchantName,
                      totalAmount: prepaidPromptData.amount,
                      startDate: prepaidStartDate,
                      endDate: prepaidEndDate,
                      glExpenseAccountId: parseInt(prepaidExpenseAccountId, 10),
                      glPrepaidAccountId: prepaidPromptData.accountId,
                      fundId: parseInt(prepaidFundId, 10),
                    })
                    toast.success('Amortization schedule created')
                    setPrepaidPromptOpen(false)
                    setPrepaidPromptData(null)
                    setPrepaidDescription('')
                    setPrepaidStartDate('')
                    setPrepaidEndDate('')
                    setPrepaidExpenseAccountId('')
                    setPrepaidFundId('')
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : 'Failed to create schedule')
                  }
                })
              }}
              disabled={
                isPending ||
                !prepaidStartDate ||
                !prepaidEndDate ||
                !prepaidExpenseAccountId ||
                !prepaidFundId
              }
              data-testid="prepaid-prompt-create-btn"
            >
              {isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
