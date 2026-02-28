import { describe, it, expect } from 'vitest'
import {
  formatCurrency,
  formatPercent,
  formatNumber,
  formatDate,
  formatDateTime,
  getCurrentMonthRange,
  getYTDRange,
  getFiscalYearRange,
  getMonthRange,
  getQuarterRange,
  REPORT_DEFINITIONS,
  CATEGORY_LABELS,
} from '../types'

// ---------------------------------------------------------------------------
// formatCurrency
// ---------------------------------------------------------------------------

describe('formatCurrency', () => {
  it('formats positive numbers as USD', () => {
    expect(formatCurrency(1234.56)).toBe('$1,234.56')
  })

  it('formats zero', () => {
    expect(formatCurrency(0)).toBe('$0.00')
  })

  it('wraps negatives in parentheses (accounting style)', () => {
    const result = formatCurrency(-500.25)
    expect(result).toContain('500.25')
    expect(result.startsWith('(')).toBe(true)
    expect(result.endsWith(')')).toBe(true)
  })

  it('handles large amounts with commas', () => {
    expect(formatCurrency(1234567.89)).toBe('$1,234,567.89')
  })

  it('formats small amounts', () => {
    expect(formatCurrency(0.01)).toBe('$0.01')
  })

  it('rounds to 2 decimal places', () => {
    const result = formatCurrency(1.999)
    expect(result).toContain('2.00')
  })
})

// ---------------------------------------------------------------------------
// formatPercent
// ---------------------------------------------------------------------------

describe('formatPercent', () => {
  it('formats positive percent with + prefix', () => {
    expect(formatPercent(10.5)).toBe('+10.5%')
  })

  it('formats negative percent', () => {
    expect(formatPercent(-5.3)).toBe('-5.3%')
  })

  it('formats zero with + prefix', () => {
    expect(formatPercent(0)).toBe('+0.0%')
  })

  it('returns N/A for null', () => {
    expect(formatPercent(null)).toBe('N/A')
  })

  it('rounds to 1 decimal', () => {
    expect(formatPercent(33.333)).toBe('+33.3%')
  })
})

// ---------------------------------------------------------------------------
// formatNumber
// ---------------------------------------------------------------------------

describe('formatNumber', () => {
  it('formats integer with no decimals by default', () => {
    expect(formatNumber(1234)).toBe('1,234')
  })

  it('formats with specified decimals', () => {
    expect(formatNumber(1234.5678, 2)).toBe('1,234.57')
  })

  it('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })
})

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('formats date string to readable format', () => {
    const result = formatDate('2026-01-15T12:00:00')
    expect(result).toContain('Jan')
    expect(result).toContain('15')
    expect(result).toContain('2026')
  })

  it('accepts Date object', () => {
    const result = formatDate(new Date(2026, 5, 30)) // June 30, local time
    expect(result).toContain('Jun')
    expect(result).toContain('2026')
  })
})

// ---------------------------------------------------------------------------
// formatDateTime
// ---------------------------------------------------------------------------

describe('formatDateTime', () => {
  it('includes time component', () => {
    const result = formatDateTime('2026-02-14T15:30:00')
    expect(result).toContain('Feb')
    expect(result).toContain('14')
    expect(result).toContain('2026')
  })
})

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

describe('getCurrentMonthRange', () => {
  it('returns start and end of current month', () => {
    const { startDate, endDate } = getCurrentMonthRange()
    expect(startDate).toMatch(/^\d{4}-\d{2}-01$/)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    // start should be before or equal to end
    expect(startDate <= endDate).toBe(true)
  })

  it('first day is always 01', () => {
    const { startDate } = getCurrentMonthRange()
    expect(startDate.endsWith('-01')).toBe(true)
  })
})

describe('getYTDRange', () => {
  it('starts on Jan 1 of current year', () => {
    const { startDate, endDate } = getYTDRange()
    const year = new Date().getFullYear()
    expect(startDate).toBe(`${year}-01-01`)
    expect(endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('end date is today or earlier', () => {
    const { endDate } = getYTDRange()
    const today = new Date().toISOString().split('T')[0]
    expect(endDate <= today).toBe(true)
  })
})

describe('getFiscalYearRange', () => {
  it('defaults to current year calendar year', () => {
    const year = new Date().getFullYear()
    const range = getFiscalYearRange()
    expect(range.startDate).toBe(`${year}-01-01`)
    expect(range.endDate).toBe(`${year}-12-31`)
  })

  it('respects specified year', () => {
    const range = getFiscalYearRange(2025)
    expect(range.startDate).toBe('2025-01-01')
    expect(range.endDate).toBe('2025-12-31')
  })
})

describe('getMonthRange', () => {
  it('returns first and last day of month', () => {
    const range = getMonthRange(2026, 2)
    expect(range.startDate).toBe('2026-02-01')
    expect(range.endDate).toBe('2026-02-28')
  })

  it('handles leap year February', () => {
    const range = getMonthRange(2024, 2)
    expect(range.endDate).toBe('2024-02-29')
  })

  it('handles 31-day months', () => {
    const range = getMonthRange(2026, 1)
    expect(range.startDate).toBe('2026-01-01')
    expect(range.endDate).toBe('2026-01-31')
  })

  it('handles 30-day months', () => {
    const range = getMonthRange(2026, 4)
    expect(range.endDate).toBe('2026-04-30')
  })
})

describe('getQuarterRange', () => {
  it('Q1 is Jan-Mar', () => {
    const range = getQuarterRange(2026, 1)
    expect(range.startDate).toBe('2026-01-01')
    expect(range.endDate).toBe('2026-03-31')
  })

  it('Q2 is Apr-Jun', () => {
    const range = getQuarterRange(2026, 2)
    expect(range.startDate).toBe('2026-04-01')
    expect(range.endDate).toBe('2026-06-30')
  })

  it('Q3 is Jul-Sep', () => {
    const range = getQuarterRange(2026, 3)
    expect(range.startDate).toBe('2026-07-01')
    expect(range.endDate).toBe('2026-09-30')
  })

  it('Q4 is Oct-Dec', () => {
    const range = getQuarterRange(2026, 4)
    expect(range.startDate).toBe('2026-10-01')
    expect(range.endDate).toBe('2026-12-31')
  })
})

// ---------------------------------------------------------------------------
// Report definitions
// ---------------------------------------------------------------------------

describe('REPORT_DEFINITIONS', () => {
  it('has 28 available reports (Phase 15 + Phase 16, minus 2 AHP + amortization schedule)', () => {
    const available = REPORT_DEFINITIONS.filter((r) => r.isAvailable)
    expect(available.length).toBe(28)
  })

  it('has coming-soon Phase 16 reports', () => {
    const comingSoon = REPORT_DEFINITIONS.filter((r) => !r.isAvailable)
    expect(comingSoon.length).toBeGreaterThan(0)
  })

  it('all slugs are unique', () => {
    const slugs = REPORT_DEFINITIONS.map((r) => r.slug)
    expect(new Set(slugs).size).toBe(slugs.length)
  })

  it('all categories have labels', () => {
    const categories = [...new Set(REPORT_DEFINITIONS.map((r) => r.category))]
    for (const cat of categories) {
      expect(CATEGORY_LABELS[cat]).toBeDefined()
    }
  })

  it('every report has title and description', () => {
    for (const r of REPORT_DEFINITIONS) {
      expect(r.title.length).toBeGreaterThan(0)
      expect(r.description.length).toBeGreaterThan(0)
    }
  })
})
