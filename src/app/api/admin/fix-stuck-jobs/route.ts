import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { recoverStuckJobs, getQueueStats, enqueueApprovedFeed } from "@/lib/queue"

/**
 * Admin endpoint to fix stuck jobs and reset the queue
 * This fixes:
 * 1. GeneratedPost records stuck in GENERATING status
 * 2. Queue jobs stuck in processing state
 * 3. Re-queues approved feeds that haven't been processed
 */
export async function POST(request: Request) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  console.log("🔧 Fixing stuck jobs...")

  try {
    const results = {
      stuckGeneratedPosts: 0,
      recoveredQueueJobs: 0,
      requeuedFeeds: 0,
      errors: [] as string[]
    }

    // 1. Fix stuck GeneratedPost records (older than 30 minutes in GENERATING state)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const stuckGenPosts = await prisma.generatedPost.findMany({
      where: {
        status: "GENERATING",
        createdAt: { lt: thirtyMinutesAgo }
      },
      include: {
        feed: {
          select: {
            id: true,
            title: true,
            status: true,
            approvedBy: true
          }
        }
      }
    })

    console.log(`Found ${stuckGenPosts.length} stuck GeneratedPost(s)`)

    for (const post of stuckGenPosts) {
      try {
        // Reset to PENDING
        await prisma.generatedPost.update({
          where: { id: post.id },
          data: {
            status: "PENDING",
            errorMessage: "Reset from stuck GENERATING state by admin"
          }
        })

        // Re-queue the feed if still approved
        if (post.feed.status === "APPROVED" && post.feed.approvedBy) {
          await enqueueApprovedFeed(post.feed.id, post.feed.approvedBy)
          results.requeuedFeeds++
        }

        results.stuckGeneratedPosts++
        console.log(`✅ Reset: ${post.feed.title.substring(0, 60)}...`)
      } catch (error) {
        const errorMsg = `Failed to reset ${post.feed.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
        console.error(errorMsg)
        results.errors.push(errorMsg)
      }
    }

    // 2. Recover stuck queue jobs
    const recovered = await recoverStuckJobs()
    results.recoveredQueueJobs = recovered
    console.log(`✅ Recovered ${recovered} stuck queue job(s)`)

    // 3. Check for approved feeds without completed generated posts
    const approvedFeeds = await prisma.feed.findMany({
      where: { status: "APPROVED" },
      include: {
        generatedPosts: {
          where: {
            status: {
              in: ["COMPLETED", "DISTRIBUTED"]
            }
          }
        }
      }
    })

    console.log(`Found ${approvedFeeds.length} approved feed(s)`)

    for (const feed of approvedFeeds) {
      if (feed.generatedPosts.length === 0) {
        try {
          // This feed needs to be processed
          await enqueueApprovedFeed(feed.id, feed.approvedBy || "admin")
          results.requeuedFeeds++
          console.log(`✅ Re-queued: ${feed.title.substring(0, 60)}...`)
        } catch (error) {
          const errorMsg = `Failed to re-queue ${feed.title}: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error(errorMsg)
          results.errors.push(errorMsg)
        }
      }
    }

    // 4. Get final queue stats
    const queueStats = await getQueueStats()

    console.log("✅ Stuck jobs fixed!")
    console.log(`   - Reset ${results.stuckGeneratedPosts} stuck GeneratedPost(s)`)
    console.log(`   - Recovered ${results.recoveredQueueJobs} stuck queue job(s)`)
    console.log(`   - Re-queued ${results.requeuedFeeds} feed(s)`)
    console.log(`   - Queue now has ${queueStats.queued} job(s)`)

    return NextResponse.json({
      success: true,
      results: {
        stuckGeneratedPostsFixed: results.stuckGeneratedPosts,
        queueJobsRecovered: results.recoveredQueueJobs,
        feedsRequeued: results.requeuedFeeds,
        errors: results.errors
      },
      queueStats
    })

  } catch (error) {
    console.error("❌ Failed to fix stuck jobs:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
