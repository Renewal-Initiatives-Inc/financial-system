import { and, eq, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { annualRateConfig } from '@/lib/db/schema'

/**
 * Look up an annual rate config value.
 *
 * - Queries for the given key and fiscal year
 * - If asOfDate provided, returns the rate with effective_date <= asOfDate (for mid-year changes)
 * - Falls back to most recent prior year if current year not configured
 * - Throws if no rate found at all
 */
export async function getAnnualRate(
  key: string,
  year: number,
  asOfDate?: string
): Promise<number> {
  // Try the requested year first
  const conditions = [
    eq(annualRateConfig.configKey, key),
    eq(annualRateConfig.fiscalYear, year),
  ]

  if (asOfDate) {
    conditions.push(lte(annualRateConfig.effectiveDate, asOfDate))
  }

  const result = await db
    .select({ value: annualRateConfig.value })
    .from(annualRateConfig)
    .where(and(...conditions))
    .orderBy(desc(annualRateConfig.effectiveDate))
    .limit(1)

  if (result.length > 0) {
    return parseFloat(result[0].value)
  }

  // Fall back to most recent prior year
  const fallback = await db
    .select({ value: annualRateConfig.value })
    .from(annualRateConfig)
    .where(
      and(
        eq(annualRateConfig.configKey, key),
        lte(annualRateConfig.fiscalYear, year)
      )
    )
    .orderBy(desc(annualRateConfig.fiscalYear), desc(annualRateConfig.effectiveDate))
    .limit(1)

  if (fallback.length > 0) {
    return parseFloat(fallback[0].value)
  }

  throw new Error(`No rate config found for key "${key}" at or before year ${year}`)
}

/**
 * Fetch all payroll-relevant rates for a given tax year in a single batch.
 */
export async function getPayrollRates(taxYear: number): Promise<{
  ssRate: number
  medicareRate: number
  ssWageBase: number
  stateRate: number
  surtaxRate: number
  surtaxThreshold: number
}> {
  const [ssRate, medicareRate, ssWageBase, stateRate, surtaxRate, surtaxThreshold] =
    await Promise.all([
      getAnnualRate('fica_ss_rate', taxYear),
      getAnnualRate('fica_medicare_rate', taxYear),
      getAnnualRate('fica_ss_wage_base', taxYear),
      getAnnualRate('ma_state_tax_rate', taxYear),
      getAnnualRate('ma_surtax_rate', taxYear),
      getAnnualRate('ma_surtax_threshold', taxYear),
    ])

  return { ssRate, medicareRate, ssWageBase, stateRate, surtaxRate, surtaxThreshold }
}
