/**
 * FICA Calculator (Social Security + Medicare)
 *
 * Social Security: 6.2% up to annual wage base (both EE and ER)
 * Medicare: 1.45% on all wages (both EE and ER)
 * Additional Medicare: 0.9% on wages over $200,000 YTD (employee only)
 *
 * All rates read from annual_rate_config — never hardcoded.
 */

const ADDITIONAL_MEDICARE_RATE = 0.009 // 0.9%
const ADDITIONAL_MEDICARE_THRESHOLD = 200000 // $200,000 annual

export function calculateFICA(params: {
  monthlyGross: number
  ytdWages: number
  taxYear: number
  rates: {
    ssRate: number
    medicareRate: number
    ssWageBase: number
  }
}): {
  socialSecurityEmployee: number
  socialSecurityEmployer: number
  medicareEmployee: number
  medicareEmployer: number
} {
  const { monthlyGross, ytdWages, rates } = params

  // Social Security — capped at annual wage base
  const remainingWageBase = Math.max(0, rates.ssWageBase - ytdWages)
  const ssWages = Math.min(monthlyGross, remainingWageBase)
  const socialSecurityEmployee = Math.round(ssWages * rates.ssRate * 100) / 100
  const socialSecurityEmployer = Math.round(ssWages * rates.ssRate * 100) / 100

  // Medicare — no wage base cap
  let medicareEmployee = Math.round(monthlyGross * rates.medicareRate * 100) / 100
  const medicareEmployer = Math.round(monthlyGross * rates.medicareRate * 100) / 100

  // Additional Medicare Tax — employee only, on wages exceeding $200k YTD
  const ytdAfterThis = ytdWages + monthlyGross
  if (ytdAfterThis > ADDITIONAL_MEDICARE_THRESHOLD) {
    const wagesOverThreshold = Math.min(
      monthlyGross,
      ytdAfterThis - ADDITIONAL_MEDICARE_THRESHOLD
    )
    const additionalMedicare =
      Math.round(Math.max(0, wagesOverThreshold) * ADDITIONAL_MEDICARE_RATE * 100) / 100
    medicareEmployee += additionalMedicare
  }

  return {
    socialSecurityEmployee,
    socialSecurityEmployer,
    medicareEmployee,
    medicareEmployer,
  }
}
