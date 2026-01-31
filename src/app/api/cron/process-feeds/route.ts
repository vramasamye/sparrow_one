import { NextResponse } from "next/server"

import { processAllFeeds, getProcessingStatsUncached, cleanupOldFeeds } from "@/lib/feed-processor"
import { verifyCronAuth } from "@/lib/cron-auth"
import { withDatabase } from "@/lib/cron-db"

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("Starting feed processing cron job...")
  const startTime = Date.now()

  try {
    // Wrap all database operations in withDatabase for proper connection handling
    const result = await withDatabase(async () => {
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
      const stats = await getProcessingStatsUncached()

      return {
        cleaned,
        results,
        successful,
        failed,
        totalNew,
        totalDuplicates,
        totalSkipped,
        stats
      }
    })

    const duration = Date.now() - startTime

    console.log(`Feed processing completed in ${duration}ms`)
    console.log(`Successful: ${result.successful.length}, Failed: ${result.failed.length}`)
    console.log(`New items: ${result.totalNew}, Duplicates: ${result.totalDuplicates}, Skipped: ${result.totalSkipped}`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      cleanup: {
        oldFeedsRemoved: result.cleaned
      },
      summary: {
        feedsProcessed: result.results.length,
        successful: result.successful.length,
        failed: result.failed.length,
        newItems: result.totalNew,
        duplicates: result.totalDuplicates,
        skipped: result.totalSkipped,
      },
      stats: result.stats,
      errors: result.failed.map((r) => ({
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
