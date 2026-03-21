import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'unsafe-inline' https://cdn.plaid.com`,
    // Accepted risk: 'unsafe-inline' required for Next.js inline scripts and Tailwind CSS.
    // Nonce-based CSP requires root layout propagation; TODO for future hardening.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data: https://*.public.blob.vercel-storage.com`,
    `font-src 'self'`,
    `connect-src 'self' https://*.plaid.com https://*.zitadel.cloud https://*.public.blob.vercel-storage.com`,
    `frame-src https://cdn.plaid.com https://calendar.google.com`,
    `worker-src 'self' blob:`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self' https://*.zitadel.cloud`,
    `frame-ancestors 'none'`,
  ].join('; ')

  const response = NextResponse.next({
    request: { headers: new Headers(req.headers) },
  })

  response.headers.set('Content-Security-Policy', csp)

  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  response.headers.set('X-Frame-Options', 'DENY')

  return response
})

export const config = {
  matcher: ['/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)'],
}
