import { NextRequest, NextResponse } from 'next/server'
import { getVendor1099Data } from '@/lib/compliance/vendor-1099'
import { generate1099PDF } from '@/lib/pdf/form-1099-generator'

const PAYER_INFO = {
  tin: process.env.EMPLOYER_EIN ?? '00-0000000',
  name: 'Renewal Initiatives Inc.',
  address: process.env.EMPLOYER_ADDRESS ?? '123 Main St',
  city: process.env.EMPLOYER_CITY ?? 'Holyoke',
  state: process.env.EMPLOYER_STATE ?? 'MA',
  zip: process.env.EMPLOYER_ZIP ?? '01040',
}

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams
  const yearStr = params.get('year')
  const format = params.get('format') ?? 'json'
  const vendorIdStr = params.get('vendorId')

  if (!yearStr) {
    return NextResponse.json({ error: 'Missing year parameter' }, { status: 400 })
  }

  const year = parseInt(yearStr)
  const data = await getVendor1099Data(year)

  // JSON response (default)
  if (format === 'json' && !vendorIdStr) {
    return NextResponse.json(data)
  }

  // CSV export for CPA
  if (format === 'csv') {
    const header = 'Vendor Name,TIN,Address,Entity Type,Total Paid,W-9 Status,Exceeds Threshold\n'
    const csvRows = data.rows
      .filter((r) => r.exceedsThreshold)
      .map(
        (r) =>
          `"${r.vendorName}","${r.taxId ?? ''}","${r.address ?? ''}","${r.entityType ?? ''}",${r.totalPaid.toFixed(2)},"${r.w9Status}",${r.exceedsThreshold}`
      )
      .join('\n')

    return new NextResponse(header + csvRows, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="1099-NEC-${year}.csv"`,
      },
    })
  }

  // Individual 1099-NEC PDF
  if (format === 'pdf' && vendorIdStr) {
    const vendorId = parseInt(vendorIdStr)
    const vendor = data.rows.find((r) => r.vendorId === vendorId)
    if (!vendor) {
      return NextResponse.json({ error: 'Vendor not found' }, { status: 404 })
    }

    const pdf = await generate1099PDF({ vendor, payer: PAYER_INFO, year })
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="1099-NEC-${vendor.vendorName.replace(/\s+/g, '_')}-${year}.pdf"`,
      },
    })
  }

  return NextResponse.json(data)
}
