/**
 * MA rent proration per G.L. c. 186 § 4.
 * Daily rate = monthly rent / calendar days in month.
 * Prorated amount = daily rate × days occupied.
 */

/**
 * Get the number of calendar days in a given month.
 */
function daysInMonth(year: number, month: number): number {
  // month is 1-indexed (1 = January)
  return new Date(year, month, 0).getDate()
}

/**
 * Calculate the daily rent rate for a specific month.
 * Daily rate = monthlyRent / calendar days in month.
 */
export function calculateDailyRate(
  monthlyRent: number,
  year: number,
  month: number
): number {
  const days = daysInMonth(year, month)
  return monthlyRent / days
}

/**
 * Calculate prorated rent for a partial first month.
 * Returns full rent if move-in is day 1 of the month.
 *
 * @param monthlyRent - The full monthly rent amount
 * @param moveInDate - ISO date string (YYYY-MM-DD)
 * @returns Prorated rent amount rounded to cents
 */
export function calculateProratedRent(
  monthlyRent: number,
  moveInDate: string
): number {
  // Parse YYYY-MM-DD directly to avoid UTC timezone shift
  const [yearStr, monthStr, dayStr] = moveInDate.split('-')
  const year = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)
  const totalDays = daysInMonth(year, month)

  // Days occupied = total days in month - (move-in day - 1)
  // e.g., move in day 15 of 30-day month = 30 - 14 = 16 days
  const daysOccupied = totalDays - day + 1

  if (daysOccupied >= totalDays) return monthlyRent // full month

  const dailyRate = monthlyRent / totalDays
  const prorated = dailyRate * daysOccupied
  return Math.round(prorated * 100) / 100
}
