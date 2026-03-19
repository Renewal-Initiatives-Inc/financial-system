import { describe, expect, it } from 'vitest'

/**
 * Tests for restricted/unrestricted fund balance split calculation.
 * Validates that restricted fund flows are correctly separated from unrestricted.
 */

describe('Restricted / Unrestricted Split', () => {
  interface WeekLine {
    effectiveAmount: number
    lineType: 'INFLOW' | 'OUTFLOW'
    fundRestrictionType: string | null
  }

  function calculateSplit(
    startingCash: number,
    weeks: { lines: WeekLine[]; netCashFlow: number }[]
  ) {
    let runningCash = startingCash
    let runningRestricted = 0

    return weeks.map((week) => {
      runningCash += week.netCashFlow

      const restrictedInflow = week.lines
        .filter((l) => l.lineType === 'INFLOW' && l.fundRestrictionType === 'RESTRICTED')
        .reduce((s, l) => s + l.effectiveAmount, 0)
      const restrictedOutflow = week.lines
        .filter((l) => l.lineType === 'OUTFLOW' && l.fundRestrictionType === 'RESTRICTED')
        .reduce((s, l) => s + l.effectiveAmount, 0)

      runningRestricted += restrictedInflow - restrictedOutflow
      const unrestricted = runningCash - runningRestricted

      return {
        endingCash: Math.round(runningCash * 100) / 100,
        restrictedBalance: Math.round(runningRestricted * 100) / 100,
        unrestrictedBalance: Math.round(unrestricted * 100) / 100,
      }
    })
  }

  it('all unrestricted when no restricted funds', () => {
    const result = calculateSplit(50000, [
      {
        netCashFlow: 2000,
        lines: [
          { effectiveAmount: 5000, lineType: 'INFLOW', fundRestrictionType: 'UNRESTRICTED' },
          { effectiveAmount: 3000, lineType: 'OUTFLOW', fundRestrictionType: 'UNRESTRICTED' },
        ],
      },
    ])

    expect(result[0].endingCash).toBe(52000)
    expect(result[0].restrictedBalance).toBe(0)
    expect(result[0].unrestrictedBalance).toBe(52000)
  })

  it('separates restricted inflows', () => {
    const result = calculateSplit(50000, [
      {
        netCashFlow: 10000,
        lines: [
          { effectiveAmount: 15000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
          { effectiveAmount: 5000, lineType: 'OUTFLOW', fundRestrictionType: 'UNRESTRICTED' },
        ],
      },
    ])

    expect(result[0].endingCash).toBe(60000)
    expect(result[0].restrictedBalance).toBe(15000)
    expect(result[0].unrestrictedBalance).toBe(45000) // 60000 - 15000
  })

  it('restricted outflows reduce restricted balance', () => {
    const result = calculateSplit(50000, [
      {
        netCashFlow: 5000, // 15000 in - 10000 out
        lines: [
          { effectiveAmount: 15000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
          { effectiveAmount: 10000, lineType: 'OUTFLOW', fundRestrictionType: 'RESTRICTED' },
        ],
      },
    ])

    expect(result[0].endingCash).toBe(55000)
    expect(result[0].restrictedBalance).toBe(5000) // 15000 - 10000
    expect(result[0].unrestrictedBalance).toBe(50000) // 55000 - 5000
  })

  it('accumulates restricted balance across weeks', () => {
    const result = calculateSplit(40000, [
      {
        netCashFlow: 5000,
        lines: [
          { effectiveAmount: 5000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
        ],
      },
      {
        netCashFlow: 3000,
        lines: [
          { effectiveAmount: 3000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
        ],
      },
    ])

    expect(result[0].restrictedBalance).toBe(5000)
    expect(result[1].restrictedBalance).toBe(8000) // 5000 + 3000
    expect(result[1].endingCash).toBe(48000) // 40000 + 5000 + 3000
    expect(result[1].unrestrictedBalance).toBe(40000) // 48000 - 8000
  })

  it('handles null fundRestrictionType as unrestricted', () => {
    const result = calculateSplit(30000, [
      {
        netCashFlow: 2000,
        lines: [
          { effectiveAmount: 2000, lineType: 'INFLOW', fundRestrictionType: null },
        ],
      },
    ])

    expect(result[0].restrictedBalance).toBe(0)
    expect(result[0].unrestrictedBalance).toBe(32000)
  })

  it('handles mixed restricted and unrestricted in same week', () => {
    const result = calculateSplit(50000, [
      {
        netCashFlow: 4000, // 8000 in - 4000 out
        lines: [
          { effectiveAmount: 5000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
          { effectiveAmount: 3000, lineType: 'INFLOW', fundRestrictionType: 'UNRESTRICTED' },
          { effectiveAmount: 2000, lineType: 'OUTFLOW', fundRestrictionType: 'RESTRICTED' },
          { effectiveAmount: 2000, lineType: 'OUTFLOW', fundRestrictionType: 'UNRESTRICTED' },
        ],
      },
    ])

    expect(result[0].endingCash).toBe(54000)
    expect(result[0].restrictedBalance).toBe(3000) // 5000 - 2000
    expect(result[0].unrestrictedBalance).toBe(51000) // 54000 - 3000
  })

  it('unrestricted can go negative (warning trigger)', () => {
    const result = calculateSplit(10000, [
      {
        netCashFlow: 20000,
        lines: [
          { effectiveAmount: 25000, lineType: 'INFLOW', fundRestrictionType: 'RESTRICTED' },
          { effectiveAmount: 5000, lineType: 'OUTFLOW', fundRestrictionType: 'UNRESTRICTED' },
        ],
      },
    ])

    expect(result[0].endingCash).toBe(30000) // 10000 + 20000
    expect(result[0].restrictedBalance).toBe(25000)
    expect(result[0].unrestrictedBalance).toBe(5000) // 30000 - 25000
  })
})
