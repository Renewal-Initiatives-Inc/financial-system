'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, Plus, Loader2, AlertTriangle, Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import {
  createAnnualRate,
  updateAnnualRate,
} from '@/app/(protected)/payroll/actions'
import type { annualRateConfig } from '@/lib/db/schema'

type RateRow = typeof annualRateConfig.$inferSelect

const RATE_LABELS: Record<string, string> = {
  fica_ss_rate: 'Social Security Rate',
  fica_medicare_rate: 'Medicare Rate',
  fica_ss_wage_base: 'SS Wage Base',
  vendor_1099_threshold: '1099 Threshold',
  ma_state_tax_rate: 'MA State Tax Rate',
  ma_surtax_rate: 'MA Surtax Rate',
  ma_surtax_threshold: 'MA Surtax Threshold',
  mileage_rate: 'IRS Mileage Rate',
  federal_standard_deductions: 'Federal Standard Deductions',
  federal_tax_brackets: 'Federal Tax Brackets',
}

const RATE_TOOLTIPS: Record<string, string> = {
  fica_ss_rate: 'fica',
  fica_medicare_rate: 'fica',
  fica_ss_wage_base: 'ss-wage-base',
  vendor_1099_threshold: '1099-eligible',
  ma_state_tax_rate: 'ma-state-withholding',
}

