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
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  generateProjectionAction,
  saveProjectionOverridesAction,
  generateWeeklyProjectionAction,
  saveWeeklyProjectionOverridesAction,
} from './actions'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

const CONFIDENCE_ICONS: Record<string, string> = {
  HIGH: '●',
  MODERATE: '◐',
  LOW: '◯',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'text-green-600',
  MODERATE: 'text-yellow-600',
  LOW: 'text-gray-400',
}

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

interface WeeklyLine {
  id: number
  weekNumber: number
  weekStartDate: string
  sourceLabel: string
  autoAmount: string
  overrideAmount: string | null
  overrideNote: string | null
  lineType: string
  confidenceLevel: string
  fundId: number | null
  sortOrder: number
}

interface WeeklyProjection {
  id: number
  fiscalYear: number
  asOfDate: string
  createdBy: string
  weeklyLines: WeeklyLine[]
}

interface CashProjectionClientProps {
  initialProjection: Projection | null
  initialWeeklyProjection: WeeklyProjection | null
  fiscalYear: number
}

export function CashProjectionClient({
  initialProjection,
  initialWeeklyProjection,
  fiscalYear,
}: CashProjectionClientProps) {
  const router = useRouter()
  const [mode, setMode] = useState<'monthly' | 'weekly'>(
    initialWeeklyProjection ? 'weekly' : 'monthly'
  )
  const [projection] = useState(initialProjection)
  const [weeklyProjection] = useState(initialWeeklyProjection)
  const [overrides, setOverrides] = useState<
    Map<number, { amount: number | null; note: string | null }>
  >(new Map())
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)

  const handleGenerate = async () => {
    setGenerating(true)
    const result = await generateProjectionAction(fiscalYear)
    if ('error' in result) {
      toast.error(result.error)
      setGenerating(false)
      return
    }
    toast.success('3-month projection generated')
    router.refresh()
    setGenerating(false)
  }

  const handleGenerateWeekly = async () => {
    setGenerating(true)
    const result = await generateWeeklyProjectionAction(fiscalYear)
    if ('error' in result) {
      toast.error(result.error)
      setGenerating(false)
      return
    }
    toast.success('13-week projection generated')
    setMode('weekly')
    router.refresh()
    setGenerating(false)
  }

  const handleSave = async () => {
    if (mode === 'monthly') {
      if (!projection) return
      setSaving(true)
      const overrideEntries = Array.from(overrides.entries()).map(
        ([lineId, data]) => ({
          lineId,
          overrideAmount: data.amount,
          overrideNote: data.note,
        })
      )
      const result = await saveProjectionOverridesAction(
        projection.id,
        overrideEntries
      )
      if ('error' in result) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success('Overrides saved')
      router.refresh()
      setSaving(false)
    } else {
      if (!weeklyProjection) return
      setSaving(true)
      const overrideEntries = Array.from(overrides.entries()).map(
        ([lineId, data]) => ({
          lineId,
          overrideAmount: data.amount,
          overrideNote: data.note,
        })
      )
      const result = await saveWeeklyProjectionOverridesAction(
        weeklyProjection.id,
        overrideEntries
      )
      if ('error' in result) {
        toast.error(result.error)
        setSaving(false)
        return
      }
      toast.success('Weekly overrides saved')
      router.refresh()
      setSaving(false)
    }
  }

  const setOverride = (
    lineId: number,
    field: 'amount' | 'note',
    value: string
  ) => {
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

  // Mode toggle
  const modeToggle = (
    <div className="flex gap-1 rounded-md border p-0.5" data-testid="cash-projection-mode-toggle">
      <Button
        variant={mode === 'monthly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => { setMode('monthly'); setOverrides(new Map()) }}
        data-testid="cash-projection-monthly-mode-btn"
      >
        3-Month
      </Button>
      <Button
        variant={mode === 'weekly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => { setMode('weekly'); setOverrides(new Map()) }}
        data-testid="cash-projection-weekly-mode-btn"
      >
        13-Week
      </Button>
    </div>
  )

  // --- EMPTY STATE ---
  if (
    (mode === 'monthly' && !projection) ||
    (mode === 'weekly' && !weeklyProjection)
  ) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/budgets')}
            data-testid="cash-projection-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Cash Projection — FY {fiscalYear}{' '}
            <HelpTooltip term="cash-projection" />
          </h1>
          {modeToggle}
        </div>
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            {mode === 'monthly'
              ? 'No 3-month projection exists yet. Generate one based on your budget data.'
              : 'No 13-week projection exists yet. Generate one from invoices, pledges, payroll, and budget data.'}
          </p>
          <div className="flex gap-3 justify-center">
            <Button
              onClick={handleGenerate}
              disabled={generating}
              variant={mode === 'monthly' ? 'default' : 'outline'}
              data-testid="cash-projection-generate-btn"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {generating && mode === 'monthly'
                ? 'Generating...'
                : 'Generate 3-Month Projection'}
            </Button>
            <Button
              onClick={handleGenerateWeekly}
              disabled={generating}
              variant={mode === 'weekly' ? 'default' : 'outline'}
              data-testid="cash-projection-generate-weekly-btn"
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              {generating && mode === 'weekly'
                ? 'Generating...'
                : 'Generate 13-Week Projection'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // --- WEEKLY EDITOR ---
  if (mode === 'weekly' && weeklyProjection) {
    return (
      <WeeklyEditor
        weeklyProjection={weeklyProjection}
        fiscalYear={fiscalYear}
        overrides={overrides}
        setOverride={setOverride}
        generating={generating}
        saving={saving}
        onGenerate={handleGenerateWeekly}
        onSave={handleSave}
        modeToggle={modeToggle}
      />
    )
  }

  // --- MONTHLY EDITOR (existing) ---
  if (!projection) return null

  // Group lines by month
  const months = [
    ...new Set(projection.lines.map((l) => l.month)),
  ].sort((a, b) => a - b)

  const getStartingCash = (month: number) => {
    const line = projection.lines.find(
      (l) => l.month === month && l.sourceLabel === 'Starting Cash'
    )
    return line ? Number(line.autoAmount) : 0
  }

  const getLines = (month: number, type: string) =>
    projection.lines
      .filter(
        (l) =>
          l.month === month &&
          l.lineType === type &&
          l.sourceLabel !== 'Starting Cash'
      )
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const getEffectiveAmount = (line: ProjectionLine) => {
    const override = overrides.get(line.id)
    if (override?.amount != null) return override.amount
    if (line.overrideAmount != null) return Number(line.overrideAmount)
    return Number(line.autoAmount)
  }

  const getNetCashFlow = (month: number) => {
    const inflowLines = getLines(month, 'INFLOW')
    const outflowLines = getLines(month, 'OUTFLOW')
    const inflows = inflowLines.reduce(
      (sum, l) => sum + getEffectiveAmount(l),
      0
    )
    const outflows = outflowLines.reduce(
      (sum, l) => sum + getEffectiveAmount(l),
      0
    )
    return inflows - outflows
  }

  const startingCash = months.length > 0 ? getStartingCash(months[0]) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/budgets')}
            data-testid="cash-projection-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Cash Projection — FY {fiscalYear}{' '}
              <HelpTooltip term="cash-projection" />
            </h1>
            <p className="text-sm text-muted-foreground">
              As of {projection.asOfDate}
            </p>
          </div>
          {modeToggle}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleGenerate}
            disabled={generating}
            data-testid="cash-projection-regenerate-btn"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || overrides.size === 0}
            data-testid="cash-projection-save-btn"
          >
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
            <TableRow
              className="bg-blue-50 font-semibold"
              data-testid="starting-cash-row"
            >
              <TableCell>Starting Cash</TableCell>
              {months.map((m, i) => {
                let cash: number
                if (i === 0) {
                  cash = startingCash
                } else {
                  cash = startingCash
                  for (let j = 0; j < i; j++) {
                    cash += getNetCashFlow(months[j])
                  }
                }
                return (
                  <TableCell key={m} className="text-center font-mono">
                    {formatCurrency(cash)}
                  </TableCell>
                )
              })}
            </TableRow>

            <TableRow className="bg-muted/50">
              <TableCell
                colSpan={months.length + 1}
                className="font-semibold text-green-700"
              >
                Inflows
              </TableCell>
            </TableRow>
            {months.length > 0 &&
              getLines(months[0], 'INFLOW').map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm">
                    {line.sourceLabel}
                  </TableCell>
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
                            (monthLine.overrideAmount
                              ? Number(monthLine.overrideAmount)
                              : '')
                          }
                          onChange={(e) =>
                            setOverride(
                              monthLine.id,
                              'amount',
                              e.target.value
                            )
                          }
                          className="h-7 text-xs text-center mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`cash-projection-inflow-override-${monthLine.id}`}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}

            <TableRow className="border-t font-semibold">
              <TableCell>Total Inflows</TableCell>
              {months.map((m) => {
                const total = getLines(m, 'INFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                return (
                  <TableCell
                    key={m}
                    className="text-center font-mono text-green-700"
                  >
                    {formatCurrency(total)}
                  </TableCell>
                )
              })}
            </TableRow>

            <TableRow className="bg-muted/50">
              <TableCell
                colSpan={months.length + 1}
                className="font-semibold text-red-700"
              >
                Outflows
              </TableCell>
            </TableRow>
            {months.length > 0 &&
              getLines(months[0], 'OUTFLOW').map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="text-sm">
                    {line.sourceLabel}
                  </TableCell>
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
                            (monthLine.overrideAmount
                              ? Number(monthLine.overrideAmount)
                              : '')
                          }
                          onChange={(e) =>
                            setOverride(
                              monthLine.id,
                              'amount',
                              e.target.value
                            )
                          }
                          className="h-7 text-xs text-center mt-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          data-testid={`cash-projection-outflow-override-${monthLine.id}`}
                        />
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))}

            <TableRow className="border-t font-semibold">
              <TableCell>Total Outflows</TableCell>
              {months.map((m) => {
                const total = getLines(m, 'OUTFLOW').reduce(
                  (sum, l) => sum + getEffectiveAmount(l),
                  0
                )
                return (
                  <TableCell
                    key={m}
                    className="text-center font-mono text-red-700"
                  >
                    {formatCurrency(total)}
                  </TableCell>
                )
              })}
            </TableRow>

            <TableRow className="border-t-2 bg-muted font-bold">
              <TableCell>Net Cash Flow</TableCell>
              {months.map((m) => {
                const net = getNetCashFlow(m)
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

            <TableRow
              className="bg-blue-50 font-semibold"
              data-testid="ending-cash-row"
            >
              <TableCell>Ending Cash</TableCell>
              {months.map((m, i) => {
                let endingCash = startingCash
                for (let j = 0; j <= i; j++) {
                  endingCash += getNetCashFlow(months[j])
                }
                return (
                  <TableCell
                    key={m}
                    className={`text-center font-mono ${endingCash >= 0 ? 'text-blue-700' : 'text-red-700'}`}
                  >
                    {formatCurrency(endingCash)}
                  </TableCell>
                )
              })}
            </TableRow>
          </TableBody>
        </Table>
      </div>

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
                    onChange={(e) =>
                      setOverride(lineId, 'note', e.target.value)
                    }
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

// ---------------------------------------------------------------------------
// Weekly Editor Sub-Component
// ---------------------------------------------------------------------------

function WeeklyEditor({
  weeklyProjection,
  fiscalYear,
  overrides,
  setOverride,
  generating,
  saving,
  onGenerate,
  onSave,
  modeToggle,
}: {
  weeklyProjection: WeeklyProjection
  fiscalYear: number
  overrides: Map<number, { amount: number | null; note: string | null }>
  setOverride: (lineId: number, field: 'amount' | 'note', value: string) => void
  generating: boolean
  saving: boolean
  onGenerate: () => void
  onSave: () => void
  modeToggle: React.ReactNode
}) {
  const router = useRouter()

  const weekNumbers = [
    ...new Set(weeklyProjection.weeklyLines.map((l) => l.weekNumber)),
  ].sort((a, b) => a - b)

  const getWeekLines = (weekNum: number, type: string) =>
    weeklyProjection.weeklyLines
      .filter((l) => l.weekNumber === weekNum && l.lineType === type)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const getEffective = (line: WeeklyLine) => {
    const override = overrides.get(line.id)
    if (override?.amount != null) return override.amount
    if (line.overrideAmount != null) return Number(line.overrideAmount)
    return Number(line.autoAmount)
  }

  const formatWeekLabel = (weekNum: number) => {
    const line = weeklyProjection.weeklyLines.find(
      (l) => l.weekNumber === weekNum
    )
    if (!line) return `Wk ${weekNum}`
    const d = new Date(line.weekStartDate + 'T00:00:00')
    const month = d.toLocaleDateString('en-US', { month: 'short' })
    const day = d.getDate()
    return `Wk ${weekNum} (${month} ${day})`
  }

  const getWeekConfidence = (weekNum: number): string => {
    const lines = weeklyProjection.weeklyLines.filter(
      (l) => l.weekNumber === weekNum
    )
    const levels = new Set(lines.map((l) => l.confidenceLevel))
    if (levels.has('LOW')) return 'LOW'
    if (levels.has('MODERATE')) return 'MODERATE'
    return 'HIGH'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/budgets')}
            data-testid="cash-projection-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              13-Week Cash Projection — FY {fiscalYear}{' '}
              <HelpTooltip term="cash-projection" />
            </h1>
            <p className="text-sm text-muted-foreground">
              As of {weeklyProjection.asOfDate}
            </p>
          </div>
          {modeToggle}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={onGenerate}
            disabled={generating}
            data-testid="cash-projection-regenerate-weekly-btn"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Regenerate
          </Button>
          <Button
            onClick={onSave}
            disabled={saving || overrides.size === 0}
            data-testid="cash-projection-save-weekly-btn"
          >
            <Save className="mr-2 h-4 w-4" />
            {saving ? 'Saving...' : 'Save Overrides'}
          </Button>
        </div>
      </div>

      {/* Per-week tables */}
      {weekNumbers.map((weekNum) => {
        const confidence = getWeekConfidence(weekNum)
        const inflowLines = getWeekLines(weekNum, 'INFLOW')
        const outflowLines = getWeekLines(weekNum, 'OUTFLOW')
        const totalInflows = inflowLines.reduce(
          (s, l) => s + getEffective(l),
          0
        )
        const totalOutflows = outflowLines.reduce(
          (s, l) => s + getEffective(l),
          0
        )
        const net = totalInflows - totalOutflows

        return (
          <div key={weekNum} className="space-y-1">
            <h2 className="text-md font-semibold flex items-center gap-2">
              <span className={CONFIDENCE_COLORS[confidence]}>
                {CONFIDENCE_ICONS[confidence]}
              </span>
              {formatWeekLabel(weekNum)}
              <Badge variant="outline" className="text-xs font-normal">
                {confidence.toLowerCase()} confidence
              </Badge>
              <span
                className={`ml-auto text-sm font-mono ${net >= 0 ? 'text-green-700' : 'text-red-700'}`}
              >
                Net: {formatCurrency(net)}
              </span>
            </h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[250px]">Source</TableHead>
                    <TableHead className="text-right w-[120px]">
                      Auto
                    </TableHead>
                    <TableHead className="text-center w-[140px]">
                      Override
                    </TableHead>
                    <TableHead className="text-right w-[120px]">
                      Effective
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inflowLines.length > 0 && (
                    <TableRow className="bg-green-50/50">
                      <TableCell
                        colSpan={4}
                        className="font-semibold text-xs text-green-800"
                      >
                        Inflows
                      </TableCell>
                    </TableRow>
                  )}
                  {inflowLines.map((line) => (
                    <WeeklyLineRow
                      key={line.id}
                      line={line}
                      overrides={overrides}
                      setOverride={setOverride}
                      getEffective={getEffective}
                    />
                  ))}
                  {outflowLines.length > 0 && (
                    <TableRow className="bg-red-50/50">
                      <TableCell
                        colSpan={4}
                        className="font-semibold text-xs text-red-800"
                      >
                        Outflows
                      </TableCell>
                    </TableRow>
                  )}
                  {outflowLines.map((line) => (
                    <WeeklyLineRow
                      key={line.id}
                      line={line}
                      overrides={overrides}
                      setOverride={setOverride}
                      getEffective={getEffective}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        )
      })}

      {/* Override Notes */}
      {overrides.size > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Override Notes</h3>
          {Array.from(overrides.entries())
            .filter(([, data]) => data.amount != null)
            .map(([lineId]) => {
              const line = weeklyProjection.weeklyLines.find(
                (l) => l.id === lineId
              )
              if (!line) return null
              return (
                <div key={lineId} className="flex items-start gap-2">
                  <span className="text-sm text-muted-foreground min-w-[200px]">
                    {line.sourceLabel} (Wk {line.weekNumber}):
                  </span>
                  <Textarea
                    placeholder="Explain the override reason (required)..."
                    value={overrides.get(lineId)?.note ?? ''}
                    onChange={(e) =>
                      setOverride(lineId, 'note', e.target.value)
                    }
                    className="h-16 text-sm"
                    data-testid={`weekly-override-note-${lineId}`}
                  />
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

function WeeklyLineRow({
  line,
  overrides,
  setOverride,
  getEffective,
}: {
  line: WeeklyLine
  overrides: Map<number, { amount: number | null; note: string | null }>
  setOverride: (lineId: number, field: 'amount' | 'note', value: string) => void
  getEffective: (line: WeeklyLine) => number
}) {
  return (
    <TableRow>
      <TableCell className="text-sm pl-6">{line.sourceLabel}</TableCell>
      <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
        {formatCurrency(Number(line.autoAmount))}
      </TableCell>
      <TableCell className="text-center">
        <Input
          type="number"
          step="0.01"
          placeholder="Override..."
          value={
            overrides.get(line.id)?.amount ??
            (line.overrideAmount ? Number(line.overrideAmount) : '')
          }
          onChange={(e) => setOverride(line.id, 'amount', e.target.value)}
          className="h-7 text-xs text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          data-testid={`weekly-projection-override-${line.id}`}
        />
      </TableCell>
      <TableCell className="text-right tabular-nums text-sm font-medium">
        {formatCurrency(getEffective(line))}
      </TableCell>
    </TableRow>
  )
}
