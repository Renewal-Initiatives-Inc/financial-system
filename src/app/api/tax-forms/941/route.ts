import { NextRequest, NextResponse } from 'next/server'
import { getQuarterlyTaxPrepData } from '@/lib/reports/quarterly-tax-prep'

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const yearStr = params.get('year')
  const quarterStr = params.get('quarter')
  const format = params.get('format') ?? 'json'

  if (!yearStr || !quarterStr) {
    return NextResponse.json(
      { error: 'Missing year or quarter parameter' },
      { status: 400 }
    )
  }

  const year = parseInt(yearStr)
  const quarter = parseInt(quarterStr)

  if (quarter < 1 || quarter > 4) {
    return NextResponse.json({ error: 'Quarter must be 1-4' }, { status: 400 })
  }

  const data = await getQuarterlyTaxPrepData({ year, quarter })

  if (format === 'csv') {
    const lines = [
      'Form,Line,Description,Amount',
      `941,1,Number of employees,${data.federal941.line1_employeeCount}`,
      `941,2,Total wages / tips / compensation,${data.federal941.line2_totalWages.toFixed(2)}`,
      `941,3,Federal income tax withheld,${data.federal941.line3_federalTaxWithheld.toFixed(2)}`,
      `941,5a(col 1),Taxable social security wages,${data.federal941.line5a_ssWages.toFixed(2)}`,
      `941,5a(col 2),Social security tax (12.4%),${data.federal941.line5a_ssTax.toFixed(2)}`,
      `941,5c(col 1),Taxable Medicare wages,${data.federal941.line5c_medicareWages.toFixed(2)}`,
      `941,5c(col 2),Medicare tax (2.9%),${data.federal941.line5c_medicareTax.toFixed(2)}`,
      `941,6,Total taxes before adjustments,${data.federal941.line6_totalTaxBeforeAdjustments.toFixed(2)}`,
      `941,10,Total taxes after adjustments,${data.federal941.line10_totalTaxAfterAdjustments.toFixed(2)}`,
      `M-941,,Total wages subject to MA,${data.maM941.totalWagesSubjectToMA.toFixed(2)}`,
      `M-941,,MA income tax withheld,${data.maM941.maIncomeTaxWithheld.toFixed(2)}`,
    ]

    return new NextResponse(lines.join('\n'), {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="941-Q${quarter}-${year}.csv"`,
      },
    })
  }

  if (format === 'pdf') {
    // Redirect to the main PDF route with the quarterly-tax-prep slug
    const pdfUrl = `/api/reports/pdf?report=quarterly-tax-prep&year=${year}&quarter=${quarter}`
    return NextResponse.redirect(new URL(pdfUrl, request.url))
  }

  return NextResponse.json(data)
}
