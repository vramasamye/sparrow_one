import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { dequeueNextJob, markJobCompleted, markJobFailed } from "@/lib/queue"
import { generatePostsForFeed } from "@/lib/auto-generator"
import { distributeToSubscribers } from "@/lib/auto-scheduler"

/**
 * POST /api/admin/queue/process
 * Manually trigger processing of next queue job
 */
export async function POST() {
  try {
    // Check authentication and admin role
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Get next job
    const job = await dequeueNextJob()

    if (!job) {
      return NextResponse.json({
        success: true,
        message: "Queue is empty",
      })
    }

    console.log(`Admin triggered: Processing feed ${job.feedId}`)

    // Generate posts
    const genResult = await generatePostsForFeed(job.feedId)

    if (!genResult.success) {
      await markJobFailed(job, genResult.error || "Generation failed")
      return NextResponse.json({
        success: false,
        error: "Generation failed",
        details: genResult.error,
      }, { status: 500 })
    }

    // Distribute to subscribers
    const distResult = await distributeToSubscribers(job.feedId)

    if (!distResult.success) {
      await markJobFailed(job, `Distribution failed: ${distResult.errors.join(", ")}`)
      return NextResponse.json({
        success: false,
        error: "Distribution failed",
        details: distResult.errors,
      }, { status: 500 })
    }

    // Mark as completed
    await markJobCompleted(job)

    return NextResponse.json({
      success: true,
      message: `Successfully processed feed ${job.feedId}`,
      feedId: job.feedId,
      distribution: {
        usersScheduled: distResult.usersScheduled,
        twitterScheduled: distResult.twitterScheduled,
        linkedinScheduled: distResult.linkedinScheduled,
      },
    })
  } catch (error) {
    console.error("Failed to process queue:", error)
    return NextResponse.json(
      { error: "Failed to process queue", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    )
  }
}
