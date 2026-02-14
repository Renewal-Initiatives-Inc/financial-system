export type SpreadMethod = 'EVEN' | 'SEASONAL' | 'ONE_TIME' | 'CUSTOM'

/**
 * Divide annual amount evenly across 12 months.
 * Last month absorbs rounding remainder so total is exact.
 */
export function calculateEvenSpread(annualAmount: number): number[] {
  const monthly = Math.round((annualAmount / 12) * 100) / 100
  const months = Array(12).fill(monthly) as number[]
  const sum = monthly * 11
  // Last month absorbs the remainder
  months[11] = Math.round((annualAmount - sum) * 100) / 100
  return months
}

/**
 * Distribute annual amount proportionally based on weights.
 * Weights are positive numbers; the proportion for each month = weight / totalWeight.
 * Last month absorbs rounding remainder.
 */
export function calculateSeasonalSpread(
  annualAmount: number,
  weights: number[]
): number[] {
  if (weights.length !== 12) {
    throw new Error('Weights must have exactly 12 elements')
  }
  if (weights.some((w) => w < 0)) {
    throw new Error('Weights must be non-negative')
  }
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  if (totalWeight === 0) {
    throw new Error('Total weight must be greater than zero')
  }

  const months: number[] = []
  let allocated = 0
  for (let i = 0; i < 11; i++) {
    const amount = Math.round((annualAmount * weights[i] / totalWeight) * 100) / 100
    months.push(amount)
    allocated += amount
  }
  // Last month absorbs remainder
  months.push(Math.round((annualAmount - allocated) * 100) / 100)
  return months
}

/**
 * Place the full annual amount in a single target month (1-12).
 * All other months are zero.
 */
export function calculateOneTimeSpread(
  annualAmount: number,
  targetMonth: number
): number[] {
  if (targetMonth < 1 || targetMonth > 12) {
    throw new Error('Target month must be between 1 and 12')
  }
  const months = Array(12).fill(0) as number[]
  months[targetMonth - 1] = annualAmount
  return months
}

/**
 * Validate that custom monthly amounts sum to the annual amount.
 * Tolerance of $0.02 for rounding across 12 months.
 */
export function validateCustomSpread(
  monthlyAmounts: number[],
  annualAmount: number
): boolean {
  if (monthlyAmounts.length !== 12) return false
  const sum = monthlyAmounts.reduce((a, b) => a + b, 0)
  return Math.abs(sum - annualAmount) < 0.02
}

/**
 * Dispatcher: recalculate monthly amounts from spread method + annual amount.
 */
export function recalculateSpread(
  method: SpreadMethod,
  annualAmount: number,
  params?: { weights?: number[]; targetMonth?: number }
): number[] {
  switch (method) {
    case 'EVEN':
      return calculateEvenSpread(annualAmount)
    case 'SEASONAL':
      if (!params?.weights) {
        throw new Error('Weights are required for seasonal spread')
      }
      return calculateSeasonalSpread(annualAmount, params.weights)
    case 'ONE_TIME':
      if (!params?.targetMonth) {
        throw new Error('Target month is required for one-time spread')
      }
      return calculateOneTimeSpread(annualAmount, params.targetMonth)
    case 'CUSTOM':
      // For custom, caller provides the amounts directly — no recalc
      throw new Error('Custom spread amounts must be provided directly')
    default:
      throw new Error(`Unknown spread method: ${method}`)
  }
}
