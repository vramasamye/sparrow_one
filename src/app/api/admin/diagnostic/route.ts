import { NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQueueStats } from "@/lib/queue"
import { getDetailedRateLimitStatus } from "@/lib/rate-limiter"

/**
 * Admin diagnostic endpoint to check system status
 * Returns information about:
 * - GROQ API key configuration
 * - Rate limit status
 * - Feed processing status
 * - Queue status
 * - Recent generated posts
 * - Scheduled posts
 */
export async function GET(request: Request) {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // 1. Check GROQ API Keys
    const GROQ_API_KEYS = (process.env.GROQ_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean)
    const GROQ_API_KEY = process.env.GROQ_API_KEY
    const totalKeys = GROQ_API_KEYS.length > 0 ? GROQ_API_KEYS.length : (GROQ_API_KEY ? 1 : 0)

    // 2. Check rate limits
    let rateLimitStatus
    try {
      rateLimitStatus = await getDetailedRateLimitStatus("moonshotai/kimi-k2-instruct")
    } catch (error) {
      rateLimitStatus = {
        error: "Could not check rate limits (Redis may not be connected)",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    }

    // 3. Check feeds
    const feedStats = await prisma.feed.groupBy({
      by: ['status'],
      _count: true
    })

    const approvedFeeds = await prisma.feed.findMany({
      where: { status: "APPROVED" },
      select: {
        id: true,
        title: true,
        approvedAt: true,
        topic: {
          select: {
            name: true,
            enableTwitter: true,
            enableLinkedin: true
          }
        }
      },
      orderBy: { approvedAt: 'desc' },
      take: 5
    })

    // 4. Check generated posts
    const genPostStats = await prisma.generatedPost.groupBy({
      by: ['status'],
      _count: true
    })

    const recentGenPosts = await prisma.generatedPost.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: {
        feed: {
          select: {
            title: true,
            status: true
          }
        }
      }
    })

    // Check for stuck generating posts
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000)
    const stuckGenPosts = await prisma.generatedPost.count({
      where: {
        status: "GENERATING",
        createdAt: { lt: thirtyMinutesAgo }
      }
    })

    // 5. Check queue
    let queueStats
    try {
      queueStats = await getQueueStats()
    } catch (error) {
      queueStats = {
        error: "Could not check queue (Redis may not be connected)",
        message: error instanceof Error ? error.message : "Unknown error"
      }
    }

    // 6. Check scheduled posts
    const scheduledStats = await prisma.scheduledPost.groupBy({
      by: ['status', 'platform'],
      _count: true
    })

    const upcomingPosts = await prisma.scheduledPost.count({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          gte: new Date()
        }
      }
    })

    // 7. Check user subscriptions
    const totalSubscriptions = await prisma.userTopic.count()

    // 8. Determine issues
    const issues = []
    const warnings = []

    if (totalKeys === 0) {
      issues.push("No GROQ API keys configured in Vercel environment variables")
    }

    if ('availableKeys' in rateLimitStatus && rateLimitStatus.availableKeys === 0) {
      warnings.push("All GROQ API keys are currently rate limited")
    }

    if (approvedFeeds.length === 0) {
      warnings.push("No approved feeds - go to /admin/feeds to approve some")
    }

    if (stuckGenPosts > 0) {
      issues.push(`${stuckGenPosts} GeneratedPost(s) stuck in GENERATING status`)
    }

    if ('queued' in queueStats && 'processing' in queueStats) {
      if (queueStats.processing > 0 && queueStats.queued === 0) {
        warnings.push(`${queueStats.processing} job(s) stuck in processing state`)
      }
    }

    if (totalSubscriptions === 0) {
      warnings.push("No user subscriptions - users need to subscribe at /feed")
    }

    return NextResponse.json({
      status: issues.length === 0 ? "healthy" : "issues_found",
      timestamp: new Date().toISOString(),
      groqApiKeys: {
        configured: totalKeys,
        rateLimits: rateLimitStatus
      },
      feeds: {
        byStatus: feedStats,
        approvedCount: approvedFeeds.length,
        recentApproved: approvedFeeds.map(f => ({
          id: f.id,
          title: f.title,
          topic: f.topic.name,
          approvedAt: f.approvedAt
        }))
      },
      generatedPosts: {
        byStatus: genPostStats,
        stuckCount: stuckGenPosts,
        recent: recentGenPosts.map(p => ({
          id: p.id,
          status: p.status,
          feedTitle: p.feed.title,
          createdAt: p.createdAt,
          error: p.errorMessage
        }))
      },
      queue: queueStats,
      scheduledPosts: {
        byStatus: scheduledStats,
        upcoming: upcomingPosts
      },
      subscriptions: {
        total: totalSubscriptions
      },
      issues,
      warnings,
      suggestedActions: [
        ...(issues.length > 0 ? ["Run POST /api/admin/fix-stuck-jobs to clear stuck jobs"] : []),
        ...(totalKeys === 0 ? ["Add GROQ_API_KEYS to Vercel environment variables"] : []),
        ...(approvedFeeds.length === 0 ? ["Approve some feeds at /admin/feeds"] : []),
        ...(totalSubscriptions === 0 ? ["Have users subscribe to topics at /feed"] : [])
      ]
    })

  } catch (error) {
    console.error("Diagnostic check failed:", error)
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}
