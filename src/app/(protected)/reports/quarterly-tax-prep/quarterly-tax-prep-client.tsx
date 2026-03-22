'use client'

import { useState, useTransition } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportShell } from '@/components/reports/report-shell'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import {
  type QuarterlyTaxPrepData,
  type Federal941Data,
  type MaM941Data,
} from '@/lib/reports/quarterly-tax-prep'
import { getQuarterlyTaxPrepData } from '../actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface QuarterlyTaxPrepClientProps {
  initialData: QuarterlyTaxPrepData
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const QUARTERLY_TAX_PREP_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'form', label: 'Form', format: 'text' },
  { key: 'line', label: 'Line', format: 'text' },
  { key: 'description', label: 'Description', format: 'text' },
  { key: 'amount', label: 'Amount', format: 'currency' },
]

function buildExportData(data: QuarterlyTaxPrepData): Record<string, unknown>[] {
  const f = data.federal941
  const m = data.maM941
  return [
    { form: 'Federal 941', line: '1', description: 'Number of employees who received wages', amount: f.line1_employeeCount },
    { form: 'Federal 941', line: '2', description: 'Wages, tips, and other compensation', amount: f.line2_totalWages },
    { form: 'Federal 941', line: '3', description: 'Federal income tax withheld', amount: f.line3_federalTaxWithheld },
    { form: 'Federal 941', line: '5a', description: 'Taxable social security wages (x 0.124)', amount: f.line5a_ssWages },
    { form: 'Federal 941', line: '5a Tax', description: 'Social security tax', amount: f.line5a_ssTax },
    { form: 'Federal 941', line: '5c', description: 'Taxable Medicare wages (x 0.029)', amount: f.line5c_medicareWages },
    { form: 'Federal 941', line: '5c Tax', description: 'Medicare tax', amount: f.line5c_medicareTax },
    { form: 'Federal 941', line: '6', description: 'Total taxes before adjustments', amount: f.line6_totalTaxBeforeAdjustments },
    { form: 'Federal 941', line: '10', description: 'Total taxes after adjustments', amount: f.line10_totalTaxAfterAdjustments },
    { form: 'MA M-941', line: '1', description: 'Total wages subject to MA withholding', amount: m.totalWagesSubjectToMA },
    { form: 'MA M-941', line: '2', description: 'Massachusetts income tax withheld', amount: m.maIncomeTaxWithheld },
  ]
}

