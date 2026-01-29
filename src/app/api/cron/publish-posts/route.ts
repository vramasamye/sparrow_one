import { NextRequest, NextResponse } from "next/server"

import { publishScheduledPosts } from "@/lib/social-publisher"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * Post Publishing Cron Job
 * Schedule: Every 5 minutes
 * Publishes scheduled posts that are due
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
