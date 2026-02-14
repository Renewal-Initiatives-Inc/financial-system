'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Save, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { generateProjectionAction, saveProjectionOverridesAction } from './actions'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

interface ProjectionLine {
  id: number
  month: number
  sourceLabel: string
  autoAmount: string
  overrideAmount: string | null
  overrideNote: string | null
  lineType: string
  sortOrder: number
}

interface Projection {
  id: number
  fiscalYear: number
  asOfDate: string
  createdBy: string
  lines: ProjectionLine[]
}

interface CashProjectionClientProps {
  initialProjection: Projection | null
  fiscalYear: number
}

export function CashProjectionClient({
  initialProjection,
  fiscalYear,
}: CashProjectionClientProps) {
  const router = useRouter()
  const [projection, setProjection] = useState(initialProjection)
  const [overrides, setOverrides] = useState<
    Map<number, { amount: number | null; note: string | null }>
  >(new Map())
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const result = await generateProjectionAction(fiscalYear, 'system')
    if ('error' in result) {
      toast.error(result.error)
      setGenerating(false)
      return
    }
    toast.success('Projection generated')
    router.refresh()
    setGenerating(false)
  }

  const handleSave = async () => {
    if (!projection) return
    setSaving(true)

    const overrideEntries = Array.from(overrides.entries()).map(([lineId, data]) => ({
      lineId,
      overrideAmount: data.amount,
      overrideNote: data.note,
    }))

    const result = await saveProjectionOverridesAction(projection.id, overrideEntries)
    if ('error' in result) {
      toast.error(result.error)
      setSaving(false)
      return
    }
    toast.success('Overrides saved')
    router.refresh()
    setSaving(false)
  }

  const setOverride = (lineId: number, field: 'amount' | 'note', value: string) => {
    setOverrides((prev) => {
      const updated = new Map(prev)
      const existing = updated.get(lineId) ?? { amount: null, note: null }
      if (field === 'amount') {
        existing.amount = value === '' ? null : parseFloat(value)
      } else {
        existing.note = value === '' ? null : value
      }
      updated.set(lineId, existing)
      return updated
    })
  }

  if (!projection) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/budgets')} data-testid="cash-projection-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cash Projection — FY {fiscalYear}
          </h1>
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            No cash projection exists yet. Generate one based on your budget data.
          </p>
          <Button onClick={handleGenerate} disabled={generating} data-testid="generate-btn">
            <RefreshCw className="mr-2 h-4 w-4" />
            {generating ? 'Generating...' : 'Generate 3-Month Projection'}
          </Button>
        </div>
      </div>
    )
  }

  // Group lines by month
  const months = [...new Set(projection.lines.map((l) => l.month))].sort((a, b) => a - b)

  const getLines = (month: number, type: string) =>
    projection.lines
      .filter((l) => l.month === month && l.lineType === type)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const getEffectiveAmount = (line: ProjectionLine) => {
    const override = overrides.get(line.id)
    if (override?.amount != null) return override.amount
    if (line.overrideAmount != null) return Number(line.overrideAmount)
    return Number(line.autoAmount)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/budgets')} data-testid="cash-projection-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cash Projection — FY {fiscalYear}
            </h1>
            <p className="text-sm text-muted-foreground">
              As of {projection.asOfDate}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleGenerate} disabled={generating} data-testid="cash-projection-regenerate-btn">
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <Button onClick={handleSave} disabled={saving || overrides.size === 0} data-testid="cash-projection-save-btn">
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Overrides'}
          </Button>
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Source</TableHead>
              {months.map((m) => (
                <TableHead key={m} className="text-center min-w-[160px]">
                  {MONTH_LABELS[m - 1]}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {/* Inflows */}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={months.length + 1} className="font-semibold text-green-700">
                Inflows
              </TableCell>
            </TableRow>
            {months.length > 0 &&
              getLines(months[0], 'INFLOW').map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm">{line.sourceLabel}</TableCell>
                  {months.map((m) => {
                    const monthLine = projection.lines.find(
                      (l) =>
                        l.month === m &&
                        l.sourceLabel === line.sourceLabel &&
                        l.lineType === 'INFLOW'
                    )
                    if (!monthLine) return <TableCell key={m} />
                    return (
                      <TableCell key={m} className="text-center">
                        <div className="text-xs text-muted-foreground italic">
                          {formatCurrency(Number(monthLine.autoAmount))}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Override..."
                          value={
                            overrides.get(monthLine.id)?.amount ??
                            (monthLine.overrideAmount ? Number(monthLine.overrideAmount) : '')
                          }
                          onChange={(e) =>
                            setOverride(monthLine.id, 'amount', e.target.value)
                          }
                          className="h-7 text-xs text-center mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}

            {/* Inflow subtotal */}
            <TableRow className="border-t font-semibold">
              <TableCell>Total Inflows</TableCell>
              {months.map((m) => {
                const total = getLines(m, 'INFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                return (
                  <TableCell key={m} className="text-center font-mono text-green-700">
                    {formatCurrency(total)}
                  </TableCell>
                )
              })}
            </TableRow>

            {/* Outflows */}
            <TableRow className="bg-muted/50">
              <TableCell colSpan={months.length + 1} className="font-semibold text-red-700">
                Outflows
              </TableCell>
            </TableRow>
            {months.length > 0 &&
              getLines(months[0], 'OUTFLOW').map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm">{line.sourceLabel}</TableCell>
                  {months.map((m) => {
                    const monthLine = projection.lines.find(
                      (l) =>
                        l.month === m &&
                        l.sourceLabel === line.sourceLabel &&
                        l.lineType === 'OUTFLOW'
                    )
                    if (!monthLine) return <TableCell key={m} />
                    return (
                      <TableCell key={m} className="text-center">
                        <div className="text-xs text-muted-foreground italic">
                          {formatCurrency(Number(monthLine.autoAmount))}
                        </div>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Override..."
                          value={
                            overrides.get(monthLine.id)?.amount ??
                            (monthLine.overrideAmount ? Number(monthLine.overrideAmount) : '')
                          }
                          onChange={(e) =>
                            setOverride(monthLine.id, 'amount', e.target.value)
                          }
                          className="h-7 text-xs text-center mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}

            {/* Outflow subtotal */}
            <TableRow className="border-t font-semibold">
              <TableCell>Total Outflows</TableCell>
              {months.map((m) => {
                const total = getLines(m, 'OUTFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                return (
                  <TableCell key={m} className="text-center font-mono text-red-700">
                    {formatCurrency(total)}
                  </TableCell>
                )
              })}
            </TableRow>

            {/* Net Cash */}
            <TableRow className="border-t-2 bg-muted font-bold">
              <TableCell>Net Cash Flow</TableCell>
              {months.map((m) => {
                const inflows = getLines(m, 'INFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                const outflows = getLines(m, 'OUTFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                const net = inflows - outflows
                return (
                  <TableCell
                    key={m}
                    className={`text-center font-mono ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}
                  >
                    {formatCurrency(net)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>

      {/* Override Notes */}
      {overrides.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Override Notes</h3>
          {Array.from(overrides.entries())
            .filter(([, data]) => data.amount != null)
            .map(([lineId]) => {
              const line = projection.lines.find((l) => l.id === lineId)
              if (!line) return null
              return (
                <div key={lineId} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground min-w-[150px]">
                    {line.sourceLabel} ({MONTH_LABELS[line.month - 1]}):
                  </span>
                  <Textarea
                    placeholder="Explain the override reason..."
                    value={overrides.get(lineId)?.note ?? ''}
                    onChange={(e) => setOverride(lineId, 'note', e.target.value)}
                    className="h-16 text-sm"
                    data-testid={`override-note-${lineId}`}
                  />
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}
