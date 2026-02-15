'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { Filing990Determination } from '@/lib/compliance/filing-progression'

interface ChecklistItem {
  label: string
  status: string
  detail: string
}

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

const formTypeColors: Record<string, string> = {
  '990-N': 'bg-green-100 text-green-800',
  '990-EZ': 'bg-yellow-100 text-yellow-800',
  'Full 990': 'bg-red-100 text-red-800',
}

const statusIcons: Record<string, string> = {
  complete: 'text-green-600',
  incomplete: 'text-red-600',
  'not-applicable': 'text-gray-400',
}

export function ReadinessClient({
  determination,
  checklist,
  fiscalYear,
}: {
  determination: Filing990Determination
  checklist: ChecklistItem[]
  fiscalYear: number
}) {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">
        990 Filing Readiness — FY{fiscalYear}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            Filing Type Determination
            <Badge className={formTypeColors[determination.formType] ?? ''}>
              {determination.formType}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Current Year Gross Receipts</p>
              <p className="text-lg font-semibold tabular-nums">
                {fmt(determination.grossReceipts)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Avg Gross Receipts ({determination.yearsOfOperation <= 3 ? 'all years' : '3-yr rolling'})
              </p>
              <p className="text-lg font-semibold tabular-nums">
                {fmt(determination.grossReceiptsAverage)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total Assets (end of year)</p>
              <p className="text-lg font-semibold tabular-nums">
                {fmt(determination.totalAssets)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Years of Operation</p>
              <p className="text-lg font-semibold">{determination.yearsOfOperation}</p>
            </div>
          </div>

          <div className="border-t pt-3 space-y-2">
            <p className="text-sm font-medium">Threshold Tests</p>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <span className={determination.thresholdDetails.grossReceiptsExceeded ? 'text-red-600' : 'text-green-600'}>
                  {determination.thresholdDetails.grossReceiptsExceeded ? '!!' : 'OK'}
                </span>
                <span>
                  Gross receipts {determination.thresholdDetails.grossReceiptsExceeded ? '>=' : '<'}{' '}
                  {fmt(determination.thresholdDetails.grossReceiptsThreshold)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className={determination.thresholdDetails.assetsExceeded ? 'text-red-600' : 'text-green-600'}>
                  {determination.thresholdDetails.assetsExceeded ? '!!' : 'OK'}
                </span>
                <span>
                  Total assets {determination.thresholdDetails.assetsExceeded ? '>=' : '<'}{' '}
                  {fmt(determination.thresholdDetails.assetsThreshold)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Readiness Checklist</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {checklist.map((item) => (
            <div key={item.label} className="flex items-start gap-3 py-1">
              <span className={`text-lg leading-none ${statusIcons[item.status] ?? ''}`}>
                {item.status === 'complete' ? '\u2713' : item.status === 'incomplete' ? '\u2717' : '\u2014'}
              </span>
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link
          href="/compliance/functional-allocation"
          className="text-sm text-primary hover:underline"
          data-testid="990-readiness-allocation-link"
        >
          Open Functional Allocation Wizard &rarr;
        </Link>
        <Link
          href="/reports/form-990-data"
          className="text-sm text-primary hover:underline"
          data-testid="990-readiness-form990-link"
        >
          View Form 990 Data Report &rarr;
        </Link>
      </div>
    </div>
  )
}
