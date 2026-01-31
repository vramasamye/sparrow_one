import { NextResponse } from "next/server"
import { dequeueNextJob, markJobCompleted, markJobFailed, getQueueStats, recoverStuckJobs } from "@/lib/queue"
import { generatePostsForFeed } from "@/lib/auto-generator"
import { withDatabase } from "@/lib/cron-db"
import { distributeToSubscribers } from "@/lib/auto-scheduler"
import { verifyCronAuth } from "@/lib/cron-auth"

/**
 * Process queue of approved feeds
 * This cron job:
 * 1. Picks up next feed from queue
 * 2. Generates Twitter + LinkedIn posts (with rate limit retry)
 * 3. Distributes to all subscribers
 * 4. Marks job as completed
 *
 * Vercel limits:
 * - Hobby: 10s timeout
 * - Pro: 60s timeout
 *
 * So we process ONE job per invocation to stay within limits
 */

export async function GET(request: Request) {
  // Verify authorization
  const authHeader = request.headers.get("authorization")
  const url = new URL(request.url)
  const secretParam = url.searchParams.get("secret")

  if (!verifyCronAuth(authHeader, secretParam)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("🔄 Starting queue processor...")
  const startTime = Date.now()

  try {
    const result = await withDatabase(async () => {
      // 1. Recover any stuck jobs from previous crashes
      const recovered = await recoverStuckJobs()
      if (recovered > 0) {
        console.log(`  🔄 Recovered ${recovered} stuck jobs`)
      }

      // 2. Get queue stats
      const stats = await getQueueStats()
      console.log(`  📊 Queue stats: ${stats.queued} queued, ${stats.processing} processing`)

      if (stats.queued === 0) {
        return { empty: true, stats }
      }

      // 3. Get next job from queue
      const job = await dequeueNextJob()

      return { empty: false, stats, job }
    })

    if (result.empty) {
      return NextResponse.json({
        success: true,
        message: "Queue is empty",
        stats: result.stats,
        duration: `${Date.now() - startTime}ms`
      })
    }

    const { job, stats } = result

    if (!job) {
      return NextResponse.json({
        success: true,
        message: "No jobs available",
        stats,
        duration: `${Date.now() - startTime}ms`
      })
    }

    console.log(`  📝 Processing job: Feed ${job.feedId}`)

    // 4. Generate posts (with rate limit retry)
    console.log(`  🤖 Generating posts...`)
    const genResult = await withDatabase(async () => {
      return await generatePostsForFeed(job.feedId)
    })

    if (!genResult.success) {
      await withDatabase(async () => {
        await markJobFailed(job, genResult.error || "Generation failed")
      })
      return NextResponse.json({
        success: false,
        error: "Generation failed",
        details: genResult.error,
        feedId: job.feedId,
        duration: `${Date.now() - startTime}ms`
      }, { status: 500 })
    }

    console.log(`  ✅ Posts generated successfully`)

    // 5. Distribute to subscribers
    console.log(`  📢 Distributing to subscribers...`)
    const distResult = await withDatabase(async () => {
      return await distributeToSubscribers(job.feedId)
    })

    if (!distResult.success) {
      await withDatabase(async () => {
        await markJobFailed(job, `Distribution failed: ${distResult.errors.join(", ")}`)
      })
      return NextResponse.json({
        success: false,
        error: "Distribution failed",
        details: distResult.errors,
        feedId: job.feedId,
        duration: `${Date.now() - startTime}ms`
      }, { status: 500 })
    }

    console.log(`  ✅ Distributed successfully`)

    // 6. Mark job as completed
    await withDatabase(async () => {
      await markJobCompleted(job)
    })

    const duration = Date.now() - startTime

    console.log(`✅ Queue processing completed in ${duration}ms`)
    console.log(`   Feed: ${job.feedId}`)
    console.log(`   Users scheduled: ${distResult.usersScheduled}`)
    console.log(`   Twitter posts: ${distResult.twitterScheduled}`)
    console.log(`   LinkedIn posts: ${distResult.linkedinScheduled}`)

    const finalStats = await withDatabase(async () => {
      return await getQueueStats()
    })

    return NextResponse.json({
      success: true,
      duration: `${duration}ms`,
      feedId: job.feedId,
      generation: {
        success: genResult.success,
      },
      distribution: {
        usersScheduled: distResult.usersScheduled,
        twitterScheduled: distResult.twitterScheduled,
        linkedinScheduled: distResult.linkedinScheduled,
        errors: distResult.errors
      },
      stats: finalStats
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
