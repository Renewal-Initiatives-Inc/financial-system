import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { cashProjections, weeklyCashProjectionLines } from '@/lib/db/schema'
import { getStartingCash } from '@/lib/budget/projection'

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

function getMonthLabel(month: number, year: number): string {
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ---------------------------------------------------------------------------
// Main query — derives monthly view from the weekly projection data so that
// both the monthly and weekly reports are powered by the same source and
// their numbers align at month boundaries.
// ---------------------------------------------------------------------------

export async function getCashProjectionData(): Promise<CashProjectionData> {
  const now = new Date().toISOString()
  const currentYear = new Date().getFullYear()

  const empty: CashProjectionData = {
    projectionId: null,
    fiscalYear: currentYear,
    asOfDate: now.split('T')[0],
    months: [],
    startingCash: 0,
    endingCashByMonth: [],
    generatedAt: now,
  }

  // Find the most recent WEEKLY projection (source of truth)
  const projections = await db
    .select()
    .from(cashProjections)
    .where(eq(cashProjections.projectionType, 'WEEKLY'))
    .orderBy(desc(cashProjections.createdAt))
    .limit(1)

  if (projections.length === 0) return empty

  const projection = projections[0]

  // Get all weekly lines
  const lines = await db
    .select()
    .from(weeklyCashProjectionLines)
    .where(eq(weeklyCashProjectionLines.projectionId, projection.id))
    .orderBy(weeklyCashProjectionLines.weekNumber, weeklyCashProjectionLines.sortOrder)

  if (lines.length === 0) return empty

  // Group weekly lines by calendar month, then aggregate by sourceLabel + lineType
  // so e.g. 4 weeks of "Utilities - Internet" in May become one $174.60 line.
  const monthRaw = new Map<
    number,
    { year: number; lines: typeof lines }
  >()

  for (const l of lines) {
    const d = new Date(l.weekStartDate + 'T00:00:00')
    const month = d.getMonth() + 1
    const year = d.getFullYear()
    if (!monthRaw.has(month)) monthRaw.set(month, { year, lines: [] })
    monthRaw.get(month)!.lines.push(l)
  }

  const monthBuckets = new Map<
    number,
    { year: number; inflows: CashProjectionLine[]; outflows: CashProjectionLine[] }
  >()

  for (const [month, { year, lines: rawLines }] of monthRaw) {
    // Aggregate by sourceLabel + lineType
    const agg = new Map<string, {
      ids: number[]
      autoSum: number
      overrideSum: number | null  // null unless ALL contributing lines have overrides
      hasAnyOverride: boolean
      lineType: string
      sortOrder: number
    }>()

    for (const l of rawLines) {
      const key = `${l.lineType}::${l.sourceLabel}`
      const auto = parseFloat(l.autoAmount)
      const override = l.overrideAmount ? parseFloat(l.overrideAmount) : null

      if (!agg.has(key)) {
        agg.set(key, {
          ids: [l.id],
          autoSum: auto,
          overrideSum: override,
          hasAnyOverride: override !== null,
          lineType: l.lineType,
          sortOrder: l.sortOrder,
        })
      } else {
        const entry = agg.get(key)!
        entry.ids.push(l.id)
        entry.autoSum += auto
        // If any line lacks an override, the aggregate override is partial —
        // show null (use auto) unless every line has an override.
        if (override !== null) {
          entry.hasAnyOverride = true
          entry.overrideSum = (entry.overrideSum ?? 0) + override
        } else {
          entry.overrideSum = null
        }
      }
    }

    const inflows: CashProjectionLine[] = []
    const outflows: CashProjectionLine[] = []

    for (const [key, entry] of agg) {
      const sourceLabel = key.split('::')[1]
      const autoAmount = Math.round(entry.autoSum * 100) / 100
      const overrideAmount = entry.hasAnyOverride && entry.overrideSum !== null
        ? Math.round(entry.overrideSum * 100) / 100
        : null

      const line: CashProjectionLine = {
        id: entry.ids[0], // primary ID for override targeting
        month,
        sourceLabel,
        autoAmount,
        overrideAmount,
        overrideNote: null,
        effectiveAmount: overrideAmount ?? autoAmount,
        lineType: entry.lineType,
        sortOrder: entry.sortOrder,
      }

      if (entry.lineType === 'INFLOW') inflows.push(line)
      else outflows.push(line)
    }

    inflows.sort((a, b) => a.sortOrder - b.sortOrder)
    outflows.sort((a, b) => a.sortOrder - b.sortOrder)

    monthBuckets.set(month, { year, inflows, outflows })
  }

  // Build sorted month array
  const sortedMonths = [...monthBuckets.entries()].sort((a, b) => a[0] - b[0])

  const months: CashProjectionMonth[] = sortedMonths.map(([month, bucket]) => {
    const totalInflows = bucket.inflows.reduce((s, l) => s + l.effectiveAmount, 0)
    const totalOutflows = bucket.outflows.reduce((s, l) => s + l.effectiveAmount, 0)

    return {
      month,
      monthLabel: getMonthLabel(month, bucket.year),
      inflows: bucket.inflows,
      outflows: bucket.outflows,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netCashFlow: Math.round((totalInflows - totalOutflows) * 100) / 100,
    }
  })

  // Starting cash from GL
  const startingCash = await getStartingCash()

  // Ending cash per month
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
