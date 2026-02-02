import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { redis } from "@/lib/redis"
import { prisma } from "@/lib/prisma"
import { getQueueStats, peekQueue } from "@/lib/queue"

/**
 * GET /api/admin/queue
 * Get queue statistics and job list
 */
export async function GET() {
  try {
    // Check authentication and admin role
    const session = await getServerSession(authOptions)

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email! },
      select: { role: true },
    })

    if (user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Forbidden - Admin only" }, { status: 403 })
    }

    // Get queue stats
    const stats = await getQueueStats()

    // Get generated posts stats
    const generatedStats = await prisma.generatedPost.groupBy({
      by: ["status"],
      _count: true,
    })

    const generatedPosts = {
      PENDING: 0,
      GENERATING: 0,
      COMPLETED: 0,
      DISTRIBUTING: 0,
      DISTRIBUTED: 0,
      FAILED: 0,
    }

    generatedStats.forEach((stat) => {
      generatedPosts[stat.status as keyof typeof generatedPosts] = stat._count
    })

    // Peek at queue jobs
    const queueJobs = await peekQueue(20)

    // Fetch feed titles for jobs
    const feedIds = queueJobs.map((job) => job.feedId)
    const feeds = await prisma.feed.findMany({
      where: { id: { in: feedIds } },
      select: { id: true, title: true },
    })

    const feedMap = new Map(feeds.map((f) => [f.id, f.title]))

    const enrichedJobs = queueJobs.map((job) => ({
      ...job,
      feedTitle: feedMap.get(job.feedId) || "Unknown Feed",
    }))

    return NextResponse.json({
      queued: stats.queued,
      processing: stats.processing,
      total: stats.total,
      generatedPosts,
      queueJobs: enrichedJobs,
    })
  } catch (error) {
    console.error("Failed to get queue stats:", error)
    return NextResponse.json(
      { error: "Failed to get queue stats" },
      { status: 500 }
    )
  }
}
