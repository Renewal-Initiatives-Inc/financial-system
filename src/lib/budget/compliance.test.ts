import { describe, it, expect } from 'vitest'
import { getBudgetCycleDeadlines, BUDGET_CYCLE_MILESTONES } from './compliance'

describe('getBudgetCycleDeadlines', () => {
  it('generates 4 deadlines for a given FY', () => {
    const deadlines = getBudgetCycleDeadlines(2027)
    expect(deadlines).toHaveLength(4)
  })

  it('uses the calendar year before the budget FY', () => {
    const deadlines = getBudgetCycleDeadlines(2027)
    // FY2027 budget cycle happens in calendar year 2026
    expect(deadlines[0].dueDate).toContain('2026')
    expect(deadlines[3].dueDate).toContain('2026')
  })

  it('has correct months: Sept, Oct, Nov, Dec', () => {
    const deadlines = getBudgetCycleDeadlines(2027)
    expect(deadlines.map((d) => d.month)).toEqual([9, 10, 11, 12])
  })

  it('preserves milestone labels', () => {
    const deadlines = getBudgetCycleDeadlines(2027)
    expect(deadlines[0].label).toBe(BUDGET_CYCLE_MILESTONES[0].label)
    expect(deadlines[3].label).toBe(BUDGET_CYCLE_MILESTONES[3].label)
  })

  it('includes the target fiscal year on each deadline', () => {
    const deadlines = getBudgetCycleDeadlines(2028)
    deadlines.forEach((d) => expect(d.fiscalYear).toBe(2028))
  })

  it('formats due dates as YYYY-MM-15', () => {
    const deadlines = getBudgetCycleDeadlines(2027)
    expect(deadlines[0].dueDate).toBe('2026-09-15')
    expect(deadlines[1].dueDate).toBe('2026-10-15')
    expect(deadlines[2].dueDate).toBe('2026-11-15')
    expect(deadlines[3].dueDate).toBe('2026-12-15')
  })
})
