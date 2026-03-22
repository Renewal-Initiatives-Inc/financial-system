import { getQuarterlyTaxPrepData, type QuarterlyTaxPrepData } from '@/lib/reports/quarterly-tax-prep'
import { QuarterlyTaxPrepClient } from './quarterly-tax-prep-client'

export default async function QuarterlyTaxPrepPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  let data: QuarterlyTaxPrepData
  try {
    data = await getQuarterlyTaxPrepData({
      year: currentYear,
      quarter: currentQuarter,
    })
  } catch {
    const quarterLabels = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)']
    data = {
      federal941: {
        line1_employeeCount: 0, line2_totalWages: 0, line3_federalTaxWithheld: 0,
        line5a_ssWages: 0, line5a_ssTax: 0, line5c_medicareWages: 0,
        line5c_medicareTax: 0, line6_totalTaxBeforeAdjustments: 0,
        line10_totalTaxAfterAdjustments: 0,
      },
      maM941: { totalWagesSubjectToMA: 0, maIncomeTaxWithheld: 0 },
      year: currentYear, quarter: currentQuarter,
      quarterLabel: quarterLabels[currentQuarter - 1],
      periodStart: '', periodEnd: '',
      generatedAt: now.toISOString(),
    }
  }

  return <QuarterlyTaxPrepClient initialData={data} />
}
