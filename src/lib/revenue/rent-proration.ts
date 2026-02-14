/**
 * MA rent proration calculator per G.L. c. 186 § 4.
 *
 * dailyRate = monthlyRent / actualCalendarDaysInMonth
 * proratedAmount = dailyRate * daysOccupied
 */

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate()
}

export function calculateProratedRent(
  monthlyRent: number,
  year: number,
  month: number,
  moveDate: Date,
  isMoveIn: boolean
): { dailyRate: number; daysOccupied: number; amount: number } {
  const totalDays = getDaysInMonth(year, month)
  const dailyRate = monthlyRent / totalDays
  const moveDay = moveDate.getDate()

  // Move-in: occupy from moveDay through end of month
  // Move-out: occupy from 1st through moveDay
  const daysOccupied = isMoveIn ? totalDays - moveDay + 1 : moveDay

  const amount = Math.round(dailyRate * daysOccupied * 100) / 100

  return {
    dailyRate: Math.round(dailyRate * 100) / 100,
    daysOccupied,
    amount,
  }
}
