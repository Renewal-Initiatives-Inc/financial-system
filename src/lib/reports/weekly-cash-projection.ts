import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  cashProjections,
  weeklyCashProjectionLines,
  funds,
  appSettings,
} from '@/lib/db/schema'
import { getStartingCash } from '@/lib/budget/projection'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WeeklyCashProjectionLine {
  id: number
  weekNumber: number
  weekStartDate: string
  sourceLabel: string
  autoAmount: number
  overrideAmount: number | null
  overrideNote: string | null
  effectiveAmount: number
  lineType: string
  confidenceLevel: string
  fundId: number | null
  fundRestrictionType: string | null
  sortOrder: number
}

export interface WeeklyCashProjectionWeek {
  weekNumber: number
  weekStartDate: string
  weekLabel: string
  confidenceLevel: string
  inflows: WeeklyCashProjectionLine[]
  outflows: WeeklyCashProjectionLine[]
  totalInflows: number
  totalOutflows: number
  netCashFlow: number
  endingCash: number
  restrictedBalance: number
  unrestrictedBalance: number
  isWarning: boolean
  isCritical: boolean
}

export interface WeeklyCashProjectionData {
  projectionId: number | null
  fiscalYear: number
  asOfDate: string
  weeks: WeeklyCashProjectionWeek[]
  startingCash: number
  thresholdWarning: number
  thresholdCritical: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatWeekLabel(weekNumber: number, weekStartDate: string): string {
  const d = new Date(weekStartDate + 'T00:00:00')
  const month = d.toLocaleDateString('en-US', { month: 'short' })
  const day = d.getDate()
  return `Wk ${weekNumber} (${month} ${day})`
}

/**
 * Determine the overall confidence level for a week based on its constituent lines.
 * Uses the lowest confidence present.
 */
function getWeekConfidence(lines: WeeklyCashProjectionLine[]): string {
  const levels = new Set(lines.map((l) => l.confidenceLevel))
  if (levels.has('LOW')) return 'LOW'
  if (levels.has('MODERATE')) return 'MODERATE'
  return 'HIGH'
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

async function getThresholdSettings(): Promise<{
  warning: number
  critical: number
}> {
  const settings = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(
      eq(appSettings.key, 'cashThresholdWarning')
    )

  const criticalSettings = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)
    .where(
      eq(appSettings.key, 'cashThresholdCritical')
    )

  const warningRow = settings[0]
  const criticalRow = criticalSettings[0]

  return {
    warning: warningRow ? Number(warningRow.value) : 20000,
    critical: criticalRow ? Number(criticalRow.value) : 10000,
  }
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getWeeklyCashProjectionData(): Promise<WeeklyCashProjectionData> {
  const now = new Date().toISOString()
  const currentYear = new Date().getFullYear()

  // Get the most recent weekly projection
  const projections = await db
    .select()
    .from(cashProjections)
    .where(eq(cashProjections.projectionType, 'WEEKLY'))
    .orderBy(desc(cashProjections.createdAt))
    .limit(1)

  const thresholds = await getThresholdSettings()

  if (projections.length === 0) {
    return {
      projectionId: null,
      fiscalYear: currentYear,
      asOfDate: now.split('T')[0],
      weeks: [],
      startingCash: 0,
      thresholdWarning: thresholds.warning,
      thresholdCritical: thresholds.critical,
      generatedAt: now,
    }
  }

  const projection = projections[0]

  // Get all weekly lines with fund restriction info
  const lines = await db
    .select({
      id: weeklyCashProjectionLines.id,
      weekNumber: weeklyCashProjectionLines.weekNumber,
      weekStartDate: weeklyCashProjectionLines.weekStartDate,
      sourceLabel: weeklyCashProjectionLines.sourceLabel,
      autoAmount: weeklyCashProjectionLines.autoAmount,
      overrideAmount: weeklyCashProjectionLines.overrideAmount,
      overrideNote: weeklyCashProjectionLines.overrideNote,
      lineType: weeklyCashProjectionLines.lineType,
      confidenceLevel: weeklyCashProjectionLines.confidenceLevel,
      fundId: weeklyCashProjectionLines.fundId,
      sortOrder: weeklyCashProjectionLines.sortOrder,
      fundRestrictionType: funds.restrictionType,
    })
    .from(weeklyCashProjectionLines)
    .leftJoin(funds, eq(weeklyCashProjectionLines.fundId, funds.id))
    .where(eq(weeklyCashProjectionLines.projectionId, projection.id))
    .orderBy(weeklyCashProjectionLines.weekNumber, weeklyCashProjectionLines.sortOrder)

  // Get starting cash from GL
  const startingCash = await getStartingCash()

  // Group lines by week
  const weekNumbers = [...new Set(lines.map((l) => l.weekNumber))].sort(
    (a, b) => a - b
  )

  let runningCash = startingCash
  // Track restricted balance: start at 0 and accumulate restricted inflows/outflows
  let runningRestricted = 0

  const weeks: WeeklyCashProjectionWeek[] = weekNumbers.map((wn) => {
    const weekLines = lines.filter((l) => l.weekNumber === wn)
    const mapped: WeeklyCashProjectionLine[] = weekLines.map((l) => {
      const auto = parseFloat(l.autoAmount)
      const override = l.overrideAmount ? parseFloat(l.overrideAmount) : null
      return {
        id: l.id,
        weekNumber: l.weekNumber,
        weekStartDate: l.weekStartDate,
        sourceLabel: l.sourceLabel,
        autoAmount: auto,
        overrideAmount: override,
        overrideNote: l.overrideNote,
        effectiveAmount: override ?? auto,
        lineType: l.lineType,
        confidenceLevel: l.confidenceLevel,
        fundId: l.fundId,
        fundRestrictionType: l.fundRestrictionType,
        sortOrder: l.sortOrder,
      }
    })

    const inflowLines = mapped.filter((l) => l.lineType === 'INFLOW')
    const outflowLines = mapped.filter((l) => l.lineType === 'OUTFLOW')
    const totalInflows = inflowLines.reduce((s, l) => s + l.effectiveAmount, 0)
    const totalOutflows = outflowLines.reduce((s, l) => s + l.effectiveAmount, 0)
    const netCashFlow = Math.round((totalInflows - totalOutflows) * 100) / 100

    runningCash = Math.round((runningCash + netCashFlow) * 100) / 100

    // Calculate restricted movement for this week
    const restrictedInflow = inflowLines
      .filter((l) => l.fundRestrictionType === 'RESTRICTED')
      .reduce((s, l) => s + l.effectiveAmount, 0)
    const restrictedOutflow = outflowLines
      .filter((l) => l.fundRestrictionType === 'RESTRICTED')
      .reduce((s, l) => s + l.effectiveAmount, 0)
    runningRestricted = Math.round(
      (runningRestricted + restrictedInflow - restrictedOutflow) * 100
    ) / 100

    const unrestrictedBalance = Math.round((runningCash - runningRestricted) * 100) / 100

    const weekStartDate =
      weekLines.length > 0 ? weekLines[0].weekStartDate : ''

    return {
      weekNumber: wn,
      weekStartDate,
      weekLabel: formatWeekLabel(wn, weekStartDate),
      confidenceLevel: getWeekConfidence(mapped),
      inflows: inflowLines,
      outflows: outflowLines,
      totalInflows: Math.round(totalInflows * 100) / 100,
      totalOutflows: Math.round(totalOutflows * 100) / 100,
      netCashFlow,
      endingCash: runningCash,
      restrictedBalance: runningRestricted,
      unrestrictedBalance,
      isWarning: unrestrictedBalance < thresholds.warning && unrestrictedBalance >= thresholds.critical,
      isCritical: unrestrictedBalance < thresholds.critical,
    }
  })

  return {
    projectionId: projection.id,
    fiscalYear: projection.fiscalYear,
    asOfDate: projection.asOfDate,
    weeks,
    startingCash,
    thresholdWarning: thresholds.warning,
    thresholdCritical: thresholds.critical,
    generatedAt: now,
  }
}
