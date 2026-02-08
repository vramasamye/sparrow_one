import { NextResponse } from "next/server"
import { dequeueNextJob, markJobCompleted, markJobFailed, getQueueStats, recoverStuckJobs, syncOrphanedFeeds } from "@/lib/queue"
import { generatePostsForFeed } from "@/lib/auto-generator"
import { withDatabase } from "@/lib/cron-db"
import { distributeToSubscribers } from "@/lib/auto-scheduler"
import { verifyCronAuth } from "@/lib/cron-auth"

export const maxDuration = 300 // 5 minutes

/**
 * Process queue of approved feeds
 * This cron job:
 * 1. Syncs orphaned APPROVED feeds into the queue
 * 2. Recovers stuck jobs from previous crashes
 * 3. Processes up to 5 jobs per invocation
 * 4. For each job: generate posts → distribute → mark complete
 */

const MAX_JOBS_PER_RUN = 5

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("🔄 Starting queue processor...")
  const startTime = Date.now()

  try {
    // 1. Sync orphaned feeds and recover stuck jobs
    const setupResult = await withDatabase(async () => {
      const synced = await syncOrphanedFeeds()
      const recovered = await recoverStuckJobs()
      const stats = await getQueueStats()
      return { synced, recovered, stats }
    })

    if (setupResult.synced > 0) {
      console.log(`  🔄 Synced ${setupResult.synced} orphaned feeds`)
    }
    if (setupResult.recovered > 0) {
      console.log(`  🔄 Recovered ${setupResult.recovered} stuck jobs`)
    }
    console.log(`  📊 Queue stats: ${setupResult.stats.queued} queued, ${setupResult.stats.processing} processing`)

    if (setupResult.stats.queued === 0) {
      return NextResponse.json({
        success: true,
        message: "Queue is empty",
        synced: setupResult.synced,
        stats: setupResult.stats,
        duration: `${Date.now() - startTime}ms`
      })
    }

    // 2. Process up to MAX_JOBS_PER_RUN jobs
    const results: Array<{
      feedId: string
      success: boolean
      usersScheduled?: number
      twitterScheduled?: number
      linkedinScheduled?: number
      error?: string
    }> = []

    for (let i = 0; i < MAX_JOBS_PER_RUN; i++) {
      const job = await withDatabase(async () => dequeueNextJob())

      if (!job) {
        console.log(`  📭 No more jobs in queue (processed ${i} this run)`)
        break
      }

      console.log(`  📝 [${i + 1}/${MAX_JOBS_PER_RUN}] Processing feed ${job.feedId}`)

      try {
        // Generate posts
        console.log(`  🤖 Generating posts...`)
        const genResult = await withDatabase(async () => {
          return await generatePostsForFeed(job.feedId)
        })

        if (!genResult.success) {
          await withDatabase(async () => {
            await markJobFailed(job, genResult.error || "Generation failed")
          })
          results.push({ feedId: job.feedId, success: false, error: genResult.error })
          console.log(`  ❌ Generation failed for ${job.feedId}: ${genResult.error}`)
          continue
        }

        // Distribute to subscribers
        console.log(`  📢 Distributing to subscribers...`)
        const distResult = await withDatabase(async () => {
          return await distributeToSubscribers(job.feedId)
        })

        if (!distResult.success) {
          await withDatabase(async () => {
            await markJobFailed(job, `Distribution failed: ${distResult.errors.join(", ")}`)
          })
          results.push({ feedId: job.feedId, success: false, error: distResult.errors.join(", ") })
          console.log(`  ❌ Distribution failed for ${job.feedId}`)
          continue
        }

        // Mark complete
        await withDatabase(async () => {
          await markJobCompleted(job)
        })

        results.push({
          feedId: job.feedId,
          success: true,
          usersScheduled: distResult.usersScheduled,
          twitterScheduled: distResult.twitterScheduled,
          linkedinScheduled: distResult.linkedinScheduled,
        })
        console.log(`  ✅ Feed ${job.feedId}: ${distResult.usersScheduled} users, ${distResult.twitterScheduled} tweets, ${distResult.linkedinScheduled} linkedin`)

      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error"
        await withDatabase(async () => {
          await markJobFailed(job, errMsg)
        }).catch(() => {}) // Don't fail the whole run if cleanup fails
        results.push({ feedId: job.feedId, success: false, error: errMsg })
        console.error(`  ❌ Error processing feed ${job.feedId}:`, error)
      }
    }

    const finalStats = await withDatabase(async () => getQueueStats())
    const duration = Date.now() - startTime
    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`✅ Queue processing completed in ${duration}ms — ${successCount} succeeded, ${failCount} failed, ${finalStats.queued} remaining`)

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      synced: setupResult.synced,
      processed: results.length,
      succeeded: successCount,
      failed: failCount,
      results,
      stats: finalStats,
    })

  } catch (error) {
    console.error("❌ Queue processing failed:", error)
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

// Also support POST
export async function POST(request: Request) {
  return GET(request)
}
