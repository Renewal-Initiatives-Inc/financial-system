/**
 * Massachusetts State Income Tax Calculator
 * MA DOR Circular M 2026 percentage method.
 *
 * Algorithm (monthly pay period):
 * 1. Start with monthly gross
 * 2. Subtract exemptions based on allowances
 * 3. Annualize the result
 * 4. Apply tax rates (5% base, +4% surtax above threshold)
 * 5. De-annualize
 * 6. Subtract credits (HoH, blindness)
 * 7. Add additional withholding
 * 8. Floor at $0
 */

// Exemption formula constants (rarely change — in code, not DB)
const SINGLE_ALLOWANCE_ANNUAL = 4400 // $4,400/year for 1 allowance
const ADDITIONAL_ALLOWANCE_BASE = 3400 // $3,400 base for N>1
const ADDITIONAL_ALLOWANCE_PER = 1000 // $1,000 per allowance for N>1

// Monthly credits
const HOH_MONTHLY_CREDIT = 10.0 // $120/year = $10/month
const BLINDNESS_MONTHLY_CREDIT = 9.17 // $110/year ≈ $9.17/month

function calculateAnnualExemption(allowances: number): number {
  if (allowances <= 0) return 0
  if (allowances === 1) return SINGLE_ALLOWANCE_ANNUAL
  return ADDITIONAL_ALLOWANCE_PER * allowances + ADDITIONAL_ALLOWANCE_BASE
}

export function calculateMAWithholding(params: {
  monthlyGross: number
  allowances: number
  isHeadOfHousehold: boolean
  isBlind: boolean
  spouseIsBlind: boolean
  additionalWithholding: number
  taxYear: number
  rates: {
    stateRate: number
    surtaxRate: number
    surtaxThreshold: number
  }
}): number {
  const {
    monthlyGross,
    allowances,
    isHeadOfHousehold,
    isBlind,
    spouseIsBlind,
    additionalWithholding,
    rates,
  } = params

  // Step 1-2: Subtract monthly exemption
  const annualExemption = calculateAnnualExemption(allowances)
  const monthlyExemption = annualExemption / 12
  const adjustedMonthlyGross = monthlyGross - monthlyExemption

  if (adjustedMonthlyGross <= 0) {
    return Math.max(0, additionalWithholding)
  }

  // Step 3: Annualize
  const annualizedWages = adjustedMonthlyGross * 12

  // Step 4: Apply tax rates
  let annualTax: number
  if (annualizedWages <= rates.surtaxThreshold) {
    annualTax = annualizedWages * rates.stateRate
  } else {
    // Base rate on full amount + surtax on amount over threshold
    annualTax =
      annualizedWages * rates.stateRate +
      (annualizedWages - rates.surtaxThreshold) * rates.surtaxRate
  }

  // Step 5: De-annualize
  let monthlyTax = annualTax / 12

  // Step 6: Subtract credits
  if (isHeadOfHousehold) {
    monthlyTax -= HOH_MONTHLY_CREDIT
  }
  if (isBlind) {
    monthlyTax -= BLINDNESS_MONTHLY_CREDIT
  }
  if (spouseIsBlind) {
    monthlyTax -= BLINDNESS_MONTHLY_CREDIT
  }

  // Step 7: Add additional withholding
  monthlyTax += additionalWithholding

  // Step 8: Floor at $0
  return Math.max(0, Math.round(monthlyTax * 100) / 100)
}
