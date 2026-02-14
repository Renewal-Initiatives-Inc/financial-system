'use client'

import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

interface VarianceIndicatorProps {
  dollarVariance: number
  percentVariance: number | null
  severity: 'normal' | 'warning' | 'critical'
  isDollarShown?: boolean
  testId?: string
}

const severityStyles = {
  normal: 'bg-green-100 text-green-800 border-green-200',
  warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  critical: 'bg-red-100 text-red-800 border-red-200',
}

const severityLabels = {
  normal: 'On Track',
  warning: 'Over 10%',
  critical: 'Over 25%',
}

export function VarianceIndicator({
  dollarVariance,
  percentVariance,
  severity,
  isDollarShown = true,
  testId = 'variance-indicator',
}: VarianceIndicatorProps) {
  const formattedDollar = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    signDisplay: 'always',
  }).format(dollarVariance)

  const formattedPercent =
    percentVariance !== null ? `${percentVariance >= 0 ? '+' : ''}${percentVariance.toFixed(1)}%` : 'N/A'

  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      {isDollarShown && (
        <span
          className={cn(
            'text-sm font-mono',
            severity === 'critical' && 'text-red-700 font-semibold',
            severity === 'warning' && 'text-yellow-700',
            severity === 'normal' && 'text-green-700'
          )}
        >
          {formattedDollar}
        </span>
      )}
      <Badge variant="outline" className={cn('text-xs', severityStyles[severity])}>
        {formattedPercent}
      </Badge>
    </div>
  )
}
