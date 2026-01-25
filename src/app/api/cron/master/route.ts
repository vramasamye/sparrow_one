import { NextRequest, NextResponse } from "next/server"
import { processAllFeeds } from "@/lib/feed-processor"
import { publishScheduledPosts } from "@/lib/social-publisher"
import { refreshExpiringTokens } from "@/lib/token-refresh"
import { runAllCleanupJobs } from "@/lib/cleanup"
import { dequeueNextJob, markJobCompleted, markJobFailed } from "@/lib/queue"
import { generatePostsForFeed } from "@/lib/auto-generator"
import { distributeToSubscribers } from "@/lib/auto-scheduler"

function verifyCronSecret(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) return process.env.NODE_ENV === "development"
  return authHeader === `Bearer ${cronSecret}`
}

/**
 * Master Cron Job for Vercel Hobby Plan
 * Runs all tasks sequentially once per day
 */
export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const results: any = {
    timestamp: new Date().toISOString(),
    tasks: {}
  }

  try {
    // 1. Refresh Tokens
    console.log("Master Cron: Refreshing tokens...")
    await refreshExpiringTokens()
    results.tasks.refreshTokens = "success"

    // 2. Process Feeds
    console.log("Master Cron: Processing feeds...")
    const feedResults = await processAllFeeds()
    results.tasks.processFeeds = {
      success: true,
      newItems: feedResults.reduce((sum, r) => sum + r.newItems, 0)
    }

    // 3. Process Queue (One job)
    console.log("Master Cron: Processing queue...")
    const job = await dequeueNextJob()
    if (job) {
      const genResult = await generatePostsForFeed(job.feedId)
      if (genResult.success) {
        await distributeToSubscribers(job.feedId)
        await markJobCompleted(job)
        results.tasks.queueProcessing = `Processed feed ${job.feedId}`
      } else {
        await markJobFailed(job, genResult.error || "Generation failed")
        results.tasks.queueProcessing = `Failed feed ${job.feedId}`
      }
    } else {
      results.tasks.queueProcessing = "No jobs"
    }

    // 4. Publish Scheduled Posts
    console.log("Master Cron: Publishing posts...")
    await publishScheduledPosts()
    results.tasks.publishPosts = "success"

    // 5. Cleanup
    console.log("Master Cron: Running cleanup...")
    await runAllCleanupJobs()
    results.tasks.cleanup = "success"

    return NextResponse.json({ success: true, ...results })
  } catch (error) {
    console.error("Master Cron failed:", error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      results
    }, { status: 500 })
  }
}
