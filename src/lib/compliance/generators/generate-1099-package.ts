import { getVendor1099Data } from '@/lib/compliance/vendor-1099'
import { generate1099PDF } from '@/lib/pdf/form-1099-generator'
import type { Vendor1099Row } from '@/lib/compliance/vendor-1099'
import type {
  TaxBandits1099NECPayload,
  TaxBandits1099NECRecipient,
  TaxBanditsAddress,
} from '@/lib/taxbandits/types'

export interface Package1099NECResult {
  pdfBytes: Uint8Array
  year: number
  vendorCount: number
  /** Pre-built TaxBandits payload for delivery step submission. */
  taxBanditsPayload: TaxBandits1099NECPayload
}

const DEFAULT_PAYER_ADDRESS: TaxBanditsAddress = {
  Address1: process.env.EMPLOYER_ADDRESS ?? '123 Main Street',
  City: process.env.EMPLOYER_CITY ?? 'Boston',
  State: process.env.EMPLOYER_STATE ?? 'MA',
  ZipCd: process.env.EMPLOYER_ZIP ?? '02101',
}

function buildRecipientPayload(
  row: Vendor1099Row,
  seq: number
): TaxBandits1099NECRecipient {
  return {
    SequenceId: String(seq).padStart(4, '0'),
    Original1099: true,
    RecipientTIN: row.taxId ?? '00-0000000',
    RecipientNm: row.vendorName,
    RecipientAddress: DEFAULT_PAYER_ADDRESS, // Placeholder — real address from vendor record
    Box1: row.totalPaid,
  }
}

/**
 * Generate the 1099-NEC package for the given calendar year.
 * Produces:
 *   1. Combined PDF with one page per qualifying vendor (Copy B/C)
 *   2. TaxBandits payload for submission at delivery step
 */
export async function generate1099Package(year?: number): Promise<Package1099NECResult> {
  const targetYear = year ?? new Date().getFullYear() - 1

  const data = await getVendor1099Data(targetYear)

  // Filter to vendors that exceed threshold and have W-9
  const qualifying = data.rows.filter(
    (r) => r.exceedsThreshold && r.w9Status === 'COLLECTED'
  )

  const payer = {
    tin: process.env.EMPLOYER_EIN ?? '00-0000000',
    name: process.env.EMPLOYER_NAME ?? 'Renewal Initiatives Inc.',
    address: process.env.EMPLOYER_ADDRESS ?? '123 Main Street',
    city: process.env.EMPLOYER_CITY ?? 'Boston',
    state: process.env.EMPLOYER_STATE ?? 'MA',
    zip: process.env.EMPLOYER_ZIP ?? '02101',
  }

  // Combine individual vendor PDFs into one document using pdf-lib
  const { PDFDocument } = await import('pdf-lib')
  const combined = await PDFDocument.create()

  for (const row of qualifying) {
    const singlePdf = await generate1099PDF({ vendor: row, payer, year: targetYear })
    const tempDoc = await PDFDocument.load(singlePdf)
    const pages = await combined.copyPages(tempDoc, tempDoc.getPageIndices())
    for (const page of pages) {
      combined.addPage(page)
    }
  }

  // If no qualifying vendors, add a "no filings required" page
  if (qualifying.length === 0) {
    const { StandardFonts } = await import('pdf-lib')
    const page = combined.addPage([612, 792])
    const font = await combined.embedFont(StandardFonts.Helvetica)
    page.drawText(`1099-NEC — ${targetYear}: No qualifying vendors (payments ≥ $600 with W-9 collected)`, {
      x: 50,
      y: 400,
      size: 10,
      font,
    })
  }

  const pdfBytes = await combined.save()

  const taxBanditsPayload: TaxBandits1099NECPayload = {
    BusinessId: process.env.TAXBANDITS_BUSINESS_ID ?? '',
    TaxYear: String(targetYear),
    IsFederalFiling: true,
    IsStateFiling: false,
    Is1099OnlineFiling: true,
    Is1099PostalMailing: false,
    FormType: '1099-NEC',
    Payer1099: qualifying.map((row, i) => buildRecipientPayload(row, i + 1)),
  }

  return {
    pdfBytes,
    year: targetYear,
    vendorCount: qualifying.length,
    taxBanditsPayload,
  }
}
