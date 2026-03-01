import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64')

  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline' https://cdn.plaid.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self' https://*.plaid.com https://*.zitadel.cloud`,
    `frame-src https://cdn.plaid.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://*.zitadel.cloud`,
    `frame-ancestors 'none'`,
  ].join('; ')

  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  })

  // Report-only mode: logs violations in browser console without blocking.
  // Switch to 'Content-Security-Policy' after verifying no false positives.
  response.headers.set('Content-Security-Policy-Report-Only', csp)

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')

  return response
})

export const config = {
  matcher: ['/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)'],
}
