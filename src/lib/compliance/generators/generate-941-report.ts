import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'
import type { TaxBandits941Payload } from '@/lib/taxbandits/types'

export type TaxQuarter = 'Q1' | 'Q2' | 'Q3' | 'Q4'

export interface Form941Data {
  quarter: TaxQuarter
  year: number
  employeeCount: number
  totalWages: number
  federalIncomeTaxWithheld: number
  taxableSSwages: number
  taxableMedicareWages: number
  ssTaxEmployee: number
  ssTaxEmployer: number
  medicareTaxEmployee: number
  medicareTaxEmployer: number
  totalTaxes: number
}

export interface Report941Result {
  pdfBytes: Uint8Array
  data: Form941Data
  taxBanditsPayload: TaxBandits941Payload
}

const QUARTER_DATE_RANGES: Record<TaxQuarter, { start: string; end: string }> = {
  Q1: { start: '01-01', end: '03-31' },
  Q2: { start: '04-01', end: '06-30' },
  Q3: { start: '07-01', end: '09-30' },
  Q4: { start: '10-01', end: '12-31' },
}

/** Parse quarter from a taskName like "Federal 941 (Q2)" or "MA M-941 (Q3)" */
export function inferQuarterFromTaskName(taskName: string): TaxQuarter {
  const match = taskName.match(/\b(Q[1-4])\b/i)
  if (match) return match[1].toUpperCase() as TaxQuarter
  return 'Q1'
}

export async function get941Data(quarter: TaxQuarter, year?: number): Promise<Form941Data> {
  const targetYear = year ?? new Date().getFullYear() - 1
  const range = QUARTER_DATE_RANGES[quarter]
  const startDate = `${targetYear}-${range.start}`
  const endDate = `${targetYear}-${range.end}`

  const runs = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(
      and(
        gte(payrollRuns.payPeriodStart, startDate),
        lte(payrollRuns.payPeriodEnd, endDate),
        eq(payrollRuns.status, 'POSTED')
      )
    )

  if (runs.length === 0) {
    return {
      quarter,
      year: targetYear,
      employeeCount: 0,
      totalWages: 0,
      federalIncomeTaxWithheld: 0,
      taxableSSwages: 0,
      taxableMedicareWages: 0,
      ssTaxEmployee: 0,
      ssTaxEmployer: 0,
      medicareTaxEmployee: 0,
      medicareTaxEmployer: 0,
      totalTaxes: 0,
    }
  }

  const [agg] = await db
    .select({
      employeeCount: sql<string>`COUNT(DISTINCT ${payrollEntries.employeeId})`,
      totalGross: sql<string>`COALESCE(SUM(CAST(${payrollEntries.grossPay} AS numeric)), 0)`,
      totalFederal: sql<string>`COALESCE(SUM(CAST(${payrollEntries.federalWithholding} AS numeric)), 0)`,
      totalSSEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployee} AS numeric)), 0)`,
      totalSSEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployer} AS numeric)), 0)`,
      totalMedicareEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployee} AS numeric)), 0)`,
      totalMedicareEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployer} AS numeric)), 0)`,
    })
    .from(payrollEntries)
    .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        gte(payrollRuns.payPeriodStart, startDate),
        lte(payrollRuns.payPeriodEnd, endDate),
        eq(payrollRuns.status, 'POSTED')
      )
    )

  const totalWages = parseFloat(agg?.totalGross ?? '0')
  const totalFederal = parseFloat(agg?.totalFederal ?? '0')
  const ssEmployee = parseFloat(agg?.totalSSEmployee ?? '0')
  const ssEmployer = parseFloat(agg?.totalSSEmployer ?? '0')
  const medicareEmployee = parseFloat(agg?.totalMedicareEmployee ?? '0')
  const medicareEmployer = parseFloat(agg?.totalMedicareEmployer ?? '0')

  const totalTaxes = totalFederal + ssEmployee + ssEmployer + medicareEmployee + medicareEmployer

  return {
    quarter,
    year: targetYear,
    employeeCount: parseInt(agg?.employeeCount ?? '0'),
    totalWages,
    federalIncomeTaxWithheld: totalFederal,
    taxableSSwages: totalWages,
    taxableMedicareWages: totalWages,
    ssTaxEmployee: ssEmployee,
    ssTaxEmployer: ssEmployer,
    medicareTaxEmployee: medicareEmployee,
    medicareTaxEmployer: medicareEmployer,
    totalTaxes,
  }
}

