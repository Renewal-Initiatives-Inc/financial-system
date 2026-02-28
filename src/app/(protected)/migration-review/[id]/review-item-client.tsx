'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, ArrowLeft } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'
import { AccountSelector } from '@/components/shared/account-selector'
import { FundSelector } from '@/components/shared/fund-selector'
import {
  approveItem,
  skipItem,
  getNextPendingId,
  type ReviewItemRow,
  type AccountRow,
  type FundRow,
  type AdjacentItems,
} from '../actions'
import type {
  ReviewRecommendation,
  MatchData,
  MatchCandidate,
  AccrualData,
  UserSelections,
} from '@/lib/migration/review-engine'

interface Props {
  detail: {
    item: ReviewItemRow
    recommendation: ReviewRecommendation
    matchData: MatchData | null
    accrualData: AccrualData | null
    userSelections: UserSelections | null
    consumedMatchIds: string[]
    accounts: AccountRow[]
    funds: FundRow[]
  }
  adjacent: AdjacentItems
}

export function ReviewItemClient({ detail, adjacent }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const { item, recommendation, matchData, accrualData, accounts, funds } = detail
  const consumedMatchIds = new Set(detail.consumedMatchIds)

  // Per-line selections (accountId + fundId)
  const [lineSelections, setLineSelections] = useState<
    Array<{ accountId: number; fundId: number; memo: string | null }>
  >(
    (detail.userSelections?.lines ?? recommendation.lines).map((l) => ({
      accountId: l.accountId,
      fundId: l.fundId,
      memo: l.memo ?? null,
    }))
  )

  // Match selection
  const [selectedMatchId, setSelectedMatchId] = useState<string>(
    detail.userSelections?.matchedTransactionId ?? ''
  )

  // Accrual state
  const [accrualEnabled, setAccrualEnabled] = useState(
    detail.userSelections?.accrual?.enabled ?? accrualData?.flag ?? false
  )
  const [accrualStartDate, setAccrualStartDate] = useState(
    detail.userSelections?.accrual?.startDate ?? accrualData?.startDate ?? ''
  )
  const [accrualEndDate, setAccrualEndDate] = useState(
    detail.userSelections?.accrual?.endDate ?? accrualData?.endDate ?? ''
  )

  const totalAmount = Number(item.amount)

  // Filter out consumed matches from candidates (except our own selection)
  const availableCandidates = matchData?.candidates.filter(
    (c) => !consumedMatchIds.has(c.sourceId) || c.sourceId === selectedMatchId
  ) ?? []

  function updateLine(index: number, field: 'accountId' | 'fundId', value: number | null) {
    setLineSelections((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value ?? updated[index][field] }
      return updated
    })
  }

  function buildSelections(): UserSelections {
    const sel: UserSelections = {
      lines: lineSelections,
      matchConfirmed: !!selectedMatchId,
    }
    if (selectedMatchId) {
      sel.matchedTransactionId = selectedMatchId
      const candidate = matchData?.candidates.find((c) => c.sourceId === selectedMatchId)
      if (candidate) sel.matchedSource = candidate.source
    }
    if (accrualEnabled && accrualStartDate && accrualEndDate) {
      sel.accrual = {
        enabled: true,
        startDate: accrualStartDate,
        endDate: accrualEndDate,
      }
    }
    return sel
  }

  async function handleApprove() {
    startTransition(async () => {
      const selections = buildSelections()
      await approveItem(item.id, selections, 'jeff') // TODO: real userId from auth
      // Navigate to next pending
      const nextId = await getNextPendingId(item.batchId, item.id)
      if (nextId) {
        router.push(`/migration-review/${nextId}`)
      } else {
        router.push('/migration-review')
      }
    })
  }

  async function handleSkip() {
    startTransition(async () => {
      await skipItem(item.id)
      const nextId = await getNextPendingId(item.batchId, item.id)
      if (nextId) {
        router.push(`/migration-review/${nextId}`)
      } else {
        router.push('/migration-review')
      }
    })
  }

  // Accrual calculation
  let monthsCount = 0
  let monthlyAmount = 0
  if (accrualEnabled && accrualStartDate && accrualEndDate) {
    const start = new Date(accrualStartDate)
    const end = new Date(accrualEndDate)
    monthsCount = Math.max(1, Math.round((end.getTime() - start.getTime()) / (30.44 * 24 * 60 * 60 * 1000)))
    monthlyAmount = Math.round((totalAmount / monthsCount) * 100) / 100
  }

  return (
    <div className="space-y-6">
      <CopilotContextSetter pageId="migration-review" data={{ currentTransaction: item }} />

      {/* Header: navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/migration-review">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" /> Summary
            </Button>
          </Link>
          <span className="text-sm text-muted-foreground">
            Transaction {adjacent.currentIndex} of {adjacent.total}
          </span>
          <StatusBadge status={item.status} />
        </div>
        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent.prevId}
            onClick={() => adjacent.prevId && router.push(`/migration-review/${adjacent.prevId}`)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!adjacent.nextId}
            onClick={() => adjacent.nextId && router.push(`/migration-review/${adjacent.nextId}`)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Section 1: Transaction Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Transaction Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-lg font-semibold">{item.description}</p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>QBO #{item.qboTransactionNo}</span>
            <span>Date: {item.transactionDate}</span>
            <span className="font-mono">
              Total: ${totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: GL Mapping (per-line) */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">GL Mapping</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Fund</TableHead>
                <TableHead className="w-28 text-right">Debit</TableHead>
                <TableHead className="w-28 text-right">Credit</TableHead>
                <TableHead className="w-36">Payee</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recommendation.lines.map((recLine, i) => (
                <TableRow key={i}>
                  <TableCell>
                    <AccountSelector
                      accounts={accounts}
                      value={lineSelections[i]?.accountId ?? recLine.accountId}
                      onSelect={(id) => updateLine(i, 'accountId', id)}
                      disabled={item.status !== 'pending'}
                    />
                  </TableCell>
                  <TableCell>
                    <FundSelector
                      funds={funds}
                      value={lineSelections[i]?.fundId ?? recLine.fundId}
                      onSelect={(id) => updateLine(i, 'fundId', id)}
                      disabled={item.status !== 'pending'}
                    />
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {recLine.debit ? `$${recLine.debit.toFixed(2)}` : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {recLine.credit ? `$${recLine.credit.toFixed(2)}` : ''}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {recLine.memo ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {/* Justification */}
          <div className="mt-4 rounded-md bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Mapping Justification</p>
            <pre className="text-xs whitespace-pre-wrap font-mono">{recommendation.justification}</pre>
          </div>
        </CardContent>
      </Card>

      {/* Section 3: Source Match (conditional) */}
      {matchData && !matchData.isTransfer && availableCandidates.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Match</CardTitle>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={selectedMatchId}
              onValueChange={setSelectedMatchId}
              disabled={item.status !== 'pending'}
            >
              {availableCandidates.map((candidate) => (
                <div
                  key={candidate.sourceId}
                  className="flex items-center gap-3 rounded-md border p-3"
                >
                  <RadioGroupItem value={candidate.sourceId} id={candidate.sourceId} />
                  <Label htmlFor={candidate.sourceId} className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm font-medium">{candidate.description || 'No description'}</span>
                        <span className="ml-2 text-xs text-muted-foreground">
                          {candidate.date} &middot; ${candidate.amount}
                        </span>
                      </div>
                      <MatchConfidenceBadge type={candidate.matchType} days={candidate.daysDiff} />
                    </div>
                  </Label>
                </div>
              ))}
              <div className="flex items-center gap-3 rounded-md border p-3">
                <RadioGroupItem value="" id="no-match" />
                <Label htmlFor="no-match" className="cursor-pointer text-sm text-muted-foreground">
                  None of these match
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>
      )}

      {matchData && matchData.isTransfer && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Internal Transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              This appears to be an internal transfer between bank accounts. No external match needed.
            </p>
          </CardContent>
        </Card>
      )}

      {matchData && !matchData.isTransfer && availableCandidates.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Source Match</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No matching bank/Ramp transaction found. This may be a manual entry, journal adjustment, or a cash-basis gap that accrual conversion addresses.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Accrual Treatment (conditional) */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Accrual Treatment</CardTitle>
            <div className="flex items-center gap-2">
              <Switch
                checked={accrualEnabled}
                onCheckedChange={setAccrualEnabled}
                disabled={item.status !== 'pending'}
              />
              <Label className="text-sm">Has accrual component</Label>
            </div>
          </div>
        </CardHeader>
        {accrualEnabled && (
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Effective Start Date</Label>
                <Input
                  type="date"
                  value={accrualStartDate}
                  onChange={(e) => setAccrualStartDate(e.target.value)}
                  disabled={item.status !== 'pending'}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>Effective End Date</Label>
                <Input
                  type="date"
                  value={accrualEndDate}
                  onChange={(e) => setAccrualEndDate(e.target.value)}
                  disabled={item.status !== 'pending'}
                  className="mt-1"
                />
              </div>
            </div>
            {monthsCount > 0 && (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>
                  Amortized evenly over <strong>{monthsCount} months</strong> ($
                  {monthlyAmount.toFixed(2)}/month, straight-line)
                </p>
                <p className="text-muted-foreground">
                  Reclassification: Moves ${totalAmount.toFixed(2)} to Prepaid Expenses (1200),
                  then amortizes ${monthlyAmount.toFixed(2)}/month starting {accrualStartDate}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Section 5: Action Buttons */}
      {item.status === 'pending' && (
        <div className="flex gap-3 justify-end">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isPending}
          >
            Skip
          </Button>
          <Button onClick={handleApprove} disabled={isPending}>
            {isPending ? 'Saving...' : 'Approve'}
          </Button>
        </div>
      )}

      {item.status !== 'pending' && (
        <div className="flex justify-end">
          <p className="text-sm text-muted-foreground">
            This transaction has been {item.status}. Use the Reset button on the summary page to make changes.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Approved</Badge>
    case 'skipped':
      return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">Skipped</Badge>
    case 'pending':
    default:
      return <Badge variant="secondary">Pending</Badge>
  }
}

function MatchConfidenceBadge({ type, days }: { type: string; days: number }) {
  switch (type) {
    case 'exact':
      return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Exact</Badge>
    case 'fuzzy-1d':
      return <Badge variant="outline" className="border-blue-500 text-blue-700 dark:text-blue-400">&plusmn;1 day</Badge>
    case 'fuzzy-3d':
      return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">&plusmn;3 days</Badge>
    case 'amount-only':
      return <Badge variant="destructive">{days}d apart</Badge>
    default:
      return null
  }
}
