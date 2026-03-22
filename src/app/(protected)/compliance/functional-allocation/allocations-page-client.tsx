'use client'

import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Lock, Plus, Pencil, CheckCircle2 } from 'lucide-react'
import { WizardClient } from './wizard-client'
import type { FiscalYearAllocSummary } from './actions'
import type { AllocationDefault } from '@/lib/compliance/functional-defaults'

interface AllocationsPageClientProps {
  yearSummaries: FiscalYearAllocSummary[]
  selectedYear: number | null
  defaults: AllocationDefault[] | null
  existingCount: number
  isEditing: boolean
}

export function AllocationsPageClient({
  yearSummaries,
  selectedYear,
  defaults,
  existingCount,
  isEditing,
}: AllocationsPageClientProps) {
  const router = useRouter()
  const currentCalendarYear = new Date().getFullYear()

  // Build list of available years (current year + any years that have allocations)
  const existingYears = new Set(yearSummaries.map((s) => s.fiscalYear))
  const availableYears: number[] = []
  for (let y = currentCalendarYear; y >= currentCalendarYear - 5; y--) {
    availableYears.push(y)
  }
  for (const s of yearSummaries) {
    if (!availableYears.includes(s.fiscalYear)) {
      availableYears.push(s.fiscalYear)
    }
  }
  availableYears.sort((a, b) => b - a)

  const selectedSummary = yearSummaries.find((s) => s.fiscalYear === selectedYear)
  const hasExisting = existingCount > 0
  const showWizard = selectedYear && defaults && (isEditing || !hasExisting)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Functional Expense Allocations
        </h1>
      </div>

      {/* Year overview table */}
      {yearSummaries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Allocation History</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead>Accounts</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearSummaries.map((s) => (
                  <TableRow key={s.fiscalYear}>
                    <TableCell className="font-medium">FY{s.fiscalYear}</TableCell>
                    <TableCell>{s.accountCount} accounts</TableCell>
                    <TableCell>
                      {s.isLocked ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Locked
                        </Badge>
                      ) : (
                        <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 gap-1">
                          <CheckCircle2 className="h-3 w-3" />
                          Complete
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {s.updatedAt ?? '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            router.push(
                              `/compliance/functional-allocation?year=${s.fiscalYear}`
                            )
                          }
                        >
                          View
                        </Button>
                        {!s.isLocked && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              router.push(
                                `/compliance/functional-allocation?year=${s.fiscalYear}&edit=1`
                              )
                            }
                          >
                            <Pencil className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Year selector for new allocation */}
      {!selectedYear && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {yearSummaries.length === 0
                ? 'Set Up Allocations'
                : 'Set Up Allocations for Another Year'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a fiscal year to set or review functional expense allocations.
              These determine how expenses are split between Program, Management &
              General, and Fundraising on your Form 990 and Statement of Functional
              Expenses.
            </p>
            <div className="flex items-center gap-3">
              <Select
                onValueChange={(v) =>
                  router.push(`/compliance/functional-allocation?year=${v}`)
                }
              >
                <SelectTrigger className="w-[200px]" data-testid="alloc-year-select">
                  <SelectValue placeholder="Select fiscal year" />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      FY{y}{' '}
                      {existingYears.has(y) ? '(has allocations)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected year: show summary (completed) or wizard (new/editing) */}
      {selectedYear && defaults && !showWizard && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">
              FY{selectedYear} Allocations
              {selectedSummary?.isLocked && (
                <Badge variant="secondary" className="ml-2 gap-1">
                  <Lock className="h-3 w-3" />
                  Locked
                </Badge>
              )}
            </h2>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push('/compliance/functional-allocation')
                }
              >
                Back to Overview
              </Button>
              {!selectedSummary?.isLocked && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(
                      `/compliance/functional-allocation?year=${selectedYear}&edit=1`
                    )
                  }
                >
                  <Pencil className="h-3 w-3 mr-1" />
                  Edit Allocations
                </Button>
              )}
            </div>
          </div>

          <Card>
            <CardContent className="pt-4">
              <div className="space-y-1">
                <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                  <span className="col-span-2">Account</span>
                  <span className="text-right">Program</span>
                  <span className="text-right">M&G</span>
                  <span className="text-right">Fundraising</span>
                </div>
                {defaults.map((a) => (
                  <div
                    key={a.accountId}
                    className="grid grid-cols-5 gap-2 text-sm py-0.5"
                  >
                    <span className="col-span-2 truncate">
                      {a.accountCode} — {a.accountName}
                      {a.isPermanentRule && (
                        <Badge variant="outline" className="ml-1 text-[10px]">
                          Perm
                        </Badge>
                      )}
                    </span>
                    <span className="text-right tabular-nums">
                      {a.programPct}%
                    </span>
                    <span className="text-right tabular-nums">
                      {a.adminPct}%
                    </span>
                    <span className="text-right tabular-nums">
                      {a.fundraisingPct}%
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showWizard && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div />
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                router.push(
                  hasExisting
                    ? `/compliance/functional-allocation?year=${selectedYear}`
                    : '/compliance/functional-allocation'
                )
              }
            >
              Cancel
            </Button>
          </div>
          <WizardClient defaults={defaults} fiscalYear={selectedYear!} />
        </div>
      )}
    </div>
  )
}
