import { NextRequest, NextResponse } from "next/server"

import { publishScheduledPosts } from "@/lib/social-publisher"

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
 * Post Publishing Cron Job
 * Schedule: Every 5 minutes
 * Publishes scheduled posts that are due
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Post publishing cron job started")

    await publishScheduledPosts()

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
