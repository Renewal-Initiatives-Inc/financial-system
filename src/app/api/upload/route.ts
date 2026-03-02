import { NextRequest, NextResponse } from 'next/server'
import { put } from '@vercel/blob'
import { auth } from '@/lib/auth'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_CATEGORIES = ['w9', 'contracts'] as const
type Category = (typeof ALLOWED_CATEGORIES)[number]

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 255)
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const formData = await request.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.type.includes('pdf')) {
    return NextResponse.json(
      { error: 'Only PDF files are accepted' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'File size must not exceed 10MB' },
      { status: 400 }
    )
  }

  const category = formData.get('category') as string | null
  const validCategory: Category = ALLOWED_CATEGORIES.includes(category as Category)
    ? (category as Category)
    : 'contracts'

  const safeName = sanitizeFilename(file.name)

  // addRandomSuffix makes URLs non-guessable; download proxy prevents direct exposure
  const blob = await put(`${validCategory}/${Date.now()}-${safeName}`, file, {
    access: 'public',
    addRandomSuffix: true,
  })

  return NextResponse.json({ url: blob.url })
}
