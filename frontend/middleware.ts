import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes requiring authentication
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/suppliers',
  '/cases',
  '/compliance',
  '/fraud-detection',
  '/zero-trust',
  '/ingestion',
  '/developer-tests',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow API routes to pass through to Next.js rewrites
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check for protected routes
  const isProtected = pathname === '/' || PROTECTED_PREFIXES.some(prefix => pathname.startsWith(prefix))

  if (isProtected) {
    const token = request.cookies.get('access_token')?.value || request.cookies.get('tris_auth_active')?.value
    if (!token) {
      const loginUrl = new URL('/login', request.url)
      return NextResponse.redirect(loginUrl)
    }
    return NextResponse.next()
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
