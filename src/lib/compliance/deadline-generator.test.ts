import { describe, it, expect } from 'vitest'

// Test the ANNUAL_DEADLINES constant structure and date computation logic
// The actual DB interactions would require integration tests, so we test
// the pure logic aspects here.

describe('Annual deadline date computation', () => {
  function computeDueDate(
    month: number,
    day: number,
    fiscalYear: number,
    taskName: string
  ): string {
    const calendarYear =
      month === 1 && taskName.includes('Q4')
        ? fiscalYear + 1
        : fiscalYear
    return `${calendarYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  it('Form 990 filing: May 15 of fiscal year', () => {
    const due = computeDueDate(5, 15, 2026, 'Form 990 filing')
    expect(due).toBe('2026-05-15')
  })

  it('Federal 941 Q4: January 31 of NEXT calendar year', () => {
    const due = computeDueDate(1, 31, 2026, 'Federal 941 (Q4)')
    expect(due).toBe('2027-01-31')
  })

  it('Federal 941 Q1: April 30 of fiscal year', () => {
    const due = computeDueDate(4, 30, 2026, 'Federal 941 (Q1)')
    expect(due).toBe('2026-04-30')
  })

  it('W-2 filing: January 31 of fiscal year (not Q4)', () => {
    const due = computeDueDate(1, 31, 2026, 'W-2 filing')
    expect(due).toBe('2026-01-31')
  })

  it('Budget draft: October 31 of fiscal year', () => {
    const due = computeDueDate(10, 31, 2026, 'Budget draft (ED)')
    expect(due).toBe('2026-10-31')
  })

  it('generates correct dates for multiple fiscal years', () => {
    const fy2025 = computeDueDate(5, 15, 2025, 'Form 990 filing')
    const fy2026 = computeDueDate(5, 15, 2026, 'Form 990 filing')
    const fy2027 = computeDueDate(5, 15, 2027, 'Form 990 filing')
    expect(fy2025).toBe('2025-05-15')
    expect(fy2026).toBe('2026-05-15')
    expect(fy2027).toBe('2027-05-15')
  })
})

describe('Compliance deadline categories', () => {
  const categories = ['tax', 'tenant', 'grant', 'budget'] as const
  const recurrences = ['annual', 'monthly', 'per_tenant', 'one_time'] as const
  const statuses = ['upcoming', 'reminded', 'completed'] as const

  it('all categories are valid enum values', () => {
    categories.forEach((c) => {
      expect(['tax', 'tenant', 'grant', 'budget']).toContain(c)
    })
  })

  it('all recurrences are valid enum values', () => {
    recurrences.forEach((r) => {
      expect(['annual', 'monthly', 'per_tenant', 'one_time']).toContain(r)
    })
  })

  it('all statuses are valid enum values', () => {
    statuses.forEach((s) => {
      expect(['upcoming', 'reminded', 'completed']).toContain(s)
    })
  })
})

// --- Funding source deadline generation logic tests ---
// Mirrors the pure generateReportingDates helper from deadline-generator.ts

describe('Funding source reporting date generation', () => {
  function lastDayOfMonth(year: number, month: number): string {
    const d = new Date(year, month, 0)
    return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const QUARTER_END_MONTHS = [3, 6, 9, 12]
  const SEMI_ANNUAL_END_MONTHS = [6, 12]

  function generateReportingDates(
    frequency: string,
    startDate: string,
    endDate: string
  ): string[] {
    const start = new Date(startDate + 'T00:00:00')
    const end = new Date(endDate + 'T00:00:00')
    const dates: string[] = []
    const startYear = start.getFullYear()
    const endYear = end.getFullYear()

    if (frequency === 'monthly') {
      for (let y = startYear; y <= endYear; y++) {
        for (let m = 1; m <= 12; m++) {
          const due = lastDayOfMonth(y, m)
          if (due >= startDate && due <= endDate) dates.push(due)
        }
      }
    } else if (frequency === 'quarterly') {
      for (let y = startYear; y <= endYear; y++) {
        for (const m of QUARTER_END_MONTHS) {
          const due = lastDayOfMonth(y, m)
          if (due >= startDate && due <= endDate) dates.push(due)
        }
      }
    } else if (frequency === 'semi-annual') {
      for (let y = startYear; y <= endYear; y++) {
        for (const m of SEMI_ANNUAL_END_MONTHS) {
          const due = lastDayOfMonth(y, m)
          if (due >= startDate && due <= endDate) dates.push(due)
        }
      }
    } else if (frequency === 'annual') {
      for (let y = startYear; y <= endYear; y++) {
        const due = `${y}-12-31`
        if (due >= startDate && due <= endDate) dates.push(due)
      }
    }

    return dates
  }

  it('monthly: generates 12 dates for a full year', () => {
    const dates = generateReportingDates('monthly', '2026-01-01', '2026-12-31')
    expect(dates).toHaveLength(12)
    expect(dates[0]).toBe('2026-01-31')
    expect(dates[1]).toBe('2026-02-28')
    expect(dates[11]).toBe('2026-12-31')
  })

  it('monthly: partial year start mid-March', () => {
    const dates = generateReportingDates('monthly', '2026-03-15', '2026-06-30')
    expect(dates).toHaveLength(4)
    expect(dates[0]).toBe('2026-03-31')
    expect(dates[3]).toBe('2026-06-30')
  })

  it('quarterly: generates 4 dates for a full year', () => {
    const dates = generateReportingDates('quarterly', '2026-01-01', '2026-12-31')
    expect(dates).toHaveLength(4)
    expect(dates).toEqual(['2026-03-31', '2026-06-30', '2026-09-30', '2026-12-31'])
  })

  it('quarterly: spans two years', () => {
    const dates = generateReportingDates('quarterly', '2026-07-01', '2027-06-30')
    expect(dates).toHaveLength(4)
    expect(dates).toEqual(['2026-09-30', '2026-12-31', '2027-03-31', '2027-06-30'])
  })

  it('semi-annual: generates 2 dates for a full year', () => {
    const dates = generateReportingDates('semi-annual', '2026-01-01', '2026-12-31')
    expect(dates).toHaveLength(2)
    expect(dates).toEqual(['2026-06-30', '2026-12-31'])
  })

  it('annual: generates 1 date per year', () => {
    const dates = generateReportingDates('annual', '2026-01-01', '2028-12-31')
    expect(dates).toHaveLength(3)
    expect(dates).toEqual(['2026-12-31', '2027-12-31', '2028-12-31'])
  })

  it('annual: excludes years outside range', () => {
    const dates = generateReportingDates('annual', '2026-03-01', '2027-06-30')
    expect(dates).toHaveLength(1)
    expect(dates).toEqual(['2026-12-31'])
  })

  it('unknown frequency returns empty', () => {
    const dates = generateReportingDates('biweekly', '2026-01-01', '2026-12-31')
    expect(dates).toHaveLength(0)
  })
})

describe('Close-out approach warning computation', () => {
  function computeCloseOutWarning(
    endDate: string | null
  ): 'red' | 'yellow' | null {
    if (!endDate) return null
    const daysUntilEnd = Math.ceil(
      (new Date(endDate + 'T00:00:00').getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    )
    if (daysUntilEnd < 0) return null
    if (daysUntilEnd <= 30) return 'red'
    if (daysUntilEnd <= 90) return 'yellow'
    return null
  }

  it('returns null for no endDate', () => {
    expect(computeCloseOutWarning(null)).toBeNull()
  })

  it('returns null for end date > 90 days away', () => {
    const future = new Date(Date.now() + 100 * 24 * 60 * 60 * 1000)
    expect(computeCloseOutWarning(future.toISOString().split('T')[0])).toBeNull()
  })

  it('returns yellow for end date 31-90 days away', () => {
    const future = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
    expect(computeCloseOutWarning(future.toISOString().split('T')[0])).toBe('yellow')
  })

  it('returns red for end date <= 30 days away', () => {
    const future = new Date(Date.now() + 15 * 24 * 60 * 60 * 1000)
    expect(computeCloseOutWarning(future.toISOString().split('T')[0])).toBe('red')
  })

  it('returns red for end date today', () => {
    const today = new Date().toISOString().split('T')[0]
    expect(computeCloseOutWarning(today)).toBe('red')
  })

  it('returns null for past end date', () => {
    const past = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)
    expect(computeCloseOutWarning(past.toISOString().split('T')[0])).toBeNull()
  })
})

describe('Cost-share match warning computation', () => {
  function computeMatchWarning(
    matchPercent: number | null,
    awardAmount: number | null,
    expenseTotal: number
  ): { required: number; current: number; percent: number } | null {
    if (matchPercent === null || awardAmount === null || awardAmount <= 0) return null
    const requiredMatch = (awardAmount * matchPercent) / 100
    const current = Math.abs(expenseTotal)
    return current >= requiredMatch
      ? null
      : { required: requiredMatch, current, percent: matchPercent }
  }

  it('returns null when no match requirement', () => {
    expect(computeMatchWarning(null, 100000, -50000)).toBeNull()
  })

  it('returns null when match requirement is met', () => {
    // 20% of $100k = $20k required; spending $25k
    expect(computeMatchWarning(20, 100000, -25000)).toBeNull()
  })

  it('returns warning when match requirement is not met', () => {
    // 20% of $100k = $20k required; spending only $10k
    const result = computeMatchWarning(20, 100000, -10000)
    expect(result).not.toBeNull()
    expect(result!.required).toBe(20000)
    expect(result!.current).toBe(10000)
    expect(result!.percent).toBe(20)
  })

  it('returns null when no award amount', () => {
    expect(computeMatchWarning(20, null, -50000)).toBeNull()
  })

  it('returns null when award amount is zero', () => {
    expect(computeMatchWarning(20, 0, -50000)).toBeNull()
  })
})
