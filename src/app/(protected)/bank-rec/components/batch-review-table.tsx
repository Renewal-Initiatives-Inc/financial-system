'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BatchReviewRow } from '@/components/smart-dashboard/batch-review-row'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { bulkApproveMatches } from '../actions'
import { toast } from 'sonner'
import type { BatchReviewItem } from '@/lib/bank-rec/matcher'

interface BatchReviewTableProps {
  items: BatchReviewItem[]
  sessionId: number | null
  onRefresh: () => void
}

export function BatchReviewTable({
  items,
  sessionId,
  onRefresh,
}: BatchReviewTableProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [rejectedIds, setRejectedIds] = useState<Set<number>>(new Set())

  const visibleItems = items.filter(
    (item) => !rejectedIds.has(item.bankTransaction.id)
  )

  const handleApproveAll = () => {
    if (visibleItems.length === 0) return
    startTransition(async () => {
      try {
        const result = await bulkApproveMatches(
          visibleItems.map((item) => ({
            bankTransactionId: item.bankTransaction.id,
            glTransactionLineId: item.candidate.glTransactionLineId,
            ruleId: item.ruleId,
          })),
          sessionId,
          'system'
        )
        toast.success(
          `${result.approved} matches approved${result.failed > 0 ? `, ${result.failed} failed` : ''}`
        )
        onRefresh()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Bulk approve failed')
      }
    })
  }

  const handleApproveSingle = (item: BatchReviewItem) => {
    startTransition(async () => {
      try {
        const result = await bulkApproveMatches(
          [
            {
              bankTransactionId: item.bankTransaction.id,
              glTransactionLineId: item.candidate.glTransactionLineId,
              ruleId: item.ruleId,
            },
          ],
          sessionId,
          'system'
        )
        if (result.approved > 0) {
          toast.success('Match approved')
        } else {
          toast.error('Failed to approve match')
        }
        onRefresh()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Approve failed')
      }
    })
  }

  const handleReject = (bankTxnId: number) => {
    setRejectedIds((prev) => new Set([...prev, bankTxnId]))
    toast.info('Moved to exceptions')
  }

  if (items.length === 0) {
    return (
      <Card data-testid="bank-rec-batch-review">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pending Review (0)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground py-4 text-center">
            No AI-suggested matches pending review.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="bank-rec-batch-review">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Pending Review ({visibleItems.length})
          </CardTitle>
          {visibleItems.length > 0 && (
            <Button
              size="sm"
              onClick={handleApproveAll}
              disabled={isPending}
              data-testid="bank-rec-approve-all-btn"
            >
              <CheckCircle2 className="mr-1 h-3 w-3" />
              Approve All
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[400px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Suggested Match</TableHead>
                <TableHead>Confidence</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleItems.map((item) => (
                <BatchReviewRow
                  key={item.bankTransaction.id}
                  id={item.bankTransaction.id}
                  date={item.bankTransaction.date}
                  description={item.bankTransaction.merchantName ?? 'Unknown'}
                  amount={item.bankTransaction.amount}
                  suggestedMatch={`${item.candidate.accountName} — ${item.candidate.memo ?? 'No memo'}`}
                  confidenceScore={item.candidate.confidenceScore}
                  reason={item.reason}
                  onApprove={() => handleApproveSingle(item)}
                  onReject={() => handleReject(item.bankTransaction.id)}
                  disabled={isPending}
                  testIdPrefix="bank-rec"
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
