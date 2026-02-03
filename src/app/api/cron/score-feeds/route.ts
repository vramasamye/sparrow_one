import { NextRequest, NextResponse } from "next/server"
import { scoreUnscoredFeeds } from "@/lib/batch-scorer"
import { verifyCronAuth } from "@/lib/cron-auth"
import { withDatabase } from "@/lib/cron-db"

export const maxDuration = 300 // 5 minutes

/**
 * Feed Scoring Cron Job
 * Schedule: Every 30 minutes
 * Scores unscored PENDING feeds using Llama Guard
 *
 * Rate Limit Management:
 * - Llama Guard: 30 RPM (1 request per 2 seconds)
 * - Can safely process ~60 feeds per run (2 minutes)
 * - With 30min interval: 2,880 feeds/day (well under 14,400 RPD limit)
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("Feed scoring cron job started")
  const startTime = Date.now()

  try {
    // maxDuration is 300s (5 min). Score up to 50 feeds per run.
    // Each feed takes ~2s (Llama Guard rate limit) = 100s for 50 feeds.
    const result = await withDatabase(async () => {
      return await scoreUnscoredFeeds(50)
    })

    const duration = Date.now() - startTime

    console.log(`Feed scoring completed in ${duration}ms`)
    console.log(`Processed: ${result.processed}, Auto-approved: ${result.autoApproved}, Auto-rejected: ${result.autoRejected}`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      stats: {
        total: result.total,
        processed: result.processed,
        autoApproved: result.autoApproved,
        autoRejected: result.autoRejected,
        pendingReview: result.pendingReview,
        errors: result.errors
      }
    })

  } catch (error) {
    console.error("Feed scoring cron job error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        duration: `${Date.now() - startTime}ms`
      },
      { status: 500 }
    )
  }
}

// Support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
