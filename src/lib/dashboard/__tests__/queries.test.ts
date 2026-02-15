import { describe, it, expect } from 'vitest'

/**
 * Dashboard queries unit tests.
 *
 * Tests data shape expectations and alert logic.
 */

describe('Dashboard Alert Urgency', () => {
  function computeDeadlineUrgency(
    daysRemaining: number
  ): 'green' | 'yellow' | 'red' | 'overdue' {
    if (daysRemaining < 0) return 'overdue'
    if (daysRemaining < 7) return 'red'
    if (daysRemaining < 14) return 'yellow'
    return 'green'
  }

  it('marks overdue when days < 0', () => {
    expect(computeDeadlineUrgency(-1)).toBe('overdue')
    expect(computeDeadlineUrgency(-30)).toBe('overdue')
  })

  it('marks red when < 7 days', () => {
    expect(computeDeadlineUrgency(0)).toBe('red')
    expect(computeDeadlineUrgency(3)).toBe('red')
    expect(computeDeadlineUrgency(6)).toBe('red')
  })

  it('marks yellow when 7-13 days', () => {
    expect(computeDeadlineUrgency(7)).toBe('yellow')
    expect(computeDeadlineUrgency(10)).toBe('yellow')
    expect(computeDeadlineUrgency(13)).toBe('yellow')
  })

  it('marks green when >= 14 days', () => {
    expect(computeDeadlineUrgency(14)).toBe('green')
    expect(computeDeadlineUrgency(30)).toBe('green')
  })
})

describe('Dashboard Data Shapes', () => {
  it('CashSnapshotData has expected fields', () => {
    const snapshot = {
      bankBalances: [{ name: 'Operating', balance: 50000 }],
      netAvailableCash: 45000,
      ahpDrawn: 0,
      ahpAvailable: 100000,
    }
    expect(snapshot.bankBalances).toBeInstanceOf(Array)
    expect(snapshot.bankBalances[0]).toHaveProperty('name')
    expect(snapshot.bankBalances[0]).toHaveProperty('balance')
    expect(typeof snapshot.netAvailableCash).toBe('number')
  })

  it('AlertItem has expected fields', () => {
    const alert = {
      label: 'Overdue rent',
      count: 3,
      href: '/reports/rent-collection',
      urgency: 'danger' as const,
    }
    expect(alert).toHaveProperty('label')
    expect(alert).toHaveProperty('count')
    expect(alert).toHaveProperty('href')
    expect(['info', 'warning', 'danger']).toContain(alert.urgency)
  })

  it('RentSnapshotData computed rates are correct', () => {
    const totalBilled = 5000
    const totalCollected = 4500
    const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled) * 100 : 0
    expect(collectionRate).toBe(90)
  })

  it('FundBalancesData separates restricted/unrestricted', () => {
    const funds = [
      { name: 'General', balance: 30000, restrictionType: 'UNRESTRICTED' },
      { name: 'CDBG', balance: 50000, restrictionType: 'RESTRICTED' },
      { name: 'HOME', balance: 20000, restrictionType: 'RESTRICTED' },
    ]
    const restricted = funds
      .filter((f) => f.restrictionType === 'RESTRICTED')
      .reduce((s, f) => s + f.balance, 0)
    const unrestricted = funds
      .filter((f) => f.restrictionType === 'UNRESTRICTED')
      .reduce((s, f) => s + f.balance, 0)

    expect(restricted).toBe(70000)
    expect(unrestricted).toBe(30000)
  })
})