export async function generate941Report(quarter: TaxQuarter, year?: number): Promise<Report941Result> {
  const data = await get941Data(quarter, year)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  let y = 740

  page.drawText(`Form 941 Data Summary — ${data.quarter} ${data.year}`, {
    x: 50, y, size: 14, font: boldFont,
  })
  y -= 20
  page.drawText(`Employer: ${process.env.EMPLOYER_NAME ?? 'Renewal Initiatives Inc.'}`, {
    x: 50, y, size: 9, font,
  })
  y -= 12
  page.drawText(`EIN: ${process.env.EMPLOYER_EIN ?? '00-0000000'}`, {
    x: 50, y, size: 9, font,
  })
  y -= 30

  page.drawText('Form 941 Line Items', { x: 50, y, size: 11, font: boldFont })
  y -= 20

  const lines: [string, string][] = [
    ['Line 1 — Number of employees', String(data.employeeCount)],
    ['Line 2 — Wages, tips, other compensation', `$${fmt(data.totalWages)}`],
    ['Line 3 — Federal income tax withheld', `$${fmt(data.federalIncomeTaxWithheld)}`],
    ['Line 5a — Taxable SS wages', `$${fmt(data.taxableSSwages)}`],
    ['Line 5c — Taxable Medicare wages', `$${fmt(data.taxableMedicareWages)}`],
    ['Line 6 — Total taxes before adjustments', `$${fmt(data.totalTaxes)}`],
  ]

  for (const [label, value] of lines) {
    page.drawText(label, { x: 50, y, size: 9, font })
    page.drawText(value, { x: 400, y, size: 9, font })
    y -= 16
  }

  y -= 20
  page.drawText('Transfer Instructions', { x: 50, y, size: 11, font: boldFont })
  y -= 15
  page.drawText('Use TaxBandits to e-file Form 941. Map the values above to the', { x: 50, y, size: 9, font })
  y -= 12
  page.drawText('corresponding lines in TaxBandits → Tax Filing → Form 941.', { x: 50, y, size: 9, font })

  page.drawText('Generated by Renewal Initiatives Financial System', {
    x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
  })

  const pdfBytes = await doc.save()

  const taxBanditsPayload: TaxBandits941Payload = {
    BusinessId: process.env.TAXBANDITS_BUSINESS_ID ?? '',
    TaxYear: String(data.year),
    TaxPeriod: data.quarter,
    Line1_EmployeeCount: data.employeeCount,
    Line2_TotalWages: data.totalWages,
    Line3_FederalIncomeTaxWithheld: data.federalIncomeTaxWithheld,
    Line4_HasQualifiedSickLeave: false,
    Line5a_TaxableSSwages: data.taxableSSwages,
    Line5c_TaxableMedicareWages: data.taxableMedicareWages,
    Line6_TotalTaxes: data.totalTaxes,
    Line8_TotalTaxesAfterAdjustments: data.totalTaxes,
    Line10_TotalDepositsThisQuarter: data.totalTaxes,
  }

  return { pdfBytes, data, taxBanditsPayload }
}

export async function generateM941Report(quarter: TaxQuarter, year?: number): Promise<Uint8Array> {
  const data = await get941Data(quarter, year)
  const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')

  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)

  // Page 1: MA M-941 Data
  let y = 740
  page.drawText(`MA M-941 Data Summary — ${data.quarter} ${data.year}`, {
    x: 50, y, size: 14, font: boldFont,
  })
  y -= 20
  page.drawText(`Employer: ${process.env.EMPLOYER_NAME ?? 'Renewal Initiatives Inc.'}`, {
    x: 50, y, size: 9, font,
  })
  y -= 12
  page.drawText(`MA Withholding Account: ${process.env.MA_WITHHOLDING_ACCOUNT ?? 'XXXXX-XXX'}`, {
    x: 50, y, size: 9, font,
  })
  y -= 30

  page.drawText('M-941 Data Fields', { x: 50, y, size: 11, font: boldFont })
  y -= 20

  const lines: [string, string][] = [
    ['Total Massachusetts wages', `$${fmt(data.totalWages)}`],
    ['Massachusetts income tax withheld', `$${fmt(data.federalIncomeTaxWithheld * 0.0505)}`],
    ['Number of employees', String(data.employeeCount)],
  ]

  for (const [label, value] of lines) {
    page.drawText(label, { x: 50, y, size: 9, font })
    page.drawText(value, { x: 380, y, size: 9, font })
    y -= 16
  }

  // Page 2: Filing Instructions
  const page2 = doc.addPage([612, 792])
  let y2 = 740

  page2.drawText('MA M-941 Filing Instructions — MassTaxConnect', {
    x: 50, y: y2, size: 13, font: boldFont,
  })
  y2 -= 30

  const steps = [
    '1. Log in to MassTaxConnect at masstaxconnect.dor.state.ma.us',
    '2. Select "Withholding Tax" account',
    '3. Click "File Return" for the current period',
    '4. Enter "Total Massachusetts wages" from page 1 of this report',
    '5. Enter "Massachusetts income tax withheld" from page 1',
    '6. Verify "Number of employees" matches your payroll records',
    '7. Review and submit. Save the confirmation number.',
  ]
  for (const step of steps) {
    page2.drawText(step, { x: 50, y: y2, size: 9, font: font })
    y2 -= 16
  }

  y2 -= 20
  page2.drawText('Note: MA state withholding estimated at 5.05% of MA wages.', {
    x: 50, y: y2, size: 8, font, color: rgb(0.4, 0.4, 0.4),
  })
  y2 -= 12
  page2.drawText('Verify exact withholding from employee records before filing.', {
    x: 50, y: y2, size: 8, font, color: rgb(0.4, 0.4, 0.4),
  })

  for (const p of [page, page2]) {
    p.drawText('Generated by Renewal Initiatives Financial System', {
      x: 50, y: 30, size: 7, font, color: rgb(0.5, 0.5, 0.5),
    })
  }

  return doc.save()
}
