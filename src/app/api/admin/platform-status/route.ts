import { NextResponse } from "next/server"

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { getQueueStats } from "@/lib/queue"
import { getDetailedRateLimitStatus, MODEL_LIMITS } from "@/lib/rate-limiter"

export const dynamic = "force-dynamic"

const TRACKED_MODELS = [
  { id: "meta-llama/llama-guard-4-12b", label: "Llama Guard 4", purpose: "Content Moderation" },
  { id: "moonshotai/kimi-k2-instruct", label: "Kimi K2 Instruct", purpose: "Post Generation" },
]

export async function GET() {
  const session = await auth()

  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    // Fetch queue stats, GROQ usage, and generated post stats in parallel
    const [queueStats, generatedStats, ...modelStatuses] = await Promise.all([
      getQueueStats().catch(() => ({ queued: 0, processing: 0, total: 0 })),
      prisma.generatedPost.groupBy({ by: ["status"], _count: true }).catch(() => []),
      ...TRACKED_MODELS.map((m) =>
        getDetailedRateLimitStatus(m.id).catch(() => ({
          model: m.id,
          totalKeys: 0,
          availableKeys: 0,
          keys: [],
        }))
      ),
    ])

    // Aggregate generated post counts
    const generatedPosts: Record<string, number> = {
      PENDING: 0,
      GENERATING: 0,
      COMPLETED: 0,
      DISTRIBUTING: 0,
      DISTRIBUTED: 0,
      FAILED: 0,
    }
    for (const stat of generatedStats as any[]) {
      if (stat.status in generatedPosts) {
        generatedPosts[stat.status] = stat._count
      }
    }

    // Build per-model usage summary
    const models = TRACKED_MODELS.map((m, i) => {
      const status = modelStatuses[i] as any
      const limits = MODEL_LIMITS[m.id] || MODEL_LIMITS["default"]

      // Aggregate across all keys for daily totals
      let totalRequestsToday = 0
      let totalTokensToday = 0
      let totalRequestsPerMinute = 0

      for (const key of status.keys || []) {
        totalRequestsToday += key.requests?.perDay?.used ?? 0
        totalTokensToday += key.tokens?.perDay?.used ?? 0
        totalRequestsPerMinute += key.requests?.perMinute?.used ?? 0
      }

      // Per-key daily limit (each key has independent limits)
      const totalKeysCount = status.totalKeys || 0
      const dailyRequestLimit = limits.rpd * totalKeysCount
      const dailyTokenLimit = limits.tpd * totalKeysCount

      return {
        id: m.id,
        label: m.label,
        purpose: m.purpose,
        totalKeys: totalKeysCount,
        availableKeys: status.availableKeys ?? 0,
        rpm: limits.rpm,
        requests: {
          today: totalRequestsToday,
          dailyLimit: dailyRequestLimit,
          remaining: Math.max(0, dailyRequestLimit - totalRequestsToday),
          currentMinute: totalRequestsPerMinute,
        },
        tokens: {
          today: totalTokensToday,
          dailyLimit: dailyTokenLimit,
          remaining: Math.max(0, dailyTokenLimit - totalTokensToday),
        },
      }
    })

    return NextResponse.json({
      queue: {
        queued: queueStats.queued,
        processing: queueStats.processing,
        total: queueStats.total,
      },
      generatedPosts,
      models,
    })
  } catch (error) {
    console.error("Error fetching platform status:", error)
    return NextResponse.json(
      { error: "Failed to fetch platform status" },
      { status: 500 }
    )
  }
}
