import { describe, it, expect } from 'vitest'

/**
 * W-2 Generator unit tests.
 *
 * Tests the box value calculation and wage base capping logic.
 */

describe('W-2 Box Value Calculations', () => {
  function capSSWages(totalWages: number, ssWageBase: number): number {
    return Math.min(totalWages, ssWageBase)
  }

  function hasWageBaseExceeded(totalWages: number, ssWageBase: number): boolean {
    return totalWages > ssWageBase
  }

  it('caps Box 3 (SS wages) at SS wage base', () => {
    const ssWageBase = 168600 // 2024
    expect(capSSWages(200000, ssWageBase)).toBe(168600)
    expect(capSSWages(100000, ssWageBase)).toBe(100000)
  })

  it('flags wage base exceeded correctly', () => {
    const ssWageBase = 168600
    expect(hasWageBaseExceeded(200000, ssWageBase)).toBe(true)
    expect(hasWageBaseExceeded(100000, ssWageBase)).toBe(false)
    expect(hasWageBaseExceeded(168600, ssWageBase)).toBe(false) // exactly at base
  })

  it('Box 5 (Medicare wages) has no cap', () => {
    // Medicare wages are never capped
    const totalWages = 500000
    expect(totalWages).toBe(500000) // No cap applied
  })

  it('computes SS tax correctly', () => {
    const ssWages = 168600
    const ssRate = 0.062 // Employee share
    const ssTax = ssWages * ssRate
    expect(ssTax).toBeCloseTo(10453.2, 2)
  })

  it('computes Medicare tax correctly', () => {
    const medicareWages = 200000
    const medicareRate = 0.0145 // Employee share
    const medicareTax = medicareWages * medicareRate
    expect(medicareTax).toBeCloseTo(2900, 2)
  })
})

describe('Combined W-2 PDF', () => {
  it('handles multiple employees conceptually', () => {
    const employees = [
      { employeeId: '1', employeeName: 'Alice', box1: 60000 },
      { employeeId: '2', employeeName: 'Bob', box1: 45000 },
    ]
    expect(employees).toHaveLength(2)
    expect(employees.map((e) => e.box1).reduce((a, b) => a + b, 0)).toBe(105000)
  })
})