// ---------------------------------------------------------------------------
// Quarter selector helpers
// ---------------------------------------------------------------------------

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan-Mar)',
  2: 'Q2 (Apr-Jun)',
  3: 'Q3 (Jul-Sep)',
  4: 'Q4 (Oct-Dec)',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function QuarterlyTaxPrepClient({
  initialData,
}: QuarterlyTaxPrepClientProps) {
  const [data, setData] = useState<QuarterlyTaxPrepData>(initialData)
  const [year, setYear] = useState(initialData.year)
  const [quarter, setQuarter] = useState(initialData.quarter)
  const [isPending, startTransition] = useTransition()

  const currentYear = new Date().getFullYear()

  function handleApply() {
    startTransition(async () => {
      const result = await getQuarterlyTaxPrepData({ year, quarter })
      setData(result)
    })
  }

  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Quarterly 941 / M-941 Prep"
      generatedAt={data.generatedAt}
      reportSlug="quarterly-tax-prep"
      exportData={exportData}
      csvColumns={QUARTERLY_TAX_PREP_CSV_COLUMNS}
      filters={{ year: String(year), quarter: String(quarter) }}
    >
      {/* Year + Quarter Selector */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="quarterly-tax-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-28" data-testid="quarterly-tax-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Quarter</Label>
          <Select
            value={String(quarter)}
            onValueChange={(v) => setQuarter(Number(v))}
          >
            <SelectTrigger className="w-40" data-testid="quarterly-tax-quarter-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((q) => (
                <SelectItem key={q} value={String(q)}>
                  {QUARTER_LABELS[q]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} disabled={isPending} data-testid="quarterly-tax-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Period Info */}
      <div className="text-sm text-muted-foreground">
        {data.quarterLabel} {data.year} &mdash;{' '}
        {formatDate(data.periodStart)} to {formatDate(data.periodEnd)}
        {isPending && ' (loading...)'}
      </div>

      {/* Two-Panel Layout: Federal 941 + MA M-941 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Federal Form 941 */}
        <Federal941Panel data={data.federal941} />

        {/* Massachusetts M-941 */}
        <MaM941Panel data={data.maM941} />
      </div>
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// Federal 941 Panel
// ---------------------------------------------------------------------------

interface FormLineProps {
  line: string
  description: string
  amount: number | string
  isCurrency?: boolean
  isTotal?: boolean
  indent?: boolean
}

function FormLine({
  line,
  description,
  amount,
  isCurrency = true,
  isTotal = false,
  indent = false,
}: FormLineProps) {
  return (
    <div
      className={`flex items-center gap-3 py-2 px-3 border-b last:border-b-0 ${
        isTotal
          ? 'bg-muted/30 font-semibold border-t-2 border-t-foreground/20'
          : ''
      }`}
    >
      <div className="w-12 shrink-0 text-sm font-mono text-muted-foreground font-medium">
        {line}
      </div>
      <div className={`flex-1 text-sm ${indent ? 'pl-4' : ''}`}>
        {description}
      </div>
      <div className="text-right font-mono text-sm min-w-[120px]">
        {isCurrency
          ? formatCurrency(typeof amount === 'string' ? parseFloat(amount) : amount)
          : amount}
      </div>
    </div>
  )
}

function Federal941Panel({ data }: { data: Federal941Data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Federal Form 941
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Employer&apos;s Quarterly Federal Tax Return
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <FormLine
            line="1"
            description="Number of employees who received wages, tips, or other compensation"
            amount={data.line1_employeeCount}
            isCurrency={false}
          />
          <FormLine
            line="2"
            description="Wages, tips, and other compensation"
            amount={data.line2_totalWages}
          />
          <FormLine
            line="3"
            description="Federal income tax withheld from wages, tips, and other compensation"
            amount={data.line3_federalTaxWithheld}
          />
          <FormLine
            line="5a"
            description="Taxable social security wages"
            amount={data.line5a_ssWages}
          />
          <FormLine
            line="5a tax"
            description="Social security tax (wages x 0.124)"
            amount={data.line5a_ssTax}
            indent
          />
          <FormLine
            line="5c"
            description="Taxable Medicare wages & tips"
            amount={data.line5c_medicareWages}
          />
          <FormLine
            line="5c tax"
            description="Medicare tax (wages x 0.029)"
            amount={data.line5c_medicareTax}
            indent
          />
          <FormLine
            line="6"
            description="Total taxes before adjustments (lines 3 + 5a tax + 5c tax)"
            amount={data.line6_totalTaxBeforeAdjustments}
            isTotal
          />
          <FormLine
            line="7-9"
            description="Adjustments (current quarter, sick pay, tips/life insurance)"
            amount={0}
          />
          <FormLine
            line="10"
            description="Total taxes after adjustments"
            amount={data.line10_totalTaxAfterAdjustments}
            isTotal
          />
        </div>
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// MA M-941 Panel
// ---------------------------------------------------------------------------

function MaM941Panel({ data }: { data: MaM941Data }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Massachusetts Form M-941
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Employer&apos;s Return of Income Taxes Withheld
        </p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          <FormLine
            line="1"
            description="Total wages paid subject to Massachusetts withholding"
            amount={data.totalWagesSubjectToMA}
          />
          <FormLine
            line="2"
            description="Massachusetts income tax withheld"
            amount={data.maIncomeTaxWithheld}
            isTotal
          />
        </div>

        {/* Additional guidance */}
        <div className="p-4 border-t bg-muted/20">
          <p className="text-xs text-muted-foreground">
            File Form M-941 quarterly with the Massachusetts Department of Revenue.
            Payment is due by the last day of the month following the end of the quarter.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
