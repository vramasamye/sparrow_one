import { NextRequest, NextResponse } from "next/server"

import { runAllCleanupJobs } from "@/lib/cleanup"

// Verify cron secret for security
function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("CRON_SECRET not set, allowing request in development")
    return process.env.NODE_ENV === "development"
  }

  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Database Cleanup Cron Job
 * Schedule: Daily at 2:00 AM UTC
 * Cleans up:
 * - Rejected feeds older than 7 days
 * - Pending feeds older than 48 hours
 * - Cancelled/failed posts older than 30 days
 * - Post history older than 90 days
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    console.log("Cleanup cron job started")

    const results = await runAllCleanupJobs()

    const totalDeleted = results.reduce((sum, r) => sum + r.deletedCount, 0)
    const errors = results.filter((r) => r.error)

    return NextResponse.json({
      success: errors.length === 0,
      message: "Cleanup completed",
      stats: {
        totalDeleted,
        jobsWithErrors: errors.length,
      },
      results,
    })
  } catch (error) {
    console.error("Cleanup cron job error:", error)
    return NextResponse.json(
      { error: "Cleanup failed", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}

// Support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request)
}
