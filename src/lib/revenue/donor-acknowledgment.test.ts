import { describe, expect, it } from 'vitest'
import { shouldSendAcknowledgment, buildAcknowledgmentData } from './donor-acknowledgment'

describe('shouldSendAcknowledgment', () => {
  it('returns true for amount > $250', () => {
    expect(shouldSendAcknowledgment(250.01)).toBe(true)
    expect(shouldSendAcknowledgment(500)).toBe(true)
    expect(shouldSendAcknowledgment(1000)).toBe(true)
  })

  it('returns false for amount = $250 (strictly greater than)', () => {
    expect(shouldSendAcknowledgment(250)).toBe(false)
  })

  it('returns false for amount < $250', () => {
    expect(shouldSendAcknowledgment(249.99)).toBe(false)
    expect(shouldSendAcknowledgment(100)).toBe(false)
    expect(shouldSendAcknowledgment(0)).toBe(false)
  })
})

describe('buildAcknowledgmentData', () => {
  it('includes all required fields', () => {
    const data = buildAcknowledgmentData(
      'Jane Doe',
      'jane@example.com',
      '2026-01-15',
      '500.00',
      'General Fund'
    )
    expect(data.donorName).toBe('Jane Doe')
    expect(data.donorEmail).toBe('jane@example.com')
    expect(data.donationDate).toBe('2026-01-15')
    expect(data.donationAmount).toBe('500.00')
    expect(data.fundName).toBe('General Fund')
    expect(data.noGoodsOrServicesStatement).toContain('No goods or services')
  })

  it('handles null email', () => {
    const data = buildAcknowledgmentData(
      'John Smith',
      null,
      '2026-02-01',
      '1000.00',
      'Building Fund'
    )
    expect(data.donorEmail).toBeNull()
  })
})
