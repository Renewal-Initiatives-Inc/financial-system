import { generateAnnualDeadlines } from '@/lib/compliance/deadline-generator'

/**
 * Seed compliance deadlines for the current and next fiscal year.
 */
export async function seedComplianceDeadlines(): Promise<{
  currentYear: { created: number; skipped: number }
  nextYear: { created: number; skipped: number }
}> {
  const currentYear = new Date().getFullYear()

  const currentResult = await generateAnnualDeadlines(currentYear)
  const nextResult = await generateAnnualDeadlines(currentYear + 1)

  return {
    currentYear: currentResult,
    nextYear: nextResult,
  }
}
