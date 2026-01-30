import { NextRequest, NextResponse } from "next/server"

import { publishScheduledPosts } from "@/lib/social-publisher"
import { verifyCronAuth } from "@/lib/cron-auth"

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

    // Retry logic for Neon database wake-up
    let lastError: Error | null = null
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await publishScheduledPosts()

        return NextResponse.json({
          success: true,
          message: "Post publishing completed",
          timestamp: new Date().toISOString(),
          attempt,
        })
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.warn(`Attempt ${attempt}/3 failed:`, lastError.message)

        // If it's a connection error and we have retries left, wait and retry
        if (attempt < 3 && lastError.message.includes("Can't reach database")) {
          console.log(`Waiting 2 seconds before retry ${attempt + 1}...`)
          await new Promise(resolve => setTimeout(resolve, 2000))
        } else if (attempt < 3) {
          // For non-connection errors, retry faster
          await new Promise(resolve => setTimeout(resolve, 500))
        }
      }
    }

    // All retries failed
    throw lastError
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