function formatRateValue(key: string, value: string): string {
  const num = parseFloat(value)
  if (key === 'mileage_rate') {
    return `$${num.toFixed(3)}/mile`
  }
  if (key.includes('rate')) {
    return `${(num * 100).toFixed(3)}%`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(num)
}

type StandardDeductions = { single: number; married: number; head_of_household: number }
type TaxBracket = { over: number; notOver: number | null; rate: number; plus: number }
type TaxBrackets = { single: TaxBracket[]; married: TaxBracket[]; head_of_household: TaxBracket[] }

function JsonValueSummary({ configKey, jsonValue }: { configKey: string; jsonValue: unknown }) {
  if (configKey === 'federal_standard_deductions') {
    const d = jsonValue as StandardDeductions
    const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
    return (
      <span className="text-sm">
        {fmt(d.single)} / {fmt(d.married)} / {fmt(d.head_of_household)}
        <span className="ml-1 text-xs text-muted-foreground">(S/M/HOH)</span>
      </span>
    )
  }
  if (configKey === 'federal_tax_brackets') {
    const b = jsonValue as TaxBrackets
    const count = b.single?.length ?? 0
    return (
      <span className="text-sm">
        {count} brackets
        <span className="ml-1 text-xs text-muted-foreground">(S/M/HOH)</span>
      </span>
    )
  }
  return <span className="text-sm text-muted-foreground">JSON</span>
}

function TaxBracketsDialog({ brackets }: { brackets: TaxBrackets }) {
  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
  const filingStatuses = [
    { key: 'single' as const, label: 'Single' },
    { key: 'married' as const, label: 'Married' },
    { key: 'head_of_household' as const, label: 'Head of Household' },
  ]
  return (
    <div className="space-y-4">
      {filingStatuses.map(({ key, label }) => (
        <div key={key}>
          <p className="text-sm font-semibold mb-1">{label}</p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Over</TableHead>
                <TableHead>Not Over</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Plus</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {brackets[key].map((b, i) => (
                <TableRow key={i}>
                  <TableCell>{fmt(b.over)}</TableCell>
                  <TableCell>{b.notOver != null ? fmt(b.notOver) : '—'}</TableCell>
                  <TableCell>{(b.rate * 100).toFixed(0)}%</TableCell>
                  <TableCell>{fmt(b.plus)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

interface RateConfigClientProps {
  initialRates: RateRow[]
}

export function RateConfigClient({ initialRates }: RateConfigClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [yearFilter, setYearFilter] = useState<string>('all')
  const [editRate, setEditRate] = useState<RateRow | null>(null)
  const [editValue, setEditValue] = useState('')
  const [editNotes, setEditNotes] = useState('')
  const [viewJsonRate, setViewJsonRate] = useState<RateRow | null>(null)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [newRate, setNewRate] = useState({
    fiscalYear: new Date().getFullYear(),
    configKey: '',
    value: '',
    notes: '',
  })

  // Get unique years
  const years = [...new Set(initialRates.map((r) => r.fiscalYear))].sort(
    (a, b) => b - a
  )

  const filtered =
    yearFilter === 'all'
      ? initialRates
      : initialRates.filter((r) => r.fiscalYear === parseInt(yearFilter, 10))

  // Group by year
  const groupedByYear = new Map<number, RateRow[]>()
  for (const rate of filtered) {
    const existing = groupedByYear.get(rate.fiscalYear) ?? []
    existing.push(rate)
    groupedByYear.set(rate.fiscalYear, existing)
  }

  const handleEdit = (rate: RateRow) => {
    setEditRate(rate)
    setEditValue(rate.value)
    setEditNotes(rate.notes ?? '')
  }

  const handleSave = () => {
    if (!editRate) return
    startTransition(async () => {
      try {
        await updateAnnualRate(
          editRate.id,
          { value: editValue, notes: editNotes || null },
          'system'
        )
        toast.success('Rate updated')
        setEditRate(null)
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to update rate'
        )
      }
    })
  }

  const handleAdd = () => {
    startTransition(async () => {
      try {
        await createAnnualRate(
          {
            fiscalYear: newRate.fiscalYear,
            configKey: newRate.configKey,
            value: newRate.value,
            notes: newRate.notes || null,
          },
          'system'
        )
        toast.success('Rate added')
        setShowAddDialog(false)
        setNewRate({
          fiscalYear: new Date().getFullYear(),
          configKey: '',
          value: '',
          notes: '',
        })
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to add rate'
        )
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Annual Rate Configuration
          </h1>
          <HelpTooltip term="annual-rate-config" />
        </div>
        <Button
          onClick={() => setShowAddDialog(true)}
          data-testid="add-rate-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Rate
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="w-[180px]" data-testid="rate-config-year-filter-select">
            <SelectValue placeholder="Filter by year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {years.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {Array.from(groupedByYear.entries())
        .sort(([a], [b]) => b - a)
        .map(([year, rates]) => (
          <Card key={year}>
            <CardHeader>
              <CardTitle className="text-lg">
                Fiscal Year {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Rate</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead className="w-[80px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rates.map((rate) => (
                    <TableRow key={rate.id}>
                      <TableCell className="font-medium">
                        {RATE_LABELS[rate.configKey] ?? rate.configKey}
                        {RATE_TOOLTIPS[rate.configKey] && (
                          <> <HelpTooltip term={RATE_TOOLTIPS[rate.configKey]} /></>
                        )}
                      </TableCell>
                      <TableCell>
                        {rate.jsonValue != null ? (
                          <div className="flex items-center gap-2">
                            <JsonValueSummary configKey={rate.configKey} jsonValue={rate.jsonValue} />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => setViewJsonRate(rate)}
                            >
                              <Eye className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          formatRateValue(rate.configKey, rate.value)
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate" title={rate.sourceDocument ?? undefined}>
                        {rate.sourceDocument ? (
                          rate.sourceUrl ? (
                            <a href={rate.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                              {rate.sourceDocument}
                            </a>
                          ) : (
                            rate.sourceDocument
                          )
                        ) : (
                          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            No source
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {rate.notes ?? '—'}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(rate)}
                          data-testid={`edit-rate-${rate.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          No rates configured. Add rate entries to get started.
        </p>
      )}

      {/* Edit dialog */}
      <Dialog open={!!editRate} onOpenChange={() => setEditRate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Edit Rate:{' '}
              {editRate
                ? RATE_LABELS[editRate.configKey] ?? editRate.configKey
                : ''}
            </DialogTitle>
            <DialogDescription>
              Update the rate value for fiscal year {editRate?.fiscalYear}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Value</Label>
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                data-testid="edit-rate-value"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                data-testid="edit-rate-notes"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRate(null)} data-testid="rate-config-edit-cancel-btn">
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isPending} data-testid="rate-config-edit-save-btn">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* JSON value view dialog */}
      <Dialog open={!!viewJsonRate} onOpenChange={() => setViewJsonRate(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {viewJsonRate ? RATE_LABELS[viewJsonRate.configKey] ?? viewJsonRate.configKey : ''}
              {viewJsonRate ? ` — FY${viewJsonRate.fiscalYear}` : ''}
            </DialogTitle>
            <DialogDescription>
              Read-only view. Edit via seed data or direct DB update.
            </DialogDescription>
          </DialogHeader>
          <div className="overflow-y-auto flex-1 pr-1">
          {viewJsonRate?.configKey === 'federal_tax_brackets' && viewJsonRate.jsonValue != null && (
            <TaxBracketsDialog brackets={viewJsonRate.jsonValue as TaxBrackets} />
          )}
          {viewJsonRate?.configKey === 'federal_standard_deductions' && viewJsonRate.jsonValue != null && (() => {
            const d = viewJsonRate.jsonValue as StandardDeductions
            const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
            return (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Filing Status</TableHead>
                    <TableHead>Standard Deduction</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow><TableCell>Single</TableCell><TableCell>{fmt(d.single)}</TableCell></TableRow>
                  <TableRow><TableCell>Married Filing Jointly</TableCell><TableCell>{fmt(d.married)}</TableCell></TableRow>
                  <TableRow><TableCell>Head of Household</TableCell><TableCell>{fmt(d.head_of_household)}</TableCell></TableRow>
                </TableBody>
              </Table>
            )
          })()}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Rate Configuration</DialogTitle>
            <DialogDescription>
              Add a new annual rate entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Fiscal Year</Label>
              <Input
                type="number"
                value={newRate.fiscalYear}
                onChange={(e) =>
                  setNewRate({
                    ...newRate,
                    fiscalYear: parseInt(e.target.value, 10),
                  })
                }
                data-testid="rate-config-add-fiscal-year-input"
              />
            </div>
            <div>
              <Label>Config Key</Label>
              <Select
                value={newRate.configKey}
                onValueChange={(v) =>
                  setNewRate({ ...newRate, configKey: v })
                }
              >
                <SelectTrigger data-testid="rate-config-add-config-key-select">
                  <SelectValue placeholder="Select rate type" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RATE_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Value</Label>
              <Input
                value={newRate.value}
                onChange={(e) =>
                  setNewRate({ ...newRate, value: e.target.value })
                }
                placeholder="e.g. 0.062000 or 184500.000000"
                data-testid="rate-config-add-value-input"
              />
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newRate.notes}
                onChange={(e) =>
                  setNewRate({ ...newRate, notes: e.target.value })
                }
                data-testid="rate-config-add-notes-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)} data-testid="rate-config-add-cancel-btn">
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isPending} data-testid="rate-config-add-submit-btn">
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Add
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
