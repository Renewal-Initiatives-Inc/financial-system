'use client'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { MatchCandidate } from '@/lib/bank-rec/matcher'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

interface MatchSuggestionPanelProps {
  candidates: MatchCandidate[]
  onSubmit: (candidate: MatchCandidate) => void
  isLoading: boolean
}

export function MatchSuggestionPanel({
  candidates,
  onSubmit,
  isLoading,
}: MatchSuggestionPanelProps) {
  if (isLoading) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        Finding match suggestions...
      </p>
    )
  }

  if (candidates.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No match suggestions found. You can create an inline GL entry or split
        this transaction.
      </p>
    )
  }

  return (
    <div data-testid="match-suggestions">
      <p className="text-sm font-medium mb-2">
        Suggested Matches ({candidates.length})
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Memo</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Confidence</TableHead>
            <TableHead className="w-[100px]">Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {candidates.map((candidate) => (
            <TableRow key={candidate.glTransactionLineId}>
              <TableCell>{candidate.date}</TableCell>
              <TableCell className="truncate max-w-[200px]">
                {candidate.memo}
              </TableCell>
              <TableCell className="font-mono">
                {formatCurrency(candidate.amount)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={
                    candidate.confidenceScore >= 1.1
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }
                >
                  {(candidate.confidenceScore * 100).toFixed(0)}%
                </Badge>
              </TableCell>
              <TableCell>
                <Button
                  size="sm"
                  onClick={() => onSubmit(candidate)}
                  data-testid={`confirm-match-${candidate.glTransactionLineId}`}
                >
                  Match
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
