import NextAuth from "next-auth"
import { NextResponse } from "next/server"

import { authConfig } from "@/lib/auth.config"

const { auth } = NextAuth(authConfig)

// Routes that require authentication
const protectedRoutes = ["/dashboard", "/settings", "/posts", "/topics", "/feed", "/admin"]

// Routes that should redirect to dashboard if already authenticated
const authRoutes = ["/login"]

export default auth((req) => {
  const { nextUrl } = req
  const isLoggedIn = !!req.auth
  const pathname = nextUrl.pathname

  // Check if the route is protected
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route))
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route))

  // Redirect unauthenticated users from protected routes
  if (isProtectedRoute && !isLoggedIn) {
    const loginUrl = new URL("/login", nextUrl)
    loginUrl.searchParams.set("callbackUrl", pathname)
    return NextResponse.redirect(loginUrl)
  }

  // Redirect authenticated users from auth routes to dashboard
  if (isAuthRoute && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl))
  }

  return NextResponse.next()
})

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
}