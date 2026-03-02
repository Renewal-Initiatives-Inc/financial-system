import { NextRequest, NextResponse } from 'next/server'
import { head } from '@vercel/blob'
import { auth } from '@/lib/auth'

/**
 * GET /api/download?url=<blob-url>
 * Authenticated proxy for private Vercel Blob files.
 * Verifies the user is authenticated, then fetches the blob
 * using the server-side token and streams it to the client.
 */
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const blobUrl = request.nextUrl.searchParams.get('url')
  if (!blobUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate that the URL points to our Vercel Blob store
  try {
    const url = new URL(blobUrl)
    if (!url.hostname.endsWith('.public.blob.vercel-storage.com') &&
        !url.hostname.endsWith('.store.vercel-storage.com')) {
      return NextResponse.json({ error: 'Invalid blob URL' }, { status: 400 })
    }
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  try {
    // Verify the blob exists
    const metadata = await head(blobUrl)

    // Fetch the blob content using the server-side token
    const response = await fetch(metadata.downloadUrl)
    if (!response.ok) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    const headers = new Headers()
    headers.set('Content-Type', metadata.contentType || 'application/octet-stream')
    headers.set('Content-Disposition', `inline; filename="${metadata.pathname.split('/').pop()}"`)
    headers.set('Cache-Control', 'private, no-store')

    return new NextResponse(response.body, { headers })
  } catch {
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }
}
