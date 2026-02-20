import { NextRequest, NextResponse } from 'next/server'
import { extractContractTerms } from '@/lib/ai/contract-extraction'
import { auth } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
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
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to extract contract terms. You can enter terms manually or retry your upload.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
