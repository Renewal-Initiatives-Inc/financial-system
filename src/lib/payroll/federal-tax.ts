/**
 * Federal Income Tax Calculator
 * IRS Publication 15-T percentage method for 2026.
 *
 * Algorithm (monthly pay period):
 * 1. Annualize monthly gross × 12
 * 2. Subtract standard deduction by filing status
 * 3. Subtract W-4 Step 4(b) additional deductions
 * 4. Apply bracket rates
 * 5. Add W-4 Step 4(a) additional income
 * 6. De-annualize: divide by 12
 * 7. Add Step 4(c) additional withholding per period
 * 8. Floor at $0
 */

interface TaxBracket {
  over: number
  notOver: number | null // null = no upper limit
  rate: number
  plus: number
}

type BracketTable = Record<string, TaxBracket[]>

// 2026 Federal Tax Brackets (Annual, Percentage Method) — IRS Pub 15-T
const BRACKETS_2026: BracketTable = {
  single: [
    { over: 0, notOver: 7500, rate: 0, plus: 0 },
    { over: 7500, notOver: 19900, rate: 0.1, plus: 0 },
    { over: 19900, notOver: 57900, rate: 0.12, plus: 1240 },
    { over: 57900, notOver: 113200, rate: 0.22, plus: 5800 },
    { over: 113200, notOver: 209275, rate: 0.24, plus: 17966 },
    { over: 209275, notOver: 263725, rate: 0.32, plus: 41024 },
    { over: 263725, notOver: 648100, rate: 0.35, plus: 58448 },
    { over: 648100, notOver: null, rate: 0.37, plus: 192979.25 },
  ],
  married: [
    { over: 0, notOver: 19300, rate: 0, plus: 0 },
    { over: 19300, notOver: 44100, rate: 0.1, plus: 0 },
    { over: 44100, notOver: 120100, rate: 0.12, plus: 2480 },
    { over: 120100, notOver: 230700, rate: 0.22, plus: 11600 },
    { over: 230700, notOver: 422850, rate: 0.24, plus: 35932 },
    { over: 422850, notOver: 531750, rate: 0.32, plus: 82048 },
    { over: 531750, notOver: 788000, rate: 0.35, plus: 116896 },
    { over: 788000, notOver: null, rate: 0.37, plus: 206583.5 },
  ],
  head_of_household: [
    { over: 0, notOver: 15550, rate: 0, plus: 0 },
    { over: 15550, notOver: 33250, rate: 0.1, plus: 0 },
    { over: 33250, notOver: 83000, rate: 0.12, plus: 1770 },
    { over: 83000, notOver: 121250, rate: 0.22, plus: 7740 },
    { over: 121250, notOver: 217300, rate: 0.24, plus: 16155 },
    { over: 217300, notOver: 271750, rate: 0.32, plus: 39207 },
    { over: 271750, notOver: 656150, rate: 0.35, plus: 56631 },
    { over: 656150, notOver: null, rate: 0.37, plus: 191171 },
  ],
}

// Standard deductions by filing status (2026)
const STANDARD_DEDUCTIONS_2026: Record<string, number> = {
  single: 8600,
  married: 12900,
  head_of_household: 8600,
}

// Organized by tax year so future updates are isolated
const BRACKETS_BY_YEAR: Record<number, BracketTable> = {
  2026: BRACKETS_2026,
}

const STANDARD_DEDUCTIONS_BY_YEAR: Record<number, Record<string, number>> = {
  2026: STANDARD_DEDUCTIONS_2026,
}

function getBrackets(
  taxYear: number,
  filingStatus: string
): TaxBracket[] {
  const yearBrackets = BRACKETS_BY_YEAR[taxYear]
  if (!yearBrackets) {
    throw new Error(`No federal tax brackets configured for year ${taxYear}`)
  }
  const brackets = yearBrackets[filingStatus]
  if (!brackets) {
    throw new Error(`No brackets for filing status "${filingStatus}" in ${taxYear}`)
  }
  return brackets
}

function getStandardDeduction(taxYear: number, filingStatus: string): number {
  const yearDeductions = STANDARD_DEDUCTIONS_BY_YEAR[taxYear]
  if (!yearDeductions) {
    throw new Error(`No standard deductions configured for year ${taxYear}`)
  }
  return yearDeductions[filingStatus] ?? 0
}

function computeAnnualTax(taxableIncome: number, brackets: TaxBracket[]): number {
  if (taxableIncome <= 0) return 0

  for (const bracket of brackets) {
    if (bracket.notOver === null || taxableIncome <= bracket.notOver) {
      return bracket.plus + (taxableIncome - bracket.over) * bracket.rate
    }
  }

  // Fallback: top bracket
  const topBracket = brackets[brackets.length - 1]
  return topBracket.plus + (taxableIncome - topBracket.over) * topBracket.rate
}

export function calculateFederalWithholding(params: {
  monthlyGross: number
  filingStatus: 'single' | 'married' | 'head_of_household'
  additionalDeductions: number // W-4 Step 4(b), annualized
  additionalIncome: number // W-4 Step 4(a), annualized
  additionalWithholding: number // W-4 Step 4(c), per period
  taxYear: number
}): number {
  const {
    monthlyGross,
    filingStatus,
    additionalDeductions,
    additionalIncome,
    additionalWithholding,
    taxYear,
  } = params

  const brackets = getBrackets(taxYear, filingStatus)
  const standardDeduction = getStandardDeduction(taxYear, filingStatus)

  // Step 1: Annualize
  const annualWages = monthlyGross * 12

  // Step 2: Subtract standard deduction
  // Step 3: Subtract W-4 Step 4(b) additional deductions
  const taxableIncome = annualWages - standardDeduction - additionalDeductions

  // Step 4: Apply bracket rates
  let annualTax = computeAnnualTax(taxableIncome, brackets)

  // Step 5: Add W-4 Step 4(a) — additional income increases the tax
  if (additionalIncome > 0) {
    annualTax = computeAnnualTax(taxableIncome + additionalIncome, brackets)
  }

  // Step 6: De-annualize
  let monthlyTax = annualTax / 12

  // Step 7: Add per-period additional withholding
  monthlyTax += additionalWithholding

  // Step 8: Floor at $0
  return Math.max(0, Math.round(monthlyTax * 100) / 100)
}
