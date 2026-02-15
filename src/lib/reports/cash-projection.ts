import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cashProjections, cashProjectionLines } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CashProjectionLine {
  id: number
  month: number
  sourceLabel: string
  autoAmount: number
  overrideAmount: number | null
  overrideNote: string | null
  effectiveAmount: number // override ?? auto
  lineType: string // 'INFLOW' | 'OUTFLOW'
  sortOrder: number
}

export interface CashProjectionMonth {
  month: number
  monthLabel: string
  inflows: CashProjectionLine[]
  outflows: CashProjectionLine[]
  totalInflows: number
  totalOutflows: number
  netCashFlow: number
}

export interface CashProjectionData {
  projectionId: number | null
  fiscalYear: number
  asOfDate: string
  months: CashProjectionMonth[]
  startingCash: number
  endingCashByMonth: number[]
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthLabel(month: number): string {
  const date = new Date(2026, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getCashProjectionData(): Promise<CashProjectionData> {
  const now = new Date().toISOString()
  const currentYear = new Date().getFullYear()

  // Get the most recent cash projection
  const projections = await db
    .select()
    .from(cashProjections)
    .orderBy(desc(cashProjections.createdAt))
    .limit(1)

  if (projections.length === 0) {
    return {
      projectionId: null,
      fiscalYear: currentYear,
      asOfDate: now.split('T')[0],
      months: [],
      startingCash: 0,
      endingCashByMonth: [],
      generatedAt: now,
    }
  }

  const projection = projections[0]

  // Get all lines for this projection
  const lines = await db
    .select()
    .from(cashProjectionLines)
    .where(eq(cashProjectionLines.projectionId, projection.id))
    .orderBy(cashProjectionLines.month, cashProjectionLines.sortOrder)

  // Group lines by month
  const monthNumbers = [...new Set(lines.map((l) => l.month))].sort((a, b) => a - b)

  const months: CashProjectionMonth[] = monthNumbers.map((m) => {
    const monthLines = lines.filter((l) => l.month === m)
    const mapped: CashProjectionLine[] = monthLines.map((l) => {
      const auto = parseFloat(l.autoAmount)
      const override = l.overrideAmount ? parseFloat(l.overrideAmount) : null

      return {
        id: l.id,
        month: l.month,
        sourceLabel: l.sourceLabel,
        autoAmount: auto,
        overrideAmount: override,
        overrideNote: l.overrideNote,
        effectiveAmount: override ?? auto,
        lineType: l.lineType,
        sortOrder: l.sortOrder,
      }
    })

    const inflows = mapped.filter((l) => l.lineType === 'INFLOW')
    const outflows = mapped.filter((l) => l.lineType === 'OUTFLOW')
    const totalInflows = inflows.reduce((s, l) => s + l.effectiveAmount, 0)
    const totalOutflows = outflows.reduce((s, l) => s + l.effectiveAmount, 0)

    return {
      month: m,
      monthLabel: getMonthLabel(m),
      inflows,
      outflows,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netCashFlow: Math.round((totalInflows - totalOutflows) * 100) / 100,
    }
  })

  // Compute ending cash per month (starting cash = 0 placeholder — would come from GL)
  const startingCash = 0
  const endingCashByMonth: number[] = []
  let runningCash = startingCash
  for (const m of months) {
    runningCash += m.netCashFlow
    endingCashByMonth.push(Math.round(runningCash * 100) / 100)
  }

  return {
    projectionId: projection.id,
    fiscalYear: projection.fiscalYear,
    asOfDate: projection.asOfDate,
    months,
    startingCash,
    endingCashByMonth,
    generatedAt: now,
  }
}
