/**
 * Verify cron job authentication
 * Returns true if request is authorized (development mode OR valid secret)
 *
 * This file is separate from auth-helpers.ts because it's used in API routes
 * which cannot import React's cache function
 */
export function verifyCronAuth(authHeader: string | null, secretParam: string | null): boolean {
  // Allow in development
  if (process.env.NODE_ENV === "development") {
    return true
  }

  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("CRON_SECRET not configured")
    return false
  }

  // Check Authorization header
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Check query parameter (for compatibility)
  if (secretParam === cronSecret) {
    return true
  }

  return false
}
