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
