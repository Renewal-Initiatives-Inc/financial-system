'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import { formatCurrency } from '@/lib/reports/types'
import type {
  CashPositionData,
  CashPositionSection,
} from '@/lib/reports/cash-position'

interface CashPositionClientProps {
  data: CashPositionData
}

function SectionCard({ section }: { section: CashPositionSection }) {
  return (
    <Card data-testid={`section-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">{section.title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {section.accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No accounts found.</p>
        ) : (
          <div className="space-y-1">
            {section.accounts.map((acct) => (
              <div
                key={acct.accountId}
                className="flex items-center justify-between text-sm"
                data-testid={`account-row-${acct.accountCode}`}
              >
                <span className="text-muted-foreground">
                  <span className="font-mono mr-2">{acct.accountCode}</span>
                  {acct.accountName}
                </span>
                <span className="font-medium tabular-nums">
                  {formatCurrency(acct.balance)}
                </span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-2 mt-2">
          <span className="text-sm font-semibold">Total</span>
          <span className="text-lg font-bold tabular-nums" data-testid={`total-${section.title.toLowerCase().replace(/\s+/g, '-')}`}>
            {formatCurrency(section.total)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

function NetAvailableCard({
  netAvailable,
  coverageRatio,
}: {
  netAvailable: number
  coverageRatio: number | null
}) {
  const colorClass =
    netAvailable < 0
      ? 'text-destructive'
      : coverageRatio !== null && coverageRatio < 1
        ? 'text-yellow-600 dark:text-yellow-400'
        : 'text-green-600 dark:text-green-400'

  const bgClass =
    netAvailable < 0
      ? 'border-destructive/30 bg-destructive/5'
      : coverageRatio !== null && coverageRatio < 1
        ? 'border-yellow-500/30 bg-yellow-50 dark:bg-yellow-950/20'
        : 'border-green-500/30 bg-green-50 dark:bg-green-950/20'

  return (
    <Card className={bgClass} data-testid="net-available-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold">Net Available Cash</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className={`text-3xl font-bold tabular-nums ${colorClass}`} data-testid="net-available-amount">
          {formatCurrency(netAvailable)}
        </div>
        <p className="text-xs text-muted-foreground">
          Cash - Payables + Receivables
        </p>
        {coverageRatio !== null && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Coverage Ratio:</span>
            <span className={`font-semibold ${colorClass}`} data-testid="coverage-ratio">
              {coverageRatio.toFixed(2)}x
            </span>
          </div>
        )}
        {coverageRatio === null && (
          <div className="text-sm text-muted-foreground" data-testid="coverage-ratio">
            Coverage Ratio: N/A (no payables)
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function CashPositionClient({ data }: CashPositionClientProps) {
  return (
    <ReportShell
      title="Cash Position Summary"
      reportSlug="cash-position"
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4" data-testid="cash-position-grid">
        {/* Cash & Cash Equivalents */}
        <SectionCard section={data.cashSection} />

        {/* Outstanding Payables */}
        <SectionCard section={data.payablesSection} />

        {/* Outstanding Receivables */}
        <SectionCard section={data.receivablesSection} />

        {/* Net Available Cash */}
        <NetAvailableCard
          netAvailable={data.netAvailableCash}
          coverageRatio={data.coverageRatio}
        />
      </div>
    </ReportShell>
  )
}
