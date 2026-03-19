'use client'

import type { LucideIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'

type SummaryCardVariant = 'success' | 'warning' | 'error' | 'info'

const variantColors: Record<SummaryCardVariant, string> = {
  success: 'text-green-600 dark:text-green-400',
  warning: 'text-yellow-600 dark:text-yellow-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
}

interface SummaryCardProps {
  icon: LucideIcon
  label: string
  count: number | string
  variant?: SummaryCardVariant
  testId?: string
}

export function SummaryCard({
  icon: Icon,
  label,
  count,
  variant = 'info',
  testId,
}: SummaryCardProps) {
  return (
    <Card data-testid={testId}>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${variantColors[variant]}`} />
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-semibold mt-1">{count}</p>
      </CardContent>
    </Card>
  )
}
