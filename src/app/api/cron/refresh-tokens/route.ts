import { NextRequest, NextResponse } from "next/server"

import { refreshExpiringTokens } from "@/lib/token-refresh"
import { withDatabase } from "@/lib/cron-db"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * Token Refresh Cron Job
 * Schedule: Every 6 hours
 * Refreshes OAuth tokens expiring within 48 hours
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Token refresh cron job started")

    const results = await withDatabase(async () => {
      return await refreshExpiringTokens()
    })

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
