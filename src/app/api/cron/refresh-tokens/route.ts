import { NextRequest, NextResponse } from "next/server"

import { refreshExpiringTokens } from "@/lib/token-refresh"

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("CRON_SECRET not set, allowing request in development")
    return process.env.NODE_ENV === "development"
  }

  // Check Authorization header
  if (authHeader === `Bearer ${cronSecret}`) {
    return true
  }

  // Check URL query parameter
  if (secretParam === cronSecret) {
    return true
  }

  return false
}

/**
 * Token Refresh Cron Job
 * Schedule: Every 6 hours
 * Refreshes OAuth tokens expiring within 48 hours
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Token refresh cron job started")

    const results = await refreshExpiringTokens()

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      message: "Token refresh completed",
      stats: {
        total: results.length,
        successful,
        failed,
      },
      results,
    })
  } catch (error) {
    console.error("Token refresh cron job error:", error)
    return NextResponse.json(
      { error: "Token refresh failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
