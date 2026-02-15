import { NextRequest, NextResponse } from 'next/server'
import { generateBoardPack } from '@/lib/pdf/board-pack'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const params = request.nextUrl.searchParams
  const reportsStr = params.get('reports')
  const startDate = params.get('startDate') ?? `${new Date().getFullYear()}-01-01`
  const endDate = params.get('endDate') ?? new Date().toISOString().split('T')[0]
  const fundIdStr = params.get('fundId')

  if (!reportsStr) {
    return NextResponse.json(
      { error: 'Missing reports parameter (comma-separated slugs)' },
      { status: 400 }
    )
  }

  const reportSlugs = reportsStr.split(',').filter(Boolean)
  if (reportSlugs.length === 0) {
    return NextResponse.json({ error: 'No reports selected' }, { status: 400 })
  }

  try {
    const baseUrl = request.nextUrl.origin
    const pdf = await generateBoardPack({
      reportSlugs,
      startDate,
      endDate,
      fundId: fundIdStr ? parseInt(fundIdStr) : undefined,
      baseUrl,
    })

    return new NextResponse(Buffer.from(pdf), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="Board-Pack-${endDate}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Board pack generation error:', error)
    return NextResponse.json(
      { error: 'Board pack generation failed' },
      { status: 500 }
    )
  }
}
