'use client'

import { Badge } from '@/components/ui/badge'

type BadgeType = 'tier' | 'confidence'

type TierValue = 'auto' | 'review' | 'exception'
type ConfidenceValue = 'high' | 'medium' | 'low'

const tierColors: Record<TierValue, string> = {
  auto: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  review: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  exception: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

const confidenceColors: Record<ConfidenceValue, string> = {
  high: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400',
  medium: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  low: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

interface StatusBadgeProps {
  type: BadgeType
  value: TierValue | ConfidenceValue
  label?: string
}

export function StatusBadge({ type, value, label }: StatusBadgeProps) {
  const colors = type === 'tier'
    ? tierColors[value as TierValue]
    : confidenceColors[value as ConfidenceValue]

  return (
    <Badge variant="outline" className={`text-xs ${colors}`}>
      {label ?? value}
    </Badge>
  )
}
