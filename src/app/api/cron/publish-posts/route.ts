import { NextRequest, NextResponse } from "next/server"

import { publishScheduledPosts } from "@/lib/social-publisher"
import { verifyCronAuth } from "@/lib/cron-auth"
import { withDatabase } from "@/lib/cron-db"

/**
 * Post Publishing Cron Job
 * Schedule: Every 1 minute (managed by cron-job.org)
 * Publishes scheduled posts sequentially, one user at a time
 * Processes up to 10 posts per run to avoid rate limits
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Post publishing cron job started")

    // Use withDatabase for automatic connection/disconnection with retry logic
    await withDatabase(async () => {
      await publishScheduledPosts()
    })

    return NextResponse.json({
      success: true,
      message: "Post publishing completed",
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error("Post publishing cron job error:", error)
    return NextResponse.json(
      { error: "Post publishing failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
