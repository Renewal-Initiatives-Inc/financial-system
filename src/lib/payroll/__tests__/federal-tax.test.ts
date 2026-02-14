import { describe, it, expect } from 'vitest'
import { calculateFederalWithholding } from '../federal-tax'

const defaults = {
  additionalDeductions: 0,
  additionalIncome: 0,
  additionalWithholding: 0,
  taxYear: 2026,
}

describe('calculateFederalWithholding', () => {
  it('calculates for single filer at $3,000/month', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 3000,
      filingStatus: 'single',
    })
    // Annual: $36,000 - $8,600 std deduction = $27,400 taxable
    // $7,500 at 0% = $0
    // $19,900-$7,500 at 10% = $1,240 → but bracket says plus $0 at 10%
    // Actually: $27,400 is in the 12% bracket ($19,900-$57,900, plus $1,240)
    // Tax = $1,240 + ($27,400 - $19,900) × 0.12 = $1,240 + $900 = $2,140
    // Monthly = $2,140 / 12 = $178.33
    expect(result).toBeCloseTo(178.33, 1)
  })

  it('calculates for single filer at $8,000/month (crosses brackets)', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 8000,
      filingStatus: 'single',
    })
    // Annual: $96,000 - $8,600 = $87,400 taxable
    // In 22% bracket ($57,900-$113,200, plus $5,800)
    // Tax = $5,800 + ($87,400 - $57,900) × 0.22 = $5,800 + $6,490 = $12,290
    // Monthly = $12,290 / 12 = $1,024.17
    expect(result).toBeCloseTo(1024.17, 1)
  })

  it('calculates for married filer at $5,000/month (lower bracket)', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 5000,
      filingStatus: 'married',
    })
    // Annual: $60,000 - $12,900 = $47,100 taxable
    // In 12% bracket ($44,100-$120,100, plus $2,480)
    // Tax = $2,480 + ($47,100 - $44,100) × 0.12 = $2,480 + $360 = $2,840
    // Monthly = $2,840 / 12 = $236.67
    expect(result).toBeCloseTo(236.67, 1)
  })

  it('calculates for married filer at $15,000/month (higher bracket)', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 15000,
      filingStatus: 'married',
    })
    // Annual: $180,000 - $12,900 = $167,100 taxable
    // In 22% bracket ($120,100-$230,700, plus $11,600)
    // Tax = $11,600 + ($167,100 - $120,100) × 0.22 = $11,600 + $10,340 = $21,940
    // Monthly = $21,940 / 12 = $1,828.33
    expect(result).toBeCloseTo(1828.33, 1)
  })

  it('calculates for head of household at $4,500/month', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 4500,
      filingStatus: 'head_of_household',
    })
    // Annual: $54,000 - $8,600 = $45,400 taxable
    // In 12% bracket ($33,250-$83,000, plus $1,770)
    // Tax = $1,770 + ($45,400 - $33,250) × 0.12 = $1,770 + $1,458 = $3,228
    // Monthly = $3,228 / 12 = $269
    expect(result).toBeCloseTo(269, 0)
  })

  it('returns $0 for zero income', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 0,
      filingStatus: 'single',
    })
    expect(result).toBe(0)
  })

  it('handles high income (top bracket)', () => {
    const result = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 60000,
      filingStatus: 'single',
    })
    // Annual: $720,000 - $8,600 = $711,400 taxable
    // In 37% bracket ($648,100+, plus $192,979.25)
    // Tax = $192,979.25 + ($711,400 - $648,100) × 0.37
    //      = $192,979.25 + $23,421 = $216,400.25
    // Monthly = $216,400.25 / 12 = $18,033.35
    expect(result).toBeCloseTo(18033.35, 0)
  })

  it('adds W-4 Step 4(c) additional withholding', () => {
    const base = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 5000,
      filingStatus: 'single',
    })
    const withExtra = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 5000,
      filingStatus: 'single',
      additionalWithholding: 100,
    })
    expect(withExtra).toBeCloseTo(base + 100, 1)
  })

  it('reduces withholding with W-4 Step 4(b) deductions', () => {
    const base = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 5000,
      filingStatus: 'single',
    })
    const withDeductions = calculateFederalWithholding({
      ...defaults,
      monthlyGross: 5000,
      filingStatus: 'single',
      additionalDeductions: 5000, // $5,000 annual additional deduction
    })
    expect(withDeductions).toBeLessThan(base)
  })
})
