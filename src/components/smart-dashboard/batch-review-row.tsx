'use client'

import { CheckCircle2, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatusBadge } from './status-badge'
import { TableCell, TableRow } from '@/components/ui/table'

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(num))
}

interface BatchReviewRowProps {
  id: number
  date: string
  description: string
  amount: string | number
  suggestedMatch: string
  confidenceScore: number
  reason: string
  onApprove: () => void
  onReject: () => void
  disabled?: boolean
  testIdPrefix?: string
}

export function BatchReviewRow({
  id,
  date,
  description,
  amount,
  suggestedMatch,
  confidenceScore,
  reason,
  onApprove,
  onReject,
  disabled = false,
  testIdPrefix = 'review',
}: BatchReviewRowProps) {
  return (
    <TableRow data-testid={`${testIdPrefix}-row-${id}`}>
      <TableCell className="text-sm">{date}</TableCell>
      <TableCell className="text-sm truncate max-w-[150px]">{description}</TableCell>
      <TableCell className="text-sm font-mono">{formatCurrency(amount)}</TableCell>
      <TableCell className="text-sm truncate max-w-[150px]">{suggestedMatch}</TableCell>
      <TableCell>
        <StatusBadge
          type="confidence"
          value={confidenceScore >= 0.9 ? 'high' : confidenceScore >= 0.7 ? 'medium' : 'low'}
          label={`${Math.round(confidenceScore * 100)}%`}
        />
      </TableCell>
      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
        {reason}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex gap-1 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onApprove}
            disabled={disabled}
            data-testid={`${testIdPrefix}-approve-btn-${id}`}
          >
            <CheckCircle2 className="h-3 w-3" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={onReject}
            disabled={disabled}
            data-testid={`${testIdPrefix}-reject-btn-${id}`}
          >
            <XCircle className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  )
}
