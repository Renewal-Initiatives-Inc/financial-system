'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const REPORTS = [
  // Core (pre-selected)
  { slug: 'balance-sheet', title: 'Statement of Financial Position', core: true },
  { slug: 'activities', title: 'Statement of Activities', core: true },
  { slug: 'cash-flows', title: 'Statement of Cash Flows', core: true },
  { slug: 'functional-expenses', title: 'Statement of Functional Expenses', core: true },
  // Operational
  { slug: 'cash-position', title: 'Cash Position Summary', core: false },
  { slug: 'ar-aging', title: 'AR Aging', core: false },
  { slug: 'outstanding-payables', title: 'Outstanding Payables', core: false },
  { slug: 'rent-collection', title: 'Rent Collection Status', core: false },
  // Fund
  { slug: 'fund-drawdown', title: 'Fund Draw-Down', core: false },
  { slug: 'grant-compliance', title: 'Funding Compliance', core: false },
  { slug: 'fund-level', title: 'Fund-Level Report', core: false },
  // Specialized
  { slug: 'property-expenses', title: 'Property Expenses', core: false },
  { slug: 'utility-trends', title: 'Utility Trends', core: false },
  { slug: 'security-deposit-register', title: 'Security Deposit Register', core: false },
  { slug: 'donor-giving-history', title: 'Donor Giving History', core: false },
  { slug: 'cash-projection', title: 'Cash Projection', core: false },
  { slug: 'ahp-loan-summary', title: 'AHP Loan Summary', core: false },
  { slug: 'audit-log', title: 'Audit Log', core: false },
  { slug: 'transaction-history', title: 'Transaction History', core: false },
  { slug: 'late-entries', title: 'Late Entries', core: false },
  { slug: 'form-990-data', title: 'Form 990 Data', core: false },
  { slug: 'compliance-calendar', title: 'Compliance Calendar', core: false },
  { slug: 'capital-budget', title: 'Capital Budget', core: false },
  { slug: 'payroll-register', title: 'Payroll Register', core: false },
  { slug: 'payroll-tax-liability', title: 'Payroll Tax Liability', core: false },
  { slug: 'w2-verification', title: 'W-2 Verification', core: false },
  { slug: 'employer-payroll-cost', title: 'Employer Payroll Cost', core: false },
  { slug: 'quarterly-tax-prep', title: 'Quarterly Tax Prep', core: false },
  { slug: 'ahp-annual-package', title: 'AHP Annual Package', core: false },
]

export function BoardPackClient() {
  const now = new Date()
  const [selected, setSelected] = useState<Set<string>>(
    new Set(REPORTS.filter((r) => r.core).map((r) => r.slug))
  )
  const [startDate, setStartDate] = useState(
    `${now.getFullYear()}-01-01`
  )
  const [endDate, setEndDate] = useState(
    now.toISOString().split('T')[0]
  )
  const [isGenerating, setIsGenerating] = useState(false)

  const handleToggle = (slug: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const handleGenerate = () => {
    if (selected.size === 0) return
    setIsGenerating(true)
    const slugs = Array.from(selected).join(',')
    const url = `/api/reports/board-pack?reports=${slugs}&startDate=${startDate}&endDate=${endDate}`
    // Trigger download
    const a = document.createElement('a')
    a.href = url
    a.download = `Board-Pack-${endDate}.pdf`
    a.click()
    setTimeout(() => setIsGenerating(false), 3000)
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Board Pack Generator</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Date Range</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div>
            <Label htmlFor="startDate">Start Date</Label>
            <Input
              id="startDate"
              data-testid="board-pack-start-date-input"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="endDate">End Date</Label>
            <Input
              id="endDate"
              data-testid="board-pack-end-date-input"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="text-sm">Select Reports ({selected.size} selected)</span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                data-testid="board-pack-select-all-btn"
                onClick={() => setSelected(new Set(REPORTS.map((r) => r.slug)))}
              >
                Select All
              </Button>
              <Button
                variant="ghost"
                size="sm"
                data-testid="board-pack-core-only-btn"
                onClick={() =>
                  setSelected(new Set(REPORTS.filter((r) => r.core).map((r) => r.slug)))
                }
              >
                Core Only
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {REPORTS.map((r) => (
              <div key={r.slug} className="flex items-center gap-2 py-1">
                <Checkbox
                  id={r.slug}
                  data-testid={`board-pack-report-${r.slug}`}
                  checked={selected.has(r.slug)}
                  onCheckedChange={() => handleToggle(r.slug)}
                />
                <Label htmlFor={r.slug} className="text-sm cursor-pointer">
                  {r.title}
                  {r.core && (
                    <span className="text-xs text-muted-foreground ml-1">(core)</span>
                  )}
                </Label>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Button
        data-testid="board-pack-generate-btn"
        onClick={handleGenerate}
        disabled={selected.size === 0 || isGenerating}
        className="w-full"
      >
        {isGenerating
          ? 'Generating...'
          : `Generate Board Pack (${selected.size} reports)`}
      </Button>
    </div>
  )
}
