'use client'

import { useState, useCallback, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportTable } from '@/components/reports/report-table'
import { getAHPAnnualPackageData } from '@/lib/reports/ahp-annual-package'
import type { AHPAnnualPackageData } from '@/lib/reports/ahp-annual-package'
import { formatCurrency, formatDate } from '@/lib/reports/types'

interface AHPAnnualPackageClientProps {
  initialData: AHPAnnualPackageData
}

export function AHPAnnualPackageClient({ initialData }: AHPAnnualPackageClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [year, setYear] = useState(String(data.fiscalYear))

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getAHPAnnualPackageData({ fiscalYear: Number(year) })
      setData(result)
    })
  }, [year])

  const bs = data.balanceSheet
  const loan = data.loanSummary

  return (
    <ReportShell
      title="Annual Financial Package for AHP"
      generatedAt={data.generatedAt}
      reportSlug="ahp-annual-package"
    >
      <div className="flex items-end gap-3" data-testid="ahp-annual-package-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Fiscal Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 h-8 text-sm" />
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="ahp-annual-package-apply-btn">
          {isPending ? 'Loading...' : 'Generate'}
        </Button>
      </div>

      <Tabs defaultValue="balance-sheet" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="activities">Activities</TabsTrigger>
          <TabsTrigger value="cash-flows">Cash Flows</TabsTrigger>
          <TabsTrigger value="loan-summary">Loan Summary</TabsTrigger>
        </TabsList>

        <TabsContent value="balance-sheet" className="space-y-4">
          <h3 className="text-lg font-semibold">Statement of Financial Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Assets</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(bs.totalAssets)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Liabilities</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(bs.totalLiabilities)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Net Assets</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(bs.totalNetAssets)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Check</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(bs.totalLiabilitiesAndNetAssets)}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="activities" className="space-y-4">
          <h3 className="text-lg font-semibold">Statement of Activities</h3>
          <div className="grid grid-cols-3 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Revenue</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(data.activities.totalRevenue.yearToDate)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total Expenses</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-red-600">{formatCurrency(data.activities.totalExpenses.yearToDate)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Change in Net Assets</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(data.activities.changeInNetAssets.yearToDate)}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="cash-flows" className="space-y-4">
          <h3 className="text-lg font-semibold">Statement of Cash Flows</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Operating</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(data.cashFlows.operating.subtotal)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Investing</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(data.cashFlows.investing.subtotal)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Financing</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(data.cashFlows.financing.subtotal)}</div></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ending Cash</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(data.cashFlows.endingCash)}</div></CardContent></Card>
          </div>
        </TabsContent>

        <TabsContent value="loan-summary" className="space-y-4">
          <h3 className="text-lg font-semibold">AHP Loan Summary</h3>
          {loan.summary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Credit Limit</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(loan.summary.creditLimit)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Drawn</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(loan.summary.currentDrawnAmount)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Available</CardTitle></CardHeader><CardContent><div className="text-xl font-bold text-green-600">{formatCurrency(loan.summary.availableCredit)}</div></CardContent></Card>
              <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Interest Accrued</CardTitle></CardHeader><CardContent><div className="text-xl font-bold">{formatCurrency(loan.totalInterestAccrued)}</div></CardContent></Card>
            </div>
          ) : (
            <p className="text-muted-foreground">No AHP loan data available.</p>
          )}
        </TabsContent>
      </Tabs>
    </ReportShell>
  )
}
