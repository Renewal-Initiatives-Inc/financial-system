import { NextRequest, NextResponse } from 'next/server'
import { getW2VerificationData } from '@/lib/reports/w2-verification'
import { generateW2PDF, generateCombinedW2PDF } from '@/lib/pdf/w2-generator'
import { auth } from '@/lib/auth'

const EMPLOYER_INFO = {
  ein: process.env.EMPLOYER_EIN ?? '00-0000000',
  name: 'Renewal Initiatives Inc.',
  address: process.env.EMPLOYER_ADDRESS ?? '123 Main St',
  city: process.env.EMPLOYER_CITY ?? 'Holyoke',
  state: process.env.EMPLOYER_STATE ?? 'MA',
  zip: process.env.EMPLOYER_ZIP ?? '01040',
}

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const yearStr = params.get('year')
  const employeeId = params.get('employeeId')

  if (!yearStr) {
    return NextResponse.json({ error: 'Missing year parameter' }, { status: 400 })
  }

  const year = parseInt(yearStr)
  const data = await getW2VerificationData({ year })

  if (employeeId) {
    // Single employee
    const employee = data.rows.find((r) => r.employeeId === employeeId)
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    const pdf = await generateW2PDF({ employee, employer: EMPLOYER_INFO, year })
    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="W2-${employee.employeeName.replace(/\s+/g, '_')}-${year}.pdf"`,
      },
    })
  }

  // All employees combined
  if (data.rows.length === 0) {
    return NextResponse.json({ error: 'No employees found for this year' }, { status: 404 })
  }

  const pdf = await generateCombinedW2PDF(data.rows, EMPLOYER_INFO, year)
  return new NextResponse(Buffer.from(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="W2-All-Employees-${year}.pdf"`,
    },
  })
}
