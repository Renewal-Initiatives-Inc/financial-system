import { NextRequest, NextResponse } from 'next/server'
import { generateAmortizationSchedule } from '@/lib/reports/amortization-schedule'

export async function GET(request: NextRequest) {
  const fundId = request.nextUrl.searchParams.get('fundId')
  if (!fundId) {
    return NextResponse.json({ error: 'fundId is required' }, { status: 400 })
  }

  const parsed = parseInt(fundId, 10)
  if (isNaN(parsed)) {
    return NextResponse.json({ error: 'Invalid fundId' }, { status: 400 })
  }

  const data = await generateAmortizationSchedule(parsed)
  if (!data) {
    return NextResponse.json({ error: 'Loan not found' }, { status: 404 })
  }

  return NextResponse.json(data)
}
