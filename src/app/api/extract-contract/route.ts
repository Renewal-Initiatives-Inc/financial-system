import { NextRequest, NextResponse } from 'next/server'
import { extractContractTerms } from '@/lib/ai/contract-extraction'

export async function POST(request: NextRequest) {
  const { pdfBase64 } = await request.json()

  if (!pdfBase64 || typeof pdfBase64 !== 'string') {
    return NextResponse.json(
      { error: 'pdfBase64 is required' },
      { status: 400 }
    )
  }

  try {
    const terms = await extractContractTerms(pdfBase64)
    return NextResponse.json(terms)
  } catch (error) {
    console.error('Contract extraction failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to extract contract terms. You can enter terms manually.',
      },
      { status: 500 }
    )
  }
}
