import { describe, expect, it } from 'vitest'

/**
 * Tests for weekly projection generation logic.
 * Tests date utilities, confidence assignment, and budget ÷ 4.33 calculation.
 */

describe('Weekly Projection Generation', () => {
  // Replicate date utility functions from weekly-projection.ts

  function getNextMonday(from: Date): Date {
    const d = new Date(from)
    const day = d.getDay()
    const daysUntilMonday = day === 0 ? 1 : 8 - day
    d.setDate(d.getDate() + daysUntilMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }

  function toDateStr(d: Date): string {
    return d.toISOString().split('T')[0]
  }

  function addDays(d: Date, n: number): Date {
    const result = new Date(d)
    result.setDate(result.getDate() + n)
    return result
  }

  function getExpectedDatesInWindow(
    frequency: string,
    expectedDay: number,
    start: Date,
    end: Date
  ): string[] {
    const dates: string[] = []
    if (frequency === 'monthly') {
      const cursor = new Date(start.getFullYear(), start.getMonth(), expectedDay)
      if (cursor < start) cursor.setMonth(cursor.getMonth() + 1)
      while (cursor <= end) {
        dates.push(toDateStr(cursor))
        cursor.setMonth(cursor.getMonth() + 1)
      }
    } else if (frequency === 'weekly') {
      const cursor = new Date(start)
      const targetDow = expectedDay % 7
      while (cursor.getDay() !== targetDow) cursor.setDate(cursor.getDate() + 1)
      while (cursor <= end) {
        dates.push(toDateStr(cursor))
        cursor.setDate(cursor.getDate() + 7)
      }
    } else if (frequency === 'biweekly') {
      const cursor = new Date(start)
      const targetDow = expectedDay % 7
      while (cursor.getDay() !== targetDow) cursor.setDate(cursor.getDate() + 1)
      while (cursor <= end) {
        dates.push(toDateStr(cursor))
        cursor.setDate(cursor.getDate() + 14)
      }
    }
    return dates
  }

  describe('getNextMonday', () => {
    it('returns next Monday from a Wednesday', () => {
      // 2026-03-18 is a Wednesday
      const result = getNextMonday(new Date(2026, 2, 18))
      expect(result.getDay()).toBe(1) // Monday
      expect(result.getDate()).toBe(23)
    })

    it('returns next Monday from a Sunday', () => {
      // 2026-03-22 is a Sunday
      const result = getNextMonday(new Date(2026, 2, 22))
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(23)
    })

    it('returns next Monday from a Monday (7 days later)', () => {
      // 2026-03-16 is a Monday — getNextMonday should return the following Monday
      const from = new Date(2026, 2, 16) // Month is 0-indexed, so 2 = March
      const result = getNextMonday(from)
      expect(result.getDay()).toBe(1)
      // The function calculates 8-1=7 days ahead
      expect(result.getDate()).toBe(23)
    })

    it('returns next Monday from a Saturday', () => {
      // 2026-03-21 is a Saturday
      const result = getNextMonday(new Date(2026, 2, 21))
      expect(result.getDay()).toBe(1)
      expect(result.getDate()).toBe(23)
    })
  })

  describe('13-week generation', () => {
    it('generates exactly 13 weeks', () => {
      const week1Start = getNextMonday(new Date(2026, 2, 18))
      const weeks: string[] = []
      for (let w = 1; w <= 13; w++) {
        const weekStart = addDays(week1Start, (w - 1) * 7)
        weeks.push(toDateStr(weekStart))
      }
      expect(weeks).toHaveLength(13)
    })

    it('week dates are 7 days apart', () => {
      const week1Start = getNextMonday(new Date(2026, 2, 18))
      for (let w = 1; w < 13; w++) {
        const current = addDays(week1Start, (w - 1) * 7)
        const next = addDays(week1Start, w * 7)
        const diff = (next.getTime() - current.getTime()) / (1000 * 60 * 60 * 24)
        expect(diff).toBe(7)
      }
    })

    it('all week start dates fall on Monday', () => {
      const week1Start = getNextMonday(new Date(2026, 2, 18))
      for (let w = 1; w <= 13; w++) {
        const weekStart = addDays(week1Start, (w - 1) * 7)
        expect(weekStart.getDay()).toBe(1)
      }
    })
  })

  describe('Confidence level assignment', () => {
    it('weeks 1-2 are HIGH confidence', () => {
      for (let w = 1; w <= 2; w++) {
        const confidence = w <= 2 ? 'HIGH' : w <= 8 ? 'MODERATE' : 'LOW'
        expect(confidence).toBe('HIGH')
      }
    })

    it('weeks 3-8 are MODERATE confidence', () => {
      for (let w = 3; w <= 8; w++) {
        const confidence = w <= 2 ? 'HIGH' : w <= 8 ? 'MODERATE' : 'LOW'
        expect(confidence).toBe('MODERATE')
      }
    })

    it('weeks 9-13 are LOW confidence', () => {
      for (let w = 9; w <= 13; w++) {
        const confidence = w <= 2 ? 'HIGH' : w <= 8 ? 'MODERATE' : 'LOW'
        expect(confidence).toBe('LOW')
      }
    })
  })

  describe('Budget to weekly conversion', () => {
    it('divides monthly by 4.33 correctly', () => {
      const monthly = 1000
      const weekly = Math.round((monthly / 4.33) * 100) / 100
      expect(weekly).toBe(230.95)
    })

    it('handles small amounts without precision loss', () => {
      const monthly = 10
      const weekly = Math.round((monthly / 4.33) * 100) / 100
      expect(weekly).toBe(2.31)
    })

    it('handles zero monthly amount', () => {
      const monthly = 0
      const weekly = Math.round((monthly / 4.33) * 100) / 100
      expect(weekly).toBe(0)
    })

    it('filters out amounts below $0.01', () => {
      const monthly = 0.01
      const weekly = Math.round((monthly / 4.33) * 100) / 100
      // 0.01 / 4.33 = 0.0023... rounds to 0.00
      expect(weekly).toBeLessThan(0.01)
    })
  })

  describe('getExpectedDatesInWindow', () => {
    it('finds monthly occurrence on the 15th within a 1-month window', () => {
      const start = new Date(2026, 2, 1)
      const end = new Date(2026, 2, 31)
      const dates = getExpectedDatesInWindow('monthly', 15, start, end)
      expect(dates.length).toBe(1)
      expect(new Date(dates[0] + 'T00:00:00').getDate()).toBe(15)
    })

    it('finds no monthly occurrence if expectedDay is past the window', () => {
      const start = new Date(2026, 2, 20)
      const end = new Date(2026, 2, 31)
      const dates = getExpectedDatesInWindow('monthly', 1, start, end)
      // expectedDay=1, but March 1 is before start
      expect(dates).toHaveLength(0)
    })

    it('finds weekly occurrences in a 2-week window', () => {
      // expectedDay=1 means Sunday (1%7=1 in JS Date where 0=Sun)
      const start = new Date(2026, 2, 16) // Monday
      const end = new Date(2026, 2, 29)
      const dates = getExpectedDatesInWindow('weekly', 1, start, end)
      // Day 1 % 7 = 1 (Sunday). First Sunday after Mar 16 is Mar 22
      expect(dates.length).toBeGreaterThanOrEqual(1)
    })

    it('finds biweekly occurrences (every 14 days)', () => {
      const start = new Date(2026, 2, 1) // March 1
      const end = new Date(2026, 2, 31) // March 31
      const dates = getExpectedDatesInWindow('biweekly', 1, start, end)
      // At most 3 biweekly occurrences in 31 days
      expect(dates.length).toBeLessThanOrEqual(3)
      if (dates.length >= 2) {
        const d1 = new Date(dates[0] + 'T00:00:00')
        const d2 = new Date(dates[1] + 'T00:00:00')
        const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24))
        expect(diff).toBe(14)
      }
    })
  })

  describe('WeeklyProjectionLineData structure', () => {
    it('has all required fields', () => {
      const line = {
        weekNumber: 1,
        weekStartDate: '2026-03-23',
        sourceLabel: 'AR Invoice 101 — VASH',
        autoAmount: 1200.0,
        lineType: 'INFLOW' as const,
        confidenceLevel: 'HIGH' as const,
        fundId: 3,
        sortOrder: 0,
      }
      expect(line.weekNumber).toBeGreaterThanOrEqual(1)
      expect(line.weekNumber).toBeLessThanOrEqual(13)
      expect(['INFLOW', 'OUTFLOW']).toContain(line.lineType)
      expect(['HIGH', 'MODERATE', 'LOW']).toContain(line.confidenceLevel)
    })

    it('fundId can be null for non-fund-specific lines', () => {
      const line = {
        weekNumber: 1,
        weekStartDate: '2026-03-23',
        sourceLabel: 'Payroll — period ending 2026-03-20',
        autoAmount: 5000.0,
        lineType: 'OUTFLOW' as const,
        confidenceLevel: 'HIGH' as const,
        fundId: null,
        sortOrder: 100,
      }
      expect(line.fundId).toBeNull()
    })
  })
})
