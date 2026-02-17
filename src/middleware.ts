import { auth } from '@/lib/auth'

export default auth

export const config = {
  matcher: ['/((?!api/auth|api/cron|_next/static|_next/image|favicon.ico).*)'],
}
