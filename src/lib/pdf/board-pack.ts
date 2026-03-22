import { PDFDocument } from 'pdf-lib'

/**
 * Board Pack Generator
 *
 * Combines multiple report PDFs into a single document with a cover page.
 */

interface BoardPackInput {
  reportSlugs: string[]
  startDate: string
  endDate: string
  fundId?: number
  baseUrl: string
}

/**
 * Generate a cover page for the board pack.
 */
async function generateCoverPage(
  dateRange: string,
  reportTitles: string[]
): Promise<Uint8Array> {
  const { rgb, StandardFonts } = await import('pdf-lib')
  const doc = await PDFDocument.create()
  const page = doc.addPage([612, 792])
  const font = await doc.embedFont(StandardFonts.Helvetica)
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold)

  let y = 650

  // Title
  page.drawText('Renewal Initiatives Inc.', {
    x: 50,
    y: y + 50,
    size: 20,
    font: boldFont,
  })
  page.drawText('Board Pack', {
    x: 50,
    y: y + 20,
    size: 16,
    font: boldFont,
  })
  page.drawText(dateRange, {
    x: 50,
    y,
    size: 12,
    font,
    color: rgb(0.4, 0.4, 0.4),
  })

  y -= 40

  // Table of contents
  page.drawText('Table of Contents', {
    x: 50,
    y,
    size: 14,
    font: boldFont,
  })
  y -= 25

  reportTitles.forEach((title, i) => {
    page.drawText(`${i + 1}. ${title}`, {
      x: 70,
      y,
      size: 11,
      font,
    })
    y -= 18
  })

  // Footer
  page.drawText(
    `Generated: ${new Date().toLocaleString('en-US')}`,
    {
      x: 50,
      y: 30,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    }
  )

  return doc.save()
}

// Report slug to title mapping
const REPORT_TITLES: Record<string, string> = {
  'balance-sheet': 'Balance Sheet',
  activities: 'Income Statement',
  'cash-flows': 'Statement of Cash Flows',
  'functional-expenses': 'Statement of Functional Expenses',
  'cash-position': 'Cash Position Summary',
  'ar-aging': 'AR Aging',
  'outstanding-payables': 'Outstanding Payables',
  'rent-collection': 'Rent Collection Status',
  'fund-drawdown': 'Fund Draw-Down / Restricted Funding Status',
  'fund-level': 'Fund-Level P&L and Balance Sheet',
  'property-expenses': 'Property Operating Expense Breakdown',
  'utility-trends': 'Utility Trend Analysis',
  'security-deposit-register': 'Security Deposit Register',
  'donor-giving-history': 'Donor Giving History',
  'cash-projection': 'Cash Projection',
  'audit-log': 'Audit Log',
  'transaction-history': 'Transaction History',
  'late-entries': 'Late Entries',
  'form-990-data': 'Form 990 Data',
  'capital-budget': 'Capital Budget',
  'payroll-register': 'Payroll Register',
  'payroll-tax-liability': 'Payroll Tax Liability',
  'w2-verification': 'W-2 Verification',
  'employer-payroll-cost': 'Employer Payroll Cost',
  'quarterly-tax-prep': 'Quarterly Tax Prep',
}

/**
 * Generate a combined board pack PDF from multiple reports.
 */
export async function generateBoardPack(input: BoardPackInput): Promise<Uint8Array> {
  const { reportSlugs, startDate, endDate, fundId, baseUrl } = input

  const reportTitles = reportSlugs.map(
    (slug) => REPORT_TITLES[slug] ?? slug.replace(/-/g, ' ')
  )

  // Generate cover page
  const coverPdf = await generateCoverPage(`${startDate} to ${endDate}`, reportTitles)

  // Combine all PDFs
  const combined = await PDFDocument.load(coverPdf)

  for (const slug of reportSlugs) {
    try {
      const url = new URL('/api/reports/pdf', baseUrl)
      url.searchParams.set('report', slug)
      url.searchParams.set('startDate', startDate)
      url.searchParams.set('endDate', endDate)
      if (fundId) url.searchParams.set('fundId', String(fundId))

      const response = await fetch(url.toString())
      if (!response.ok) continue

      const buffer = await response.arrayBuffer()
      const reportDoc = await PDFDocument.load(buffer)
      const pages = await combined.copyPages(reportDoc, reportDoc.getPageIndices())
      for (const page of pages) {
        combined.addPage(page)
      }
    } catch {
      // Skip reports that fail to generate
      continue
    }
  }

  return combined.save()
}

export { REPORT_TITLES }
