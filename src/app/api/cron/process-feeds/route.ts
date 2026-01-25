import { NextResponse } from "next/server"

import { processAllFeeds, getProcessingStats, cleanupOldFeeds } from "@/lib/feed-processor"

// Verify cron secret to prevent unauthorized access
function verifyCronSecret(request: Request): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    console.warn("CRON_SECRET not set, allowing request in development")
    return process.env.NODE_ENV !== "production"
  }

  return authHeader === `Bearer ${cronSecret}`
}

export async function GET(request: Request) {
  // Verify authorization
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("Starting feed processing cron job...")
  const startTime = Date.now()

  try {
    // Cleanup old feeds (>24h) first
    const cleaned = await cleanupOldFeeds()

    // Process all feeds
    const results = await processAllFeeds()

    // Calculate summary
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)
    const totalNew = results.reduce((sum, r) => sum + r.newItems, 0)
    const totalDuplicates = results.reduce((sum, r) => sum + r.duplicates, 0)
    const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0)

    // Get updated stats
    const stats = await getProcessingStats()

    const duration = Date.now() - startTime

    console.log(`Feed processing completed in ${duration}ms`)
    console.log(`Successful: ${successful.length}, Failed: ${failed.length}`)
    console.log(`New items: ${totalNew}, Duplicates: ${totalDuplicates}, Skipped: ${totalSkipped}`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      cleanup: {
        oldFeedsRemoved: cleaned
      },
      summary: {
        feedsProcessed: results.length,
        successful: successful.length,
        failed: failed.length,
        newItems: totalNew,
        duplicates: totalDuplicates,
        skipped: totalSkipped,
      },
      stats,
      errors: failed.map((r) => ({
        feed: r.feedName,
        error: r.error,
      })),
    })
  } catch (error) {
    console.error("Feed processing cron job failed:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}

// Also support POST for flexibility
export async function POST(request: Request) {
  return GET(request)
}
